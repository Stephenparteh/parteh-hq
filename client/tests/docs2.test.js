import { describe, test, expect } from "vitest";
import { createKit } from "../src/docs/kit.js";
import * as HO from "../src/docs/templates/handover.js";
import { planFor, computeAutomation, applyUndo } from "../src/docs/automation.js";
import { withDefaults } from "../src/lib/format.js";
import { clean } from "../src/docs/engine.js";

const settings = withDefaults({ payInfo: "Orange Money: 0770 000 000" });
const mkKit = (over = {}) => createKit(() => ({ projects: [], docs: [], settings, today: () => "2026-05-01", ...over }));

describe("empty forms still build", () => {
  test("every type makes a blank document and builds without throwing, even with an empty date", () => {
    const kit = mkKit();
    for (const [type, T] of Object.entries(kit.TY)) {
      const doc = T.make("", {});
      doc.data.date = ""; if ("startDate" in doc.data) doc.data.startDate = "";
      if (T.messageOnly) continue;
      expect(() => T.build(doc.data, doc), type).not.toThrow();
      expect(() => T.check(doc.data, doc), type).not.toThrow();
    }
  });
});

describe("emoji are removed so the preview matches the PDF", () => {
  test("normal text is never touched", () => {
    for (const t of ["Revision log", "Review: Pages p{x} + 123 & more", "Café Ñandú <Ltd>", "Phone / WhatsApp  0886895261"]) expect(clean(t)).toBe(t.replace(/ {2,}/g, " "));
  });
  test("emoji and skin tones go, and no gap is left before punctuation", () => {
    expect(clean("Site 💻")).toBe("Site");
    expect(clean("Thank you 🙏🏾")).toBe("Thank you");
    expect(clean("We build 🎉 , fast .")).toBe("We build, fast.");
    expect(clean(null)).toBe("");
  });
});

describe("password check", () => {
  test("catches typed passwords", () => {
    expect(HO.block({ limitations: "admin password: 1234" })).toHaveLength(1);
    expect(HO.block({ limitations: "the password is hello1" })).toHaveLength(1);
    expect(HO.block({ deliverables: "Admin PIN = 4455" })).toHaveLength(1);
  });
  test("ignores harmless text", () => {
    expect(HO.block({ limitations: "Password reset guide" })).toEqual([]);
    expect(HO.block({ manage: ["change passwords if someone leaves"] })).toEqual([]);
    expect(HO.block(HO.MANAGE.map((m) => m[1]))).toEqual([]);
  });
});

describe("invoice status comes from confirmed receipts", () => {
  const inv = (over = {}) => ({ id: "i1", type: "invoice", number: "INV-2026-001", status: "Sent", total: 100, projectId: "p1", data: { date: "2026-04-01", dueDays: 7 }, ...over });
  const rc = (amount, over = {}) => ({ id: "r" + Math.random(), type: "receipt", data: { confirmed: true, amount, invoiceNo: "INV-2026-001" }, ...over });
  const state = (invoice, docs) => mkKit({ docs: [invoice, ...docs] }).invoiceState(invoice)[0];

  test("sent and past due with no receipts is Overdue; an invoice is never proof of payment", () => {
    expect(state(inv(), [])).toBe("Overdue");
  });
  test("not due yet stays Sent; a draft stays Draft", () => {
    expect(state(inv({ data: { date: "2026-05-01", dueDays: 7 } }), [])).toBe("Sent");
    expect(state(inv({ status: "Draft" }), [])).toBe("Draft");
  });
  test("part of the money is Partly paid, all of it is Paid", () => {
    expect(state(inv(), [rc(40)])).toBe("Partly paid");
    expect(state(inv(), [rc(40), rc(60)])).toBe("Paid");
    expect(state(inv(), [rc(100.5)])).toBe("Paid");
  });
  test("unconfirmed receipts and receipts for another invoice do not count", () => {
    expect(state(inv(), [rc(100, { data: { confirmed: false, amount: 100, invoiceNo: "INV-2026-001" } })])).toBe("Overdue");
    expect(state(inv(), [rc(100, { data: { confirmed: true, amount: 100, invoiceNo: "INV-2026-099" } })])).toBe("Overdue");
  });
  test("a cancelled invoice stays Cancelled", () => {
    expect(state(inv({ status: "Cancelled" }), [rc(100)])).toBe("Cancelled");
  });
  test("what is still owed", () => {
    const kit = mkKit({ docs: [inv(), rc(30)] });
    expect(kit.owedOn(inv())).toBe(70);
  });
});

