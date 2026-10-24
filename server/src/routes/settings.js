import { Router } from "express";
import { z } from "zod";
import { Settings } from "../models/index.js";
import { validate } from "../middleware/validate.js";

export const settingsRouter = Router();

settingsRouter.get("/", async (req, res) => {
  const s = await Settings.findOne({ userId: req.userId }).lean();
  res.json(s?.data || {});
});

// Replaces all settings, like the prototype's settings/main document.
settingsRouter.put("/", validate(z.object({}).passthrough()), async (req, res) => {
  const s = await Settings.findOneAndUpdate({ userId: req.userId }, { $set: { data: req.body } }, { upsert: true, returnDocument: "after" }).lean();
  res.json(s.data);
});
