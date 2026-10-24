import { Router } from "express";
import { z } from "zod";
import { Project } from "../models/index.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { newId, projectOut, stripReserved } from "../services/common.js";

// Projects are flexible objects. Only the name is required.
const full = z.object({ name: z.string({ error: "Project name is required." }).trim().min(1, "Project name is required.") }).passthrough();
const patch = z.object({ name: z.string().trim().min(1, "Project name can't be empty.").optional() }).passthrough();

export const projectsRouter = Router();

projectsRouter.get("/", async (req, res) => {
  const list = await Project.find({ userId: req.userId }).sort({ updatedAt: -1 }).lean();
  res.json(list.map(projectOut));
});

projectsRouter.post("/", validate(full), async (req, res) => {
  const now = new Date();
  const p = await Project.create({ _id: newId(), userId: req.userId, data: stripReserved(req.body), createdAt: now, updatedAt: now });
  res.status(201).json(projectOut(p.toObject()));
});

projectsRouter.put("/:id", validate(full), async (req, res) => {
  const p = await Project.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { $set: { data: stripReserved(req.body), updatedAt: new Date() } }, { returnDocument: "after" }).lean();
  if (!p) throw new HttpError(404, "Project not found.");
  res.json(projectOut(p));
});

projectsRouter.patch("/:id", validate(patch), async (req, res) => {
  const cur = await Project.findOne({ _id: req.params.id, userId: req.userId }).lean();
  if (!cur) throw new HttpError(404, "Project not found.");
  const p = await Project.findOneAndUpdate({ _id: cur._id, userId: req.userId }, { $set: { data: { ...cur.data, ...stripReserved(req.body) }, updatedAt: new Date() } }, { returnDocument: "after" }).lean();
  res.json(projectOut(p));
});

projectsRouter.delete("/:id", async (req, res) => {
  const r = await Project.deleteOne({ _id: req.params.id, userId: req.userId });
  if (!r.deletedCount) throw new HttpError(404, "Project not found.");
  res.json({ ok: true });
});
