import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { supportsTransactions } from "../src/services/tx.js";
import { Project, Document, User, Counter, Settings } from "../src/models/index.js";
import { makeApp, signup } from "./helpers.js";

// A replica set behaves like Atlas: transactions are available.
let repl;
const app = makeApp();
beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User, Project, Document, Settings, Counter].map((m) => m.init()));
});
afterAll(async () => { await mongoose.disconnect(); await repl.stop(); });

const receipt = (projectId, over = {}) => ({ type: "receipt", projectId, total: 100, data: { confirmed: true, amount: 100, date: "2026-03-01", payType: "deposit", payRef: "new", ...over } });

test("the replica set is detected as transaction-capable", () => {
  expect(supportsTransactions()).toBe(true);
});

test("receipt → payment sync works inside a transaction, and re-saving adds no second payment", async () => {
  const u = await signup(app);
  const p = (await u.post("/api/projects", { name: "Site", payments: [] })).body;
  const r = (await u.post("/api/documents", receipt(p.id))).body;
  await u.put(`/api/documents/${r.id}`, receipt(p.id, { payRef: "new", amount: 150 }));
  const pr = (await u.get("/api/projects")).body[0];
  expect(pr.payments).toHaveLength(1);
  expect(pr.payments[0]).toMatchObject({ amount: 150, receiptNo: r.number });
  expect(pr.paid).toBe(150);
});

test("if the project update fails, the receipt is not saved either", async () => {
  const u = await signup(app, "tx@example.com", "password123", "let-me-in");
  const p = (await u.post("/api/projects", { name: "Site", payments: [] })).body;
  const orig = Project.updateOne;
  Project.updateOne = () => { throw new Error("boom"); };
  try {
    const r = await u.post("/api/documents", receipt(p.id));
    expect(r.status).toBe(500);
  } finally { Project.updateOne = orig; }
  expect((await u.get("/api/documents")).body).toHaveLength(0);
});
