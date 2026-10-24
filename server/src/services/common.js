import { randomUUID } from "node:crypto";

export const newId = () => randomUUID().replace(/-/g, "").slice(0, 20);
export const r2 = (x) => Math.round((+x || 0) * 100) / 100;

// Keys the server owns. Clients can't set them inside a project's data.
const RESERVED = new Set(["id", "_id", "userId", "createdAt", "updatedAt"]);
export const stripReserved = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !RESERVED.has(k)));

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

// Same flat shape the prototype stored: the project's own fields plus id and dates.
export const projectOut = (p) => ({ ...p.data, id: p._id, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });

export const docOut = (d) => ({
  id: d._id, type: d.type, number: d.number, status: d.status, projectId: d.projectId, client: d.client,
  total: d.total, date: d.date, data: d.data, createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt),
});
