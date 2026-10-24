import mongoose from "mongoose";

const { Schema } = mongoose;

export const DOC_TYPES = ["proposal", "invoice", "receipt", "agreement", "timeline", "content", "revision", "handover", "testimonial"];
export const PREFIXES = { proposal: "PRO", invoice: "INV", receipt: "RCT", agreement: "AGR", timeline: "TML", content: "CNT", revision: "REV", handover: "HND", testimonial: "TST" };

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Project and Document keep the prototype's string ids. Timestamps are set by the routes
// (not by Mongoose) so a backup import can keep the original dates.
const projectSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { minimize: false });

const documentSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, required: true },
  projectId: { type: String, default: "" },
  type: { type: String, required: true, enum: DOC_TYPES },
  number: { type: String, required: true },
  status: { type: String, default: "Draft" },
  client: { type: String, default: "" },
  total: { type: Number, default: 0 },
  date: { type: String, default: "" },
  data: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { minimize: false });
documentSchema.index({ userId: 1, number: 1 }, { unique: true });
documentSchema.index({ userId: 1, projectId: 1 });

const settingsSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true },
  data: { type: Schema.Types.Mixed, default: {} },
}, { minimize: false });

// One counter per user + type + year: _id is "<userId>:<type>:<year>".
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });

export const User = mongoose.model("User", userSchema);
export const Project = mongoose.model("Project", projectSchema);
export const Document = mongoose.model("Document", documentSchema);
export const Settings = mongoose.model("Settings", settingsSchema);
export const Counter = mongoose.model("Counter", counterSchema);
