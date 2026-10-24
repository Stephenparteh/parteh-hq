import { PHASES, GATE, ALL_NEXT, WAIT, SUGGEST } from "../constants.js";
import { todayStr, paidOf } from "./format.js";

export const blankProject = (s) => ({
  name: "", client: "", contactName: "", contact: "", type: "Website", billing: "paid", source: "", referredBy: "", startDate: todayStr(),
  price: "", depositPct: s.depositPct, scope: [], payments: [], content: [], waitingOn: "me", status: "active",
  nextStep: "Send the intake Google Form", notes: "", brief: "", proposal: "", phase: 0, phaseDates: { 0: todayStr() },
});

// Fill in anything an older project is missing (same as the prototype's openSheet).
export function toDraft(p, s) {
  const d = JSON.parse(JSON.stringify(p || blankProject(s)));
  if (!Array.isArray(d.payments)) { d.payments = []; if (+d.paid > 0) d.payments.push({ date: todayStr(), amount: +d.paid, note: "Earlier payment" }); }
  if (!Array.isArray(d.scope)) d.scope = [];
  if (!Array.isArray(d.content)) d.content = [];
  if (d.depositPct == null) d.depositPct = s.depositPct;
  return d;
}

// The deposit gate: no work past "Deposit paid" until a payment is logged (paid projects only).
export const gateBlocks = (d, i) => i > GATE && d.phase <= GATE && d.billing === "paid" && paidOf(d) <= 0;

// Tapping a phase. Returns a new draft, or null when the gate stops it.
export function movePhase(d, i) {
  if (gateBlocks(d, i)) return null;
  const n = { ...d, phase: i, phaseDates: { ...(d.phaseDates || {}) } };
  if (!n.phaseDates[i]) n.phaseDates[i] = todayStr();
  Object.keys(n.phaseDates).forEach((k) => { if (+k > i) delete n.phaseDates[k]; });
  if (!n.nextStep || ALL_NEXT.includes(n.nextStep)) {
    const s = SUGGEST[i];
    if (s) { n.nextStep = s; n.waitingOn = WAIT.has(s) ? "client" : "me"; n._customNext = false; }
  }
  return n;
}

// Picking from the next-step dropdown. A listed step also decides who the project is waiting on.
export function pickNextStep(d, value) {
  const n = { ...d };
  if (value === "__custom") { n._customNext = true; if (ALL_NEXT.includes(n.nextStep)) n.nextStep = ""; }
  else { n._customNext = false; n.nextStep = value; if (value) n.waitingOn = WAIT.has(value) ? "client" : "me"; }
  return n;
}

// What gets sent to the server when the sheet is saved. orig is the project as it was (or null for a new one).
export function prepareForSave(draft, orig) {
  const d = JSON.parse(JSON.stringify(draft));
  d.name = String(d.name).trim();
  d.scope = d.scope.map((l) => ({ ...l, price: +l.price || 0 })).filter((l) => String(l.item).trim() || +l.price);
  d.price = d.scope.length ? d.scope.reduce((s, l) => s + l.price, 0) : (d.price === "" ? "" : +d.price || 0);
  d.payments = d.payments.map((x) => ({ ...x, amount: +x.amount || 0 })).filter((x) => +x.amount);
  // The prototype kept the old "paid" number when every payment was removed. Here paid always equals the payments.
  d.paid = d.payments.reduce((s, x) => s + x.amount, 0);
  d.depositPct = d.depositPct === "" ? "" : +d.depositPct || 0;
  if (d.waitingOn === "client") {
    if (!orig || orig.waitingOn !== "client" || !d.waitingSince) d.waitingSince = (orig && orig.waitingOn === "client" && orig.waitingSince) || todayStr();
  } else d.waitingSince = "";
  if (!orig || orig.phase !== d.phase) d.waitingSince = d.waitingOn === "client" ? todayStr() : "";
  delete d._customNext; delete d.id; delete d.createdAt; delete d.updatedAt;
  return d;
}

export const phaseName = (i) => (PHASES[i] ? PHASES[i][1] : `phase ${i + 1}`);