describe("receipts", () => {
  const kit = mkKit({ projects: [{ id: "p1", name: "Site", payments: [{ id: "pay_1", amount: 50, receiptNo: "RCT-2026-001" }] }] });
  const base = { org: "Client", amount: 50, method: "Cash", date: "2026-05-01", confirmed: true };

  test("cannot be saved or exported without the confirm tick", () => {
    const T = kit.TY.receipt, d = { ...base, confirmed: false };
    expect(T.check(d, { projectId: "", number: "" }).join(" ")).toMatch(/I confirm I have received this money/);
    expect(T.hard).toBe(true); // hard = the warnings block saving, so Save PDF stays disabled
    expect(T.check({ ...base }, { projectId: "", number: "" })).toEqual([]);
  });
  test("a second receipt for the same payment is refused", () => {
    const T = kit.TY.receipt, cur = { projectId: "p1", number: "RCT-2026-002", data: { ...base, payRef: "pay_1" } };
    expect(T.check(cur.data, cur)).toContain("This payment already has receipt RCT-2026-001.");
    const same = { projectId: "p1", number: "RCT-2026-001", data: { ...base, payRef: "pay_1" } };
    expect(T.check(same.data, same)).toEqual([]);
  });
  test("the type is suggested from the project balance", () => {
    const k = mkKit({ projects: [{ id: "p1", name: "Site", price: 300, payments: [] }] });
    const d = { amount: 90, payRef: "new", invoiceNo: "" };
    k.guessReceipt(d, "p1"); expect(d.payType).toBe("deposit");
    const k2 = mkKit({ projects: [{ id: "p1", name: "Site", price: 300, payments: [{ id: "a", amount: 90 }] }] });
    const e = { amount: 100, payRef: "new" }; k2.guessReceipt(e, "p1"); expect(e.payType).toBe("partial");
    const f = { amount: 210, payRef: "new" }; k2.guessReceipt(f, "p1"); expect(f.payType).toBe("full");
    expect(f.description).toMatch(/^Final payment for Site/);
  });
});

