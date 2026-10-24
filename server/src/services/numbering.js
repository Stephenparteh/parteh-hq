import { Counter, PREFIXES } from "../models/index.js";

// Atomically take the next number for (user, type, year). Two saves at the same moment
// each get a different value, because $inc happens inside MongoDB.
export async function nextSeq(userId, type, year = new Date().getFullYear()) {
  const _id = `${userId}:${type}:${year}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const c = await Counter.findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
      return c.seq;
    } catch (e) {
      // Two first-ever saves can both try to create the counter. One loses, so retry.
      if (e.code === 11000 && attempt < 5) continue;
      throw e;
    }
  }
}

export const formatNumber = (type, year, seq) => `${PREFIXES[type]}-${year}-${String(seq).padStart(3, "0")}`;

export async function nextNumber(userId, type) {
  const year = new Date().getFullYear();
  return formatNumber(type, year, await nextSeq(userId, type, year));
}

// After a backup import, make sure new numbers continue after the highest imported one.
export async function bumpCounters(userId, numbers) {
  const max = new Map();
  const inv = Object.fromEntries(Object.entries(PREFIXES).map(([t, p]) => [p, t]));
  for (const n of numbers) {
    const m = /^([A-Z]{3})-(\d{4})-(\d+)$/.exec(n || "");
    if (!m || !inv[m[1]]) continue;
    const key = `${userId}:${inv[m[1]]}:${m[2]}`;
    max.set(key, Math.max(max.get(key) || 0, +m[3]));
  }
  for (const [_id, seq] of max) {
    await Counter.updateOne({ _id }, { $max: { seq } }, { upsert: true });
  }
}
