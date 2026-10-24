import { Router } from "express";
import { z } from "zod";
import { Project, Document, Settings, DOC_TYPES } from "../models/index.js";
import { validate } from "../middleware/validate.js";
import { newId, r2, projectOut, docOut, stripReserved } from "../services/common.js";
import { bumpCounters } from "../services/numbering.js";

// The prototype's backup file keeps its internal tag.
const APP_TAG = "client-pipeline";

const importSchema = z.object({
  app: z.literal(APP_TAG, { error: "That file isn't a Parteh HQ backup." }),
  version: z.any().optional(),
  exportedAt: z.string().optional(),
  settings: z.object({}).passthrough().optional(),
  projects: z.array(z.any(), { error: "The backup has no projects list." }),
  docs: z.array(z.any()).optional(),
});

const asDate = (v) => { const d = new Date(v); return v && !isNaN(d) ? d : new Date(); };
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

export const backupRouter = Router();

backupRouter.get("/", async (req, res) => {
  const [settings, projects, docs] = await Promise.all([
    Settings.findOne({ userId: req.userId }).lean(),
    Project.find({ userId: req.userId }).lean(),
    Document.find({ userId: req.userId }).lean(),
  ]);
  res.json({ app: APP_TAG, version: 1, exportedAt: new Date().toISOString(), settings: settings?.data || {}, projects: projects.map(projectOut), docs: docs.map(docOut) });
});

// Items with the same id are replaced. Everything else stays.
backupRouter.post("/import", validate(importSchema), async (req, res) => {
  const userId = req.userId, { projects, docs = [], settings } = req.body;
  const skipped = [];
  const idMap = new Map();

  // An id can already belong to another account. Give those items a new id instead of failing.
  const wanted = [...projects, ...docs].map((x) => x?.id).filter((x) => typeof x === "string");
  const [pOther, dOther] = await Promise.all([
    Project.find({ _id: { $in: wanted }, userId: { $ne: userId } }, "_id").lean(),
    Document.find({ _id: { $in: wanted }, userId: { $ne: userId } }, "_id").lean(),
  ]);
  const taken = new Set([...pOther, ...dOther].map((x) => x._id));

  let nProjects = 0, nDocs = 0;
  for (const raw of projects) {
    if (!isObj(raw) || typeof raw.id !== "string" || !raw.id) { skipped.push({ kind: "project", reason: "Missing id." }); continue; }
    const id = taken.has(raw.id) ? newId() : raw.id;
    idMap.set(raw.id, id);
    const { createdAt, updatedAt } = raw;
    await Project.replaceOne({ _id: id, userId }, { _id: id, userId, data: stripReserved(raw), createdAt: asDate(createdAt), updatedAt: asDate(updatedAt || createdAt) }, { upsert: true });
    nProjects++;
  }

  const numbers = [];
  for (const raw of docs) {
    const label = isObj(raw) ? raw.number || raw.id : "";
    if (!isObj(raw) || typeof raw.id !== "string" || !raw.id) { skipped.push({ kind: "document", reason: "Missing id." }); continue; }
    if (!DOC_TYPES.includes(raw.type) || typeof raw.number !== "string" || !raw.number) { skipped.push({ kind: "document", id: raw.id, reason: "Unknown type or missing number." }); continue; }
    const id = taken.has(raw.id) ? newId() : raw.id;
    const doc = {
      _id: id, userId, projectId: idMap.get(raw.projectId) || raw.projectId || "", type: raw.type, number: raw.number, status: String(raw.status || "Draft"),
      client: String(raw.client || ""), total: r2(raw.total), date: String(raw.date || ""), data: isObj(raw.data) ? raw.data : {},
      createdAt: asDate(raw.createdAt), updatedAt: asDate(raw.updatedAt || raw.createdAt),
    };
    try {
      await Document.replaceOne({ _id: id, userId }, doc, { upsert: true });
      nDocs++; numbers.push(raw.number);
    } catch (e) {
      if (e.code !== 11000) throw e;
      skipped.push({ kind: "document", id: raw.id, reason: `Number ${label} is already used by another document.` });
    }
  }
  await bumpCounters(userId, numbers);

  if (settings) await Settings.findOneAndUpdate({ userId }, { $set: { data: settings } }, { upsert: true });
  res.json({ imported: { projects: nProjects, docs: nDocs, settings: !!settings }, skipped });
});
