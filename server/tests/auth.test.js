import request from "supertest";
import { startDb, stopDb, clearDb, makeApp, signup } from "./helpers.js";

const app = makeApp();
beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const reg = (b) => request(app).post("/api/auth/register").send(b);

describe("register", () => {
  test("the first user can register without a code, and the password is hashed", async () => {
    const r = await reg({ email: "Me@Example.com", password: "password123" });
    expect(r.status).toBe(201);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.email).toBe("me@example.com");
    const { User } = await import("../src/models/index.js");
    const u = await User.findOne({ email: "me@example.com" });
    expect(u.passwordHash).not.toBe("password123");
    expect(u.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  test("a second user is refused without the invite code", async () => {
    await signup(app);
    const r = await reg({ email: "b@example.com", password: "password123" });
    expect(r.status).toBe(403);
    const wrong = await reg({ email: "b@example.com", password: "password123", inviteCode: "nope" });
    expect(wrong.status).toBe(403);
  });

  test("a second user can register with the right invite code", async () => {
    await signup(app);
    const r = await reg({ email: "b@example.com", password: "password123", inviteCode: "let-me-in" });
    expect(r.status).toBe(201);
  });

  test("registration stays closed when no INVITE_CODE is set", async () => {
    const closed = makeApp({ inviteCode: undefined });
    await request(closed).post("/api/auth/register").send({ email: "a@example.com", password: "password123" });
    const r = await request(closed).post("/api/auth/register").send({ email: "b@example.com", password: "password123", inviteCode: "" });
    expect(r.status).toBe(403);
  });

  test("rejects a bad email and a short password with clear messages", async () => {
    const r = await reg({ email: "not-an-email", password: "short" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/valid email/i);
    expect(r.body.error).toMatch(/at least 8/i);
  });

  test("rejects a duplicate email", async () => {
    await signup(app);
    const r = await reg({ email: "a@example.com", password: "password123", inviteCode: "let-me-in" });
    expect(r.status).toBe(409);
  });
});

describe("login and /me", () => {
  test("login returns a token that works on /api/me", async () => {
    await signup(app);
    const l = await request(app).post("/api/auth/login").send({ email: "A@example.com", password: "password123" });
    expect(l.status).toBe(200);
    const me = await request(app).get("/api/me").set("Authorization", `Bearer ${l.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("a@example.com");
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash/);
  });

  test("wrong password and unknown email give the same error", async () => {
    await signup(app);
    const a = await request(app).post("/api/auth/login").send({ email: "a@example.com", password: "wrong-password" });
    const b = await request(app).post("/api/auth/login").send({ email: "who@example.com", password: "password123" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  test("routes need a valid token", async () => {
    for (const path of ["/api/me", "/api/projects", "/api/documents", "/api/settings", "/api/backup"]) {
      expect((await request(app).get(path)).status).toBe(401);
    }
    const bad = await request(app).get("/api/projects").set("Authorization", "Bearer garbage");
    expect(bad.status).toBe(401);
  });

  test("auth routes are rate-limited", async () => {
    const limited = makeApp({ authRateMax: 3 });
    let last;
    for (let i = 0; i < 5; i++) last = await request(limited).post("/api/auth/login").send({ email: "a@example.com", password: "x" });
    expect(last.status).toBe(429);
  });
});
