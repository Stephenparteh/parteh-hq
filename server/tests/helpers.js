import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { User, Project, Document, Settings, Counter } from "../src/models/index.js";

let mongod;
export const config = { jwtSecret: "test-secret-test-secret", inviteCode: "let-me-in", clientOrigin: "http://localhost:5173", authRateMax: 1000 };

export async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Make sure the unique indexes exist before any test runs.
  await Promise.all([User, Project, Document, Settings, Counter].map((m) => m.init()));
}
export async function stopDb() {
  await mongoose.disconnect();
  await mongod.stop();
}
export async function clearDb() {
  await Promise.all([User, Project, Document, Settings, Counter].map((m) => m.deleteMany({})));
}

export const makeApp = (over = {}) => createApp({ ...config, ...over });

// Registers a user and returns a supertest agent helper that sends their token.
export async function signup(app, email = "a@example.com", password = "password123", inviteCode) {
  const r = await request(app).post("/api/auth/register").send({ email, password, inviteCode });
  if (r.status !== 201) throw new Error(`signup failed: ${r.status} ${JSON.stringify(r.body)}`);
  const auth = (req) => req.set("Authorization", `Bearer ${r.body.token}`);
  return {
    token: r.body.token, user: r.body.user,
    get: (u) => auth(request(app).get(u)),
    post: (u, b) => auth(request(app).post(u)).send(b),
    put: (u, b) => auth(request(app).put(u)).send(b),
    patch: (u, b) => auth(request(app).patch(u)).send(b),
    del: (u) => auth(request(app).delete(u)),
  };
}
