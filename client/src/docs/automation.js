/* Port of reference/docs3.js: what each document change means for the project.
   Pure functions, so they can be tested without a screen. */
import { PHASES } from "../constants.js";
import { todayStr } from "../lib/format.js";
import { r2 } from "./helpers.js";

export const PH = { proposalSent: 4, proposalOk: 5, contract: 6, invoiceSent: 7, deposit: 8, content: 9, launched: 14 };

// What a saved document should change on its project, or null. prev is { status, confirmed } from before this save.
export function planFor(doc, prev) {
  const s = doc.status, d = doc.data || {}, t = doc.type, changed = (v) => s === v && prev.status !== v;
  if (t === "proposal") {
    if (changed("Sent")) return { phase: PH.proposalSent, next: "Follow up on the proposal", wait: "client", why: "Proposal sent" };
    if (changed("Accepted")) return { phase: PH.proposalOk, next: "Send the contract", wait: "me", why: "Proposal accepted", scope: true };
    if (changed("Declined")) return { next: "Update the proposal with the client's changes", wait: "me", why: "Proposal declined" };
  }
  if (t === "agreement") {
    if (changed("Sent")) return { phase: PH.proposalOk, next: "Wait for the signed contract", wait: "client", why: "Agreement sent" };
    if (changed("Signed")) return { phase: PH.contract, next: "Send the deposit invoice", wait: "me", why: "Agreement signed" };
  }
  if (t === "invoice" && changed("Sent")) {
    if (d.kind === "deposit") return { phase: PH.invoiceSent, next: "Wait for the deposit", wait: "client", why: "Deposit invoice sent" };
    if (d.kind === "final") return { next: "Collect the final payment", wait: "client", why: "Final invoice sent" };
    return { wait: "client", why: "Invoice sent" };
  }
  if (t === "receipt" && d.confirmed && !prev.confirmed) {
    if (d.payType === "deposit") return { phase: PH.deposit, next: "Send the content checklist", wait: "me", why: "Deposit received" };
    if (d.payType === "full") return { next: "Hand over the website and logins", wait: "me", why: "Paid in full" };
    return { wait: "me", why: "Payment received" };
  }
  if (t === "content" && changed("Sent")) return { phase: PH.content, next: "Collect content from the client", wait: "client", why: "Content checklist sent" };
  if (t === "handover" && (changed("Delivered") || changed("Signed")) && !["Delivered", "Signed"].includes(prev.status)) return { phase: PH.launched, next: "Request a testimonial", wait: "me", why: "Website handed over" };
  if (t === "testimonial") {
    if (prev.status == null) return { next: "Request a testimonial", wait: "client", why: "Testimonial requested" };
    if (changed("Received") || changed("Approved to share")) return { next: "Post the project on my portfolio and socials", wait: "me", why: "Testimonial received" };
  }
  return null;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Works out the change to a project after a document is saved.
 * Returns { patch, undo, notes }. patch is what to write; undo holds the old value of each changed field
 * ({ __unset: true } for a field that did not exist). notes are the words for the notice (empty = no notice).
 * Moves forward only: a phase is set only when it is later than the current one.
 */
export function computeAutomation({ project: p, doc, prev, autoMove = true, today = todayStr() }) {
  const patch = {}, undo = {}, notes = [];
  const set = (k, v) => { if (same(p[k], v)) return; patch[k] = v; undo[k] = p[k] === undefined ? { __unset: true } : clone(p[k]); };
  // the content checklist always keeps the project's Content tab in sync
  if (doc.type === "content") set("content", (doc.data.items || []).filter((i) => i.status !== "no" && String(i.label || "").trim()).map((i) => ({ label: i.label, done: i.status === "rec" || i.status === "ok" })));
  const plan = autoMove ? planFor(doc, prev) : null;
  if (plan) {
    if (plan.phase != null && plan.phase > (p.phase || 0)) {
      set("phase", plan.phase);
      set("phaseDates", { ...(p.phaseDates || {}), [plan.phase]: today });
      notes.push(`moved to “${PHASES[plan.phase] ? PHASES[plan.phase][1] : `phase ${plan.phase + 1}`}”`);
    }
    if (plan.next && plan.next !== p.nextStep) { set("nextStep", plan.next); notes.push(`next: ${plan.next}`); }
    if (plan.wait && plan.wait !== p.waitingOn) { set("waitingOn", plan.wait); set("waitingSince", plan.wait === "client" ? today : ""); }
    else if (plan.wait === "client" && plan.next) set("waitingSince", today);
    if (plan.scope && !(Array.isArray(p.scope) && p.scope.length) && !(+p.price > 0)) {
      const items = (doc.data.items || []).filter((l) => String(l.item || "").trim() || +l.price).map((l) => ({ item: l.item, price: +l.price || 0 }));
      if (items.length) {
        set("scope", items); set("price", r2(items.reduce((s, l) => s + l.price, 0)));
        if (doc.data.plan === "deposit") set("depositPct", doc.data.depositPct);
        notes.push("price added from the proposal");
      }
    }
  }
  return { patch, undo, notes };
}

// The project body after undoing: every field the automation changed goes back to how it was.
export function applyUndo(current, undo) {
  const body = clone(current);
  delete body.id; delete body.createdAt; delete body.updatedAt;
  Object.entries(undo).forEach(([k, v]) => { if (v && v.__unset) delete body[k]; else body[k] = v; });
  return body;
}
