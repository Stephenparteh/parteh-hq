import { startDb, stopDb, clearDb, makeApp, signup } from "./helpers.js";
import { handoverHasPassword } from "../src/services/handover.js";

describe("password check", () => {
  test("catches typed passwords", () => {
    expect(handoverHasPassword({ limitations: "admin password: 1234" })).toBe(true);
    expect(handoverHasPassword({ limitations: "the password is hello1" })).toBe(true);
    expect(handoverHasPassword({ deliverables: "Admin PIN = 4455" })).toBe(true);
  });
  test("ignores harmless text", () => {
    expect(handoverHasPassword({ limitations: "Password reset guide" })).toBe(false);
    expect(handoverHasPassword({ manage: "change passwords if someone leaves" })).toBe(false);
    expect(handoverHasPassword({ password: "" , accessMethod: "Login details will be shared with you privately by phone." })).toBe(false);
  });
});

describe("handover route", () => {
  const app = makeApp();
  beforeAll(startDb); afterAll(stopDb); beforeEach(clearDb);
  test("refuses to store a password, on create and update", async () => {
    const u = await signup(app);
    const bad = await u.post("/api/documents", { type: "handover", data: { limitations: "the password is hello1" } });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/password/i);
    const ok = await u.post("/api/documents", { type: "handover", data: { limitations: "None" } });
    expect(ok.status).toBe(201);
    const up = await u.put(`/api/documents/${ok.body.id}`, { type: "handover", data: { deliverables: "admin password: 1234" } });
    expect(up.status).toBe(400);
    expect((await u.get("/api/documents")).body[0].data.limitations).toBe("None");
  });
  test("other types may mention passwords", async () => {
    const u = await signup(app);
    expect((await u.post("/api/documents", { type: "content", data: { note: "send password: no" } })).status).toBe(201);
  });
});
