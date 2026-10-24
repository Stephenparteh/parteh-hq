import { startDb, stopDb, clearDb, makeApp, signup } from "./helpers.js";

const app = makeApp();
beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const year = new Date().getFullYear();

// Same shape the prototype's "Download backup" writes.
const backup = () => ({
  app: "client-pipeline", version: 1, exportedAt: "2026-02-10T09:00:00.000Z",
  settings: { bizName: "Stephen Parteh", goal: 300, depositPct: 30, prices: { page: 25 } },
  projects: [
    { id: "projA1", name: "Christ Life website", client: "Christ Life", phase: 8, payments: [{ id: "pay_x1", date: "2026-02-01", amount: 90, note: "Deposit", receiptNo: `RCT-${year}-004` }], paid: 90, scope: [{ item: "Website", price: 300 }],
      createdAt: "2026-01-05T10:00:00.000Z", updatedAt: "2026-02-01T10:00:00.000Z" },
    { id: "projB2", name: "Portfolio", client: "Self", phase: 0, createdAt: "2026-01-06T10:00:00.000Z", updatedAt: "2026-01-06T10:00:00.000Z" },
  ],
  docs: [
    { id: "docA1", type: "invoice", number: `INV-${year}-007`, status: "Sent", projectId: "projA1", client: "Christ Life", total: 90, date: "2026-01-20", data: { kind: "deposit", number: `INV-${year}-007` }, createdAt: "2026-01-20T10:00:00.000Z", updatedAt: "2026-01-21T10:00:00.000Z" },
    { id: "docA2", type: "receipt", number: `RCT-${year}-004`, status: "Issued", projectId: "projA1", client: "Christ Life", total: 90, date: "2026-02-01", data: { confirmed: true, amount: 90, payRef: "pay_x1" }, createdAt: "2026-02-01T10:00:00.000Z", updatedAt: "2026-02-01T10:00:00.000Z" },
  ],
});

test("imports the prototype's backup and keeps ids, numbers and dates", async () => {
  const u = await signup(app);
  const r = await u.post("/api/backup/import", backup());
  expect(r.status).toBe(200);
  expect(r.body.imported).toEqual({ projects: 2, docs: 2, settings: true });
  expect(r.body.skipped).toEqual([]);

  const projects = (await u.get("/api/projects")).body;
  const a = projects.find((p) => p.id === "projA1");
  expect(a).toMatchObject({ name: "Christ Life website", phase: 8, paid: 90 });
  expect(a.createdAt).toBe("2026-01-05T10:00:00.000Z");
  expect(a.updatedAt).toBe("2026-02-01T10:00:00.000Z");
  expect(a.payments[0].id).toBe("pay_x1");

  const docs = (await u.get("/api/documents")).body;
  expect(docs.map((d) => d.number).sort()).toEqual([`INV-${year}-007`, `RCT-${year}-004`]);
  expect(docs.find((d) => d.id === "docA1")).toMatchObject({ projectId: "projA1", status: "Sent", total: 90 });
  expect((await u.get("/api/settings")).body).toMatchObject({ goal: 300, depositPct: 30 });
});

test("new documents continue after the highest imported number", async () => {
  const u = await signup(app);
  await u.post("/api/backup/import", backup());
  const inv = await u.post("/api/documents", { type: "invoice" });
  const rct = await u.post("/api/documents", { type: "receipt" });
  expect(inv.body.number).toBe(`INV-${year}-008`);
  expect(rct.body.number).toBe(`RCT-${year}-005`);
});

test("importing twice replaces items instead of duplicating them", async () => {
  const u = await signup(app);
  await u.post("/api/backup/import", backup());
  const again = await u.post("/api/backup/import", backup());
  expect(again.body.skipped).toEqual([]);
  expect((await u.get("/api/projects")).body).toHaveLength(2);
  expect((await u.get("/api/documents")).body).toHaveLength(2);
});

test("other data stays when importing", async () => {
  const u = await signup(app);
  await u.post("/api/projects", { name: "Existing" });
  await u.post("/api/backup/import", backup());
  expect((await u.get("/api/projects")).body).toHaveLength(3);
});

test("export has the prototype's format and can be imported back", async () => {
  const a = await signup(app);
  await a.post("/api/backup/import", backup());
  const out = (await a.get("/api/backup")).body;
  expect(out).toMatchObject({ app: "client-pipeline", version: 1 });
  expect(out.projects).toHaveLength(2);
  expect(out.docs).toHaveLength(2);
  expect(out.projects.every((p) => p.id && p.name)).toBe(true);
  expect(JSON.stringify(out)).not.toMatch(/userId|passwordHash/);

  const b = await signup(app, "b@example.com", "password123", "let-me-in");
  const r = await b.post("/api/backup/import", out);
  expect(r.body.imported).toMatchObject({ projects: 2, docs: 2 });
  expect((await b.get("/api/documents")).body).toHaveLength(2);
});

test("ids that belong to another user get new ids and stay linked", async () => {
  const a = await signup(app);
  const b = await signup(app, "b@example.com", "password123", "let-me-in");
  await a.post("/api/backup/import", backup());
  const r = await b.post("/api/backup/import", backup());
  expect(r.body.skipped).toEqual([]);
  const bp = (await b.get("/api/projects")).body;
  const bd = (await b.get("/api/documents")).body;
  expect(bp.map((p) => p.id)).not.toContain("projA1");
  const christ = bp.find((p) => p.name === "Christ Life website");
  expect(bd.every((d) => d.projectId === christ.id)).toBe(true);
  // A is untouched
  expect((await a.get("/api/projects")).body.map((p) => p.id).sort()).toEqual(["projA1", "projB2"]);
});

test("rejects files that are not a backup", async () => {
  const u = await signup(app);
  const wrongTag = await u.post("/api/backup/import", { app: "something-else", projects: [] });
  expect(wrongTag.status).toBe(400);
  expect(wrongTag.body.error).toMatch(/isn't a Parteh HQ backup/);
  const noProjects = await u.post("/api/backup/import", { app: "client-pipeline" });
  expect(noProjects.status).toBe(400);
});

test("skips broken items and says why, but imports the rest", async () => {
  const u = await signup(app);
  const b = backup();
  b.projects.push({ name: "No id" });
  b.docs.push({ id: "bad1", type: "poem", number: "X-1" });
  b.docs.push({ id: "dup", type: "invoice", number: `INV-${year}-007`, data: {} }); // same number as docA1
  const r = await u.post("/api/backup/import", b);
  expect(r.status).toBe(200);
  expect(r.body.imported).toMatchObject({ projects: 2, docs: 2 });
  expect(r.body.skipped).toHaveLength(3);
  expect(r.body.skipped.map((s) => s.reason).join(" ")).toMatch(/already used/);
});