describe("automation", () => {
  const project = (over = {}) => ({ id: "p1", name: "Site", phase: 3, nextStep: "Send the proposal", waitingOn: "me", waitingSince: "", phaseDates: { 0: "2026-01-01" }, scope: [], price: "", ...over });
  const run = (p, doc, prev, extra = {}) => computeAutomation({ project: p, doc, prev, today: "2026-05-01", ...extra });
  const prop = (status, data = {}) => ({ type: "proposal", status, projectId: "p1", data });

  test("proposal Sent moves to phase 4 and waits on the client", () => {
    const r = run(project(), prop("Sent"), { status: "Draft" });
    expect(r.patch).toMatchObject({ phase: 4, nextStep: "Follow up on the proposal", waitingOn: "client", waitingSince: "2026-05-01" });
    expect(r.patch.phaseDates).toEqual({ 0: "2026-01-01", 4: "2026-05-01" });
    expect(r.notes.join(" ")).toMatch(/moved to “Proposal sent”/);
  });
  test("moves forward only, never back", () => {
    const r = run(project({ phase: 9 }), prop("Sent"), { status: "Draft" });
    expect(r.patch.phase).toBeUndefined();
    expect(r.patch.nextStep).toBe("Follow up on the proposal");
    expect(run(project({ phase: 5 }), prop("Accepted"), { status: "Sent" }).patch.phase).toBeUndefined();
  });
  test("nothing happens when the status did not change", () => {
    expect(run(project(), prop("Sent"), { status: "Sent" }).patch).toEqual({});
    expect(planFor(prop("Draft"), { status: "Draft" })).toBeNull();
  });
  test("each step of the journey", () => {
    const step = (doc, prev, p = project()) => run(p, doc, prev).patch;
    expect(step(prop("Accepted"), { status: "Sent" }).phase).toBe(5);
    expect(step({ type: "agreement", status: "Signed", data: {} }, { status: "Sent" }, project({ phase: 5 })).phase).toBe(6);
    expect(step({ type: "invoice", status: "Sent", data: { kind: "deposit" } }, { status: "Draft" }, project({ phase: 6 })).phase).toBe(7);
    expect(step({ type: "receipt", status: "Issued", data: { confirmed: true, payType: "deposit" } }, { status: "Issued", confirmed: false }, project({ phase: 7 })).phase).toBe(8);
    expect(step({ type: "content", status: "Sent", data: { items: [] } }, { status: "Draft" }, project({ phase: 8 })).phase).toBe(9);
    expect(step({ type: "handover", status: "Delivered", data: {} }, { status: "Draft" }, project({ phase: 13 })).phase).toBe(14);
  });
  test("a final invoice or a full payment only changes the next step", () => {
    expect(run(project({ phase: 12 }), { type: "invoice", status: "Sent", data: { kind: "final" } }, { status: "Draft" }).patch).toMatchObject({ nextStep: "Collect the final payment", waitingOn: "client" });
    const r = run(project({ phase: 12 }), { type: "receipt", status: "Issued", data: { confirmed: true, payType: "full" } }, { confirmed: false });
    expect(r.patch.phase).toBeUndefined();
    expect(r.patch.nextStep).toBe("Hand over the website and logins");
  });
  test("a receipt that was already confirmed does nothing again", () => {
    expect(run(project({ phase: 7 }), { type: "receipt", status: "Issued", data: { confirmed: true, payType: "deposit" } }, { status: "Issued", confirmed: true }).patch).toEqual({});
  });
  test("an accepted proposal copies its items in only when the project has no price", () => {
    const doc = prop("Accepted", { plan: "deposit", depositPct: 30, items: [{ item: "Site", price: 200 }, { item: "Form", price: 50 }, { item: "", price: 0 }] });
    expect(run(project(), doc, { status: "Sent" }).patch).toMatchObject({ scope: [{ item: "Site", price: 200 }, { item: "Form", price: 50 }], price: 250, depositPct: 30 });
    expect(run(project({ price: 100 }), doc, { status: "Sent" }).patch.scope).toBeUndefined();
    expect(run(project({ scope: [{ item: "x", price: 5 }] }), doc, { status: "Sent" }).patch.price).toBeUndefined();
  });
  test("Undo restores the project exactly as it was", () => {
    const p = project({ extra: "kept" });
    delete p.waitingSince; // a field that did not exist before must be removed again
    const doc = prop("Accepted", { plan: "deposit", depositPct: 30, items: [{ item: "Site", price: 200 }] });
    const { patch, undo } = run(p, doc, { status: "Sent" });
    const after = { ...p, ...patch };
    expect(after.phase).toBe(5);
    const back = applyUndo(after, undo);
    const original = JSON.parse(JSON.stringify(p)); delete original.id;
    expect(back).toEqual(original);
    expect("waitingSince" in back).toBe(false);
  });
  test("the setting turns moving forward off", () => {
    const r = run(project(), prop("Sent"), { status: "Draft" }, { autoMove: false });
    expect(r.patch).toEqual({});
    expect(r.notes).toEqual([]);
  });
  test("a saved content checklist always updates the project's Content tab", () => {
    const doc = { type: "content", status: "Draft", data: { items: [{ label: "Logo", status: "rec" }, { label: "Photos", status: "req" }, { label: "Videos", status: "no" }, { label: "Colors", status: "ok" }, { label: "  ", status: "req" }] } };
    const on = run(project(), doc, { status: null });
    expect(on.patch.content).toEqual([{ label: "Logo", done: true }, { label: "Photos", done: false }, { label: "Colors", done: true }]);
    expect(on.notes).toEqual([]); // no notice, no phase change
    expect(run(project(), doc, { status: null }, { autoMove: false }).patch.content).toHaveLength(3);
  });
});

