import { vi } from "vitest";

// A tiny in-memory stand-in for the server, wired in through fetch.
const PREFIX = { proposal: "PRO", invoice: "INV", receipt: "RCT", agreement: "AGR", timeline: "TML", content: "CNT", revision: "REV", handover: "HND", testimonial: "TST" };

export function installFakeApi({ projects = [], settings = {}, docs = [], password = "secret123", email = "me@example.com" } = {}) {
  const db = { projects: projects.map((p) => ({ ...p })), settings: { ...settings }, docs: docs.map((d) => ({ ...d })), calls: [], failNext: null, seq: {} };
  let n = 0;
  // A small copy of the server's receipt rule: a confirmed receipt adds (or updates) one payment on its project.
  function syncReceipt(doc) {
    if (doc.type !== "receipt" || !doc.data.confirmed || !doc.projectId) return;
    const p = db.projects.find((x) => x.id === doc.projectId); if (!p) return;
    p.payments = p.payments || [];
    let pay = p.payments.find((x) => x.receiptNo === doc.number) || (doc.data.payRef && p.payments.find((x) => x.id === doc.data.payRef));
    if (!pay) { pay = { id: "pay_" + ++n }; p.payments.push(pay); }
    Object.assign(pay, { date: doc.data.date, amount: +doc.data.amount, note: "Payment", receiptNo: doc.number, invoiceNo: doc.data.invoiceNo || "" });
    doc.data.payRef = pay.id; p.paid = p.payments.reduce((t, x) => t + (+x.amount || 0), 0);
  }
  const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

  vi.stubGlobal("fetch", vi.fn(async (url, init = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    db.calls.push({ method, path, body });
    if (db.failNext && db.failNext.test(`${method} ${path}`)) { db.failNext = null; return json(500, { error: "Something went wrong on the server." }); }

    if (path === "/api/auth/login") {
      return body.email === email && body.password === password
        ? json(200, { token: "tok", user: { id: "u1", email } })
        : json(401, { error: "Wrong email or password." });
    }
    if (!/^Bearer tok$/.test(init.headers?.Authorization || "")) return json(401, { error: "Please log in." });
    if (path === "/api/projects" && method === "GET") return json(200, db.projects);
    if (path === "/api/projects" && method === "POST") {
      const p = { ...body, id: `p${++n}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.projects.unshift(p); return json(201, p);
    }
    const m = /^\/api\/projects\/(\w+)$/.exec(path);
    if (m) {
      const i = db.projects.findIndex((p) => p.id === m[1]);
      if (i < 0) return json(404, { error: "Project not found." });
      if (method === "PUT") db.projects[i] = { ...body, id: m[1], createdAt: db.projects[i].createdAt, updatedAt: new Date().toISOString() };
      else if (method === "PATCH") db.projects[i] = { ...db.projects[i], ...body, updatedAt: new Date().toISOString() };
      else if (method === "DELETE") { db.projects.splice(i, 1); return json(200, { ok: true }); }
      return json(200, db.projects[i]);
    }
    if (path === "/api/documents" && method === "GET") return json(200, db.docs);
    if (path === "/api/documents" && method === "POST") {
      const key = body.type; db.seq[key] = (db.seq[key] || db.docs.filter((x) => x.type === key).length) + 1;
      const number = `${PREFIX[key]}-${new Date().getFullYear()}-${String(db.seq[key]).padStart(3, "0")}`;
      const now = new Date().toISOString(), doc = { ...body, id: `d${++n}`, number, createdAt: now, updatedAt: now, data: { ...body.data, number } };
      syncReceipt(doc); db.docs.unshift(doc); return json(201, doc);
    }
    const dm = /^\/api\/documents\/(\w+)$/.exec(path);
    if (dm) {
      const i = db.docs.findIndex((x) => x.id === dm[1]);
      if (i < 0) return json(404, { error: "Document not found." });
      if (method === "DELETE") { db.docs.splice(i, 1); return json(200, { ok: true }); }
      const doc = { ...db.docs[i], ...body, id: dm[1], number: db.docs[i].number, updatedAt: new Date().toISOString() }; doc.data = { ...body.data, number: doc.number };
      syncReceipt(doc); db.docs[i] = doc; return json(200, doc);
    }
    if (path === "/api/settings" && method === "GET") return json(200, db.settings);
    if (path === "/api/settings" && method === "PUT") { db.settings = body; return json(200, body); }
    return json(404, { error: "Not found" });
  }));
  return db;
}
