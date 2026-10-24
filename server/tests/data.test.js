import { startDb, stopDb, clearDb, makeApp, signup } from "./helpers.js";

const app = makeApp();
beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const second = (email = "b@example.com") => signup(app, email, "password123", "let-me-in");

describe("projects", () => {
  test("create, list, put, patch and delete", async () => {
    const u = await signup(app);
    const c = await u.post("/api/projects", { name: "Christ Life", client: "Christ Life Church", phase: 0, payments: [] });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ name: "Christ Life", client: "Christ Life Church" });
    expect(c.body.id).toBeTruthy();
    const id = c.body.id;

    expect((await u.get("/api/projects")).body).toHaveLength(1);

    const p = await u.patch(`/api/projects/${id}`, { phase: 4, nextStep: "Follow up on the proposal" });
    expect(p.body).toMatchObject({ name: "Christ Life", phase: 4, nextStep: "Follow up on the proposal" });

    const put = await u.put(`/api/projects/${id}`, { name: "Renamed" });
    expect(put.body.name).toBe("Renamed");
    expect(put.body.client).toBeUndefined();

    expect((await u.del(`/api/projects/${id}`)).status).toBe(200);
    expect((await u.get("/api/projects")).body).toHaveLength(0);
    expect((await u.del(`/api/projects/${id}`)).status).toBe(404);
  });

  test("a name is required and clients can't set ids or owner", async () => {
    const u = await signup(app);
    const bad = await u.post("/api/projects", { client: "No name" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/name/i);
    const c = await u.post("/api/projects", { name: "X", id: "mine", userId: "someone", _id: "z" });
    expect(c.body.id).not.toBe("mine");
    expect(c.body.userId).toBeUndefined();
  });
});

describe("users can't see each other's data", () => {
  test("projects, documents and settings are private", async () => {
    const a = await signup(app);
    const b = await second();
    const p = (await a.post("/api/projects", { name: "A's project" })).body;
    const d = (await a.post("/api/documents", { type: "invoice", projectId: p.id, total: 50, data: { org: "A client" } })).body;
    await a.put("/api/settings", { goal: 999 });

    expect((await b.get("/api/projects")).body).toEqual([]);
    expect((await b.get("/api/documents")).body).toEqual([]);
    expect((await b.get("/api/settings")).body).toEqual({});
    expect((await b.get("/api/backup")).body.projects).toEqual([]);

    expect((await b.put(`/api/projects/${p.id}`, { name: "hacked" })).status).toBe(404);
    expect((await b.patch(`/api/projects/${p.id}`, { name: "hacked" })).status).toBe(404);
    expect((await b.del(`/api/projects/${p.id}`)).status).toBe(404);
    expect((await b.put(`/api/documents/${d.id}`, { type: "invoice", total: 1 })).status).toBe(404);
    expect((await b.del(`/api/documents/${d.id}`)).status).toBe(404);

    // still intact for the owner
    expect((await a.get("/api/projects")).body[0].name).toBe("A's project");
    expect((await a.get("/api/documents")).body).toHaveLength(1);
  });

  test("a receipt can't touch another user's project", async () => {
    const a = await signup(app);
    const b = await second();
    const p = (await a.post("/api/projects", { name: "A's project", payments: [] })).body;
    const r = await b.post("/api/documents", { type: "receipt", projectId: p.id, total: 10, data: { confirmed: true, amount: 10, date: "2026-01-01" } });
    expect(r.status).toBe(400);
    expect((await a.get("/api/projects")).body[0].payments).toEqual([]);
  });
});

describe("settings", () => {
  test("get returns empty, put replaces", async () => {
    const u = await signup(app);
    expect((await u.get("/api/settings")).body).toEqual({});
    await u.put("/api/settings", { goal: 500, depositPct: 30 });
    await u.put("/api/settings", { goal: 600 });
    expect((await u.get("/api/settings")).body).toEqual({ goal: 600 });
  });
});