describe("making documents from a project", () => {
  const project = { id: "p1", name: "Christ Life website", client: "Christ Life Pentecostal Church", contactName: "Joe", contact: "0770", depositPct: 30,
    scope: [{ item: "Site", price: 200 }, { item: "Form", price: 100 }], payments: [{ id: "pay_1", date: "2026-02-01", amount: 90, note: "Deposit" }] };
  const kit = mkKit({ projects: [project] });

  test("a proposal takes the project's price and spots a church from the name", () => {
    const d = kit.newProposal("p1").data;
    expect(d.items).toEqual([{ item: "Site", price: 200 }, { item: "Form", price: 100 }]);
    expect(d.siteType).toBe("Church / ministry website");
    expect(d.industry).toBe("Church / ministry");
    expect(d.depositPct).toBe(30);
  });
  test("each invoice kind fills its own items", () => {
    const dep = kit.newInvoice("p1", "deposit").data;
    expect(dep.items).toEqual([{ desc: "Deposit (30%) for Christ Life website", qty: 1, rate: 90 }]);
    const fin = kit.newInvoice("p1", "final").data;
    expect(fin.items.map((i) => i.rate)).toEqual([200, 100]);
    expect(fin.paidBefore).toBe(90);
    const mile = kit.newInvoice("p1", "deposit").data; mile.kind = "milestone"; kit.fillInvoice(mile, "p1");
    expect(mile.items[0]).toMatchObject({ desc: "Milestone payment: Design approval (40%)", rate: 120 });
    expect(kit.newInvoice("", "additional").data.items).toEqual([{ desc: "", qty: 1, rate: 0 }]);
  });
  test("a receipt picks the first payment with no receipt and shows the project balance", () => {
    const d = kit.newReceipt("p1").data;
    expect(d).toMatchObject({ amount: 90, payRef: "pay_1", payType: "deposit" });
    kit.prepReceipt(d, "p1");
    expect(d).toMatchObject({ projectTotal: 300, paidToDate: 90 });
  });
  test("an agreement fills in from the accepted proposal", () => {
    const prop = { id: "d1", type: "proposal", projectId: "p1", status: "Accepted", number: "PRO-2026-001", updatedAt: "2026-01-02", data: { org: "Christ Life", contactName: "Joe", pages: [{ name: "Home" }, { name: "About" }], features: ["mobile", "contact"], items: [{ item: "Site", price: 300 }], plan: "50-50", weeks: 6, revisions: 3 } };
    const k = mkKit({ projects: [project], docs: [prop] });
    const d = k.newAgreement("p1").data;
    expect(d).toMatchObject({ proposalNo: "PRO-2026-001", total: 300, plan: "50-50", weeks: 6, revisions: 3, pages: ["Home", "About"] });
    expect(d.features).toHaveLength(2);
  });
  test("a content checklist starts from the project's Content tab when it has one", () => {
    const k = mkKit({ projects: [{ ...project, content: [{ label: "Logo", done: true }, { label: "Photos", done: false }] }] });
    expect(k.newContent("p1").data.items.map((i) => [i.label, i.status])).toEqual([["Logo", "rec"], ["Photos", "req"]]);
  });
});
