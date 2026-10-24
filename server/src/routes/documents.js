import { Router } from "express";
import { z } from "zod";
import { Document, Project, DOC_TYPES } from "../models/index.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { newId, r2, docOut } from "../services/common.js";
import { nextNumber } from "../services/numbering.js";
import { planReceiptSync } from "../services/receipts.js";
import { atomically } from "../services/tx.js";

const body = z.object({
  type: z.enum(DOC_TYPES, { error: `Type must be one of: ${DOC_TYPES.join(", ")}.` }),
  status: z.string().trim().max(40).default("Draft"),
  projectId: z.string().default(""),
  client: z.string().trim().max(200).default(""),
  total: z.coerce.number({ error: "Total must be a number." }).finite().default(0),
  date: z.string().max(40).default(""),
  data: z.object({}).passthrough().default({}),
});

export const documentsRouter = Router();

documentsRouter.get("/", async (req, res) => {
  const filter = { userId: req.userId };
  if (typeof req.query.projectId === "string" && req.query.projectId) filter.projectId = req.query.projectId;
  if (typeof req.query.type === "string" && req.query.type) {
    if (!DOC_TYPES.includes(req.query.type)) throw new HttpError(400, `Type must be one of: ${DOC_TYPES.join(", ")}.`);
    filter.type = req.query.type;
  }
  const list = await Document.find(filter).sort({ updatedAt: -1 }).lean();
  res.json(list.map(docOut));
});

// A confirmed receipt adds or updates a payment on its project. Planned first (nothing written yet),
// so a conflict or a bad project stops the save before any change.
async function planReceipt(userId, b, number) {
  if (b.type !== "receipt" || !b.data.confirmed || !b.projectId) return null;
  const project = await Project.findOne({ _id: b.projectId, userId }).lean();
  if (!project) throw new HttpError(400, "That project was not found, so the payment can't be added to it.");
  if (!(+b.data.amount > 0)) throw new HttpError(400, "A confirmed receipt needs an amount above 0.");
  const plan = planReceiptSync(project.data, b.data, number);
  if (plan.conflict) throw new HttpError(409, `This payment already has receipt ${plan.conflict}.`);
  return { plan, project };
}

async function applyPlan(userId, projectId, plan, session) {
  await Project.updateOne({ _id: projectId, userId }, { $set: { "data.payments": plan.payments, "data.paid": plan.paid, updatedAt: new Date() } }, { session });
}
async function revertPlan(userId, project) {
  const d = project.data, set = {}, unset = {};
  if (d.payments !== undefined) set["data.payments"] = d.payments; else unset["data.payments"] = "";
  if (d.paid !== undefined) set["data.paid"] = d.paid; else unset["data.paid"] = "";
  await Project.updateOne({ _id: project._id, userId }, { $set: { ...set, updatedAt: project.updatedAt }, $unset: unset });
}

// With a transaction (Atlas), the document and the project's payment are saved together.
// Without one (a standalone test database), the document goes first and is deleted if the project update fails.
documentsRouter.post("/", validate(body), async (req, res) => {
  const b = req.body, userId = req.userId;
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = await nextNumber(userId, b.type);
    const sp = await planReceipt(userId, b, number);
    const data = { ...b.data, number };
    if (sp) data.payRef = sp.plan.payRef;
    const now = new Date();
    const fields = { _id: newId(), userId, projectId: b.projectId, type: b.type, number, status: b.status, client: b.client, total: r2(b.total), date: b.date, data, createdAt: now, updatedAt: now };
    try {
      const doc = await atomically(async (session) => {
        const [created] = await Document.create([fields], { session });
        if (sp) {
          try { await applyPlan(userId, b.projectId, sp.plan, session); }
          catch (e) { if (!session) await Document.deleteOne({ _id: created._id }); throw e; }
        }
        return created;
      });
      return res.status(201).json(docOut(doc.toObject()));
    } catch (e) {
      if (e.code === 11000) continue; // number already used (for example by an imported document): take the next one
      throw e;
    }
  }
  throw new HttpError(500, "Couldn't get a free document number. Try again.");
});

documentsRouter.put("/:id", validate(body), async (req, res) => {
  const b = req.body, userId = req.userId;
  const cur = await Document.findOne({ _id: req.params.id, userId }).lean();
  if (!cur) throw new HttpError(404, "Document not found.");
  if (b.type !== cur.type) throw new HttpError(400, "A document's type can't be changed.");
  const sp = await planReceipt(userId, b, cur.number);
  const data = { ...b.data, number: cur.number };
  if (sp) data.payRef = sp.plan.payRef;
  const doc = await atomically(async (session) => {
    if (sp) await applyPlan(userId, b.projectId, sp.plan, session);
    try {
      return await Document.findOneAndUpdate({ _id: cur._id, userId },
        { $set: { projectId: b.projectId, status: b.status, client: b.client, total: r2(b.total), date: b.date, data, updatedAt: new Date() } }, { returnDocument: "after", session }).lean();
    } catch (e) {
      if (sp && !session) await revertPlan(userId, sp.project);
      throw e;
    }
  });
  res.json(docOut(doc));
});

documentsRouter.delete("/:id", async (req, res) => {
  const r = await Document.deleteOne({ _id: req.params.id, userId: req.userId });
  if (!r.deletedCount) throw new HttpError(404, "Document not found.");
  res.json({ ok: true });
});
