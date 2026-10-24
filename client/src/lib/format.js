import { PHASES, LAST } from "../constants.js";

export const defaultSettings = {
  bizName: "Stephen Parteh", tagline: "Web Developer", service: "Website Design & Development", email: "stephenparteh@gmail.com",
  phone: "0886895261 / 0775150941", portfolio: "stephenparteh.vercel.app", payInfo: "", about: "", formLink: "", goal: 150, depositPct: 10,
};
// Same as the prototype's S(): defaults, then whatever is saved.
export const withDefaults = (doc) => ({ ...defaultSettings, ...doc });

export const todayStr = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const year = () => new Date().getFullYear();
export const fmtDate = (s) => { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T00:00:00"); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
export const money = (n) => "$" + (Math.round((+n || 0) * 100) / 100).toLocaleString();
export const firstName = (s) => String(s || "").trim().split(/\s+/)[0] || "there";
export const safeName = (s) => String(s).replace(/[^\w\- .]+/g, "");

export const stageOf = (p) => PHASES[p.phase || 0][0];
export const paidOf = (p) => (Array.isArray(p.payments) && p.payments.length ? p.payments.reduce((s, x) => s + (+x.amount || 0), 0) : (+p.paid || 0));
export const totalOf = (p) => (Array.isArray(p.scope) && p.scope.length ? p.scope.reduce((s, x) => s + (+x.price || 0), 0) : (+p.price || 0));
export const depositOf = (p, defaultPct) => Math.ceil(totalOf(p) * (+(p.depositPct ?? defaultPct) || 0) / 100);
export const pctOf = (p) => Math.round((p.phase || 0) / LAST * 100);

// Days a client has been quiet. -1 means "not waiting on the client".
export function waitDays(p) {
  if (p.waitingOn !== "client" || p.status !== "active" || p.phase >= LAST) return -1;
  const s = p.waitingSince || p.updatedAt;
  if (!s) return 0;
  return Math.max(0, Math.floor((new Date(todayStr()) - new Date(String(s).slice(0, 10))) / 864e5));
}
export const liveProjects = (projects) => projects.filter((p) => p.status !== "lost");