describe("documents: numbering", () => {
  test("numbers follow PREFIX-YEAR-NNN per type", async () => {
    const u = await signup(app);
    const y = new Date().getFullYear();
    const inv1 = await u.post("/api/documents", { type: "invoice", total: 10 });
    const inv2 = await u.post("/api/documents", { type: "invoice", total: 20 });
    const pro = await u.post("/api/documents", { type: "proposal" });
    expect(inv1.body.number).toBe(`INV-${y}-001`);
    expect(inv2.body.number).toBe(`INV-${y}-002`);
    expect(pro.body.number).toBe(`PRO-${y}-001`);
    expect(inv1.body.data.number).toBe(inv1.body.number);
  });

  test("each type has its own prefix", async () => {
    const u = await signup(app);
    const y = new Date().getFullYear();
    const want = { proposal: "PRO", invoice: "INV", receipt: "RCT", agreement: "AGR", timeline: "TML", content: "CNT", revision: "REV", handover: "HND", testimonial: "TST" };
    for (const [type, prefix] of Object.entries(want)) {
      expect((await u.post("/api/documents", { type })).body.number).toBe(`${prefix}-${y}-001`);
    }
  });

  test("numbering is per user", async () => {
    const a = await signup(app);
    const b = await second();
    await a.post("/api/documents", { type: "invoice" });
    const r = await b.post("/api/documents", { type: "invoice" });
    expect(r.body.number).toMatch(/-001$/);
  });

  test("20 saves at the same moment get 20 different numbers", async () => {
    const u = await signup(app);
    const rs = await Promise.all(Array.from({ length: 20 }, () => u.post("/api/documents", { type: "invoice", total: 5 })));
    expect(rs.every((r) => r.status === 201)).toBe(true);
    const nums = rs.map((r) => r.body.number);
    expect(new Set(nums).size).toBe(20);
    const y = new Date().getFullYear();
    expect([...nums].sort()).toEqual(Array.from({ length: 20 }, (_, i) => `INV-${y}-${String(i + 1).padStart(3, "0")}`));
  });

  test("the number can't be changed by an update, and the type can't change", async () => {
    const u = await signup(app);
    const d = (await u.post("/api/documents", { type: "invoice", total: 10 })).body;
    const up = await u.put(`/api/documents/${d.id}`, { type: "invoice", total: 99, status: "Sent", number: "INV-1999-777", data: { number: "HACK" } });
    expect(up.body.number).toBe(d.number);
    expect(up.body.data.number).toBe(d.number);
    expect(up.body).toMatchObject({ total: 99, status: "Sent" });
    expect((await u.put(`/api/documents/${d.id}`, { type: "receipt" })).status).toBe(400);
  });

  test("filters by project and type; rejects bad types", async () => {
    const u = await signup(app);
    await u.post("/api/documents", { type: "invoice", projectId: "p1" });
    await u.post("/api/documents", { type: "proposal", projectId: "p1" });
    await u.post("/api/documents", { type: "invoice", projectId: "p2" });
    expect((await u.get("/api/documents?projectId=p1")).body).toHaveLength(2);
    expect((await u.get("/api/documents?projectId=p1&type=invoice")).body).toHaveLength(1);
    expect((await u.get("/api/documents?type=wrong")).status).toBe(400);
    const bad = await u.post("/api/documents", { type: "poem" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/Type must be one of/);
  });
});

describe("receipts update the project's payments", () => {
  const receipt = (projectId, over = {}, top = {}) => ({
    type: "receipt", status: "Issued", projectId, client: "Client", total: 100, date: "2026-03-01",
    data: { confirmed: true, amount: 100, date: "2026-03-01", method: "Cash", payType: "deposit", payRef: "new", invoiceNo: "INV-2026-001", ...over }, ...top,
  });
  const project = async (u, extra = {}) => (await u.post("/api/projects", { name: "Site", price: 1000, payments: [], paid: 0, ...extra })).body;

  test("a confirmed receipt adds one payment and updates paid", async () => {
    const u = await signup(app);
    const p = await project(u);
    const r = await u.post("/api/documents", receipt(p.id));
    expect(r.status).toBe(201);
    const pr = (await u.get("/api/projects")).body[0];
    expect(pr.payments).toHaveLength(1);
    expect(pr.payments[0]).toMatchObject({ amount: 100, date: "2026-03-01", method: "Cash", note: "Deposit payment", receiptNo: r.body.number, invoiceNo: "INV-2026-001" });
    expect(pr.paid).toBe(100);
    expect(r.body.data.payRef).toBe(pr.payments[0].id);
  });

  test("saving the same receipt again never adds a second payment", async () => {
    const u = await signup(app);
    const p = await project(u);
    const r = (await u.post("/api/documents", receipt(p.id))).body;
    // second save with the right payRef
    await u.put(`/api/documents/${r.id}`, receipt(p.id, { payRef: r.data.payRef }));
    // third save from a stale form that still says "new"
    await u.put(`/api/documents/${r.id}`, receipt(p.id, { payRef: "new", amount: 120 }, { total: 120 }));
    const pr = (await u.get("/api/projects")).body[0];
    expect(pr.payments).toHaveLength(1);
    expect(pr.payments[0].amount).toBe(120);
    expect(pr.paid).toBe(120);
    expect(pr.payments[0].id).toBe(r.data.payRef);
  });

  test("a receipt can link to an existing logged payment by id", async () => {
    const u = await signup(app);
    const p = await project(u, { payments: [{ id: "pay_1", date: "2026-02-01", amount: 100, note: "Deposit" }], paid: 100 });
    const r = await u.post("/api/documents", receipt(p.id, { payRef: "pay_1", amount: 100 }));
    const pr = (await u.get("/api/projects")).body[0];
    expect(pr.payments).toHaveLength(1);
    expect(pr.payments[0]).toMatchObject({ id: "pay_1", receiptNo: r.body.number });
  });

  test("a second receipt for the same payment is refused", async () => {
    const u = await signup(app);
    const p = await project(u, { payments: [{ id: "pay_1", date: "2026-02-01", amount: 100, note: "Deposit" }], paid: 100 });
    const first = await u.post("/api/documents", receipt(p.id, { payRef: "pay_1" }));
    const second = await u.post("/api/documents", receipt(p.id, { payRef: "pay_1" }));
    expect(second.status).toBe(409);
    expect(second.body.error).toContain(first.body.number);
    expect((await u.get("/api/projects")).body[0].payments).toHaveLength(1);
  });

  test("two different receipts add two payments", async () => {
    const u = await signup(app);
    const p = await project(u);
    await u.post("/api/documents", receipt(p.id));
    await u.post("/api/documents", receipt(p.id, { amount: 250, payType: "partial" }, { total: 250 }));
    const pr = (await u.get("/api/projects")).body[0];
    expect(pr.payments).toHaveLength(2);
    expect(pr.paid).toBe(350);
  });

  test("an unconfirmed receipt does not touch the project", async () => {
    const u = await signup(app);
    const p = await project(u);
    await u.post("/api/documents", receipt(p.id, { confirmed: false }));
    expect((await u.get("/api/projects")).body[0].payments).toEqual([]);
  });

  test("old projects with only a 'paid' number keep that money", async () => {
    const u = await signup(app);
    const raw = (await u.post("/api/projects", { name: "Old", paid: 40 })).body;
    await u.post("/api/documents", receipt(raw.id, { amount: 60 }));
    const pr = (await u.get("/api/projects")).body[0];
    expect(pr.payments).toHaveLength(2);
    expect(pr.paid).toBe(100);
  });

  test("a bad amount or a missing project is refused and nothing is saved", async () => {
    const u = await signup(app);
    const p = await project(u);
    expect((await u.post("/api/documents", receipt(p.id, { amount: 0 }))).status).toBe(400);
    expect((await u.post("/api/documents", receipt("nope"))).status).toBe(400);
    expect((await u.get("/api/documents")).body).toHaveLength(0);
  });
});
