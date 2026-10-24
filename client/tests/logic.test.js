import { describe, test, expect } from "vitest";
import { DEFAULT_PRICES } from "../src/constants.js";
import { quoteOf, depositFor } from "../src/lib/quote.js";
import { projectsToCsv, CSV_HEADER } from "../src/lib/csv.js";
import { movePhase, pickNextStep, prepareForSave, gateBlocks, blankProject } from "../src/lib/projectLogic.js";
import { defaultSettings, waitDays, paidOf, totalOf, depositOf, todayStr } from "../src/lib/format.js";

const base = { type: "Website", pages: 5, f: { contact: true, whatsapp: true, gallery: true, seo: true }, nonprofit: false, rush: false };

describe("pricing totals", () => {
  test("base + extra pages + features", () => {
    // 80 + 4 pages x 20 + 15 + 5 + 15 + 20
    expect(quoteOf(base, DEFAULT_PRICES).total).toBe(215);
  });
  test("rush adds 25%", () => {
    const q = quoteOf({ ...base, rush: true }, DEFAULT_PRICES);
    expect(q.total).toBe(269); // 215 + round(53.75)
    expect(q.lines.at(-1)).toEqual({ item: "Rush delivery (+25%)", price: 54 });
  });
  test("nonprofit discount is 15% of the subtotal after rush", () => {
    expect(quoteOf({ ...base, nonprofit: true }, DEFAULT_PRICES).total).toBe(215 - 32); // round(32.25)
    expect(quoteOf({ ...base, rush: true, nonprofit: true }, DEFAULT_PRICES).total).toBe(229); // 269 - round(40.35)
  });
  test("deposit rounds up", () => {
    expect(depositFor(229, 10)).toBe(23);
    expect(depositFor(215, 30)).toBe(65);
    expect(depositFor(100, 0)).toBe(0);
  });
  test("graphic design has no page lines", () => {
    const q = quoteOf({ ...base, type: "Graphic design", f: {} }, DEFAULT_PRICES);
    expect(q.total).toBe(25);
    expect(q.lines).toHaveLength(1);
  });
  test("edited prices change the total", () => {
    const P = JSON.parse(JSON.stringify(DEFAULT_PRICES)); P.base.Website = 100; P.page = 10;
    expect(quoteOf({ ...base, f: {} }, P).total).toBe(140);
  });
});

describe("CSV export", () => {
  test("has the prototype's columns, in order", () => {
    expect(CSV_HEADER).toEqual(["Project", "Client", "Contact person", "Phone", "Type", "Billing", "Status", "Phase", "Next step", "Total (USD)", "Paid (USD)", "Balance (USD)", "Source", "Referred by", "Started"]);
    expect(projectsToCsv([]).split("\n")[0]).toBe(CSV_HEADER.join(","));
  });
  test("one row per project with totals, phase name and quoting", () => {
    const csv = projectsToCsv([{ name: 'Site, "big"', client: "Acme", contactName: "Ann", contact: "0770", type: "Website", billing: "paid", status: "active", phase: 8, nextStep: "Send the content checklist",
      scope: [{ item: "A", price: 300 }], payments: [{ amount: 100 }], source: "Church", referredBy: "Pastor Joe", startDate: "2026-01-02" }]);
    const [, row] = csv.split("\n");
    expect(row).toBe('"Site, ""big""",Acme,Ann,0770,Website,paid,active,Deposit paid,Send the content checklist,300,100,200,Church,Pastor Joe,2026-01-02');
  });
});

describe("deposit gate", () => {
  const s = { ...defaultSettings };
  test("blocks work past 'Deposit paid' on a paid project with no payment", () => {
    const d = { ...blankProject(s), phase: 8 };
    expect(gateBlocks(d, 9)).toBe(true);
    expect(movePhase(d, 11)).toBeNull();
  });
  test("allows it once a payment is logged", () => {
    const d = { ...blankProject(s), phase: 8, payments: [{ amount: "50" }] };
    expect(movePhase(d, 9).phase).toBe(9);
  });
  test("never blocks portfolio projects, or moves up to the gate", () => {
    expect(movePhase({ ...blankProject(s), phase: 8, billing: "portfolio" }, 11).phase).toBe(11);
    expect(movePhase({ ...blankProject(s), phase: 2 }, 8).phase).toBe(8);
  });
  test("moving back is always allowed and clears later dates", () => {
    const d = { ...blankProject(s), phase: 10, payments: [{ amount: 5 }], phaseDates: { 9: "2026-01-01", 10: "2026-01-02" } };
    const n = movePhase(d, 9);
    expect(n.phaseDates[10]).toBeUndefined();
    expect(n.phaseDates[9]).toBe("2026-01-01");
  });
  test("a phase suggests the next step and who it waits on", () => {
    const n = movePhase({ ...blankProject(s), phase: 3, nextStep: "Send the proposal" }, 7);
    expect(n.nextStep).toBe("Wait for the deposit");
    expect(n.waitingOn).toBe("client");
  });
  test("a custom next step is kept when the phase changes", () => {
    const n = movePhase({ ...blankProject(s), phase: 3, nextStep: "Call the pastor" }, 4);
    expect(n.nextStep).toBe("Call the pastor");
  });
});

describe("next-step dropdown", () => {
  const d = { ...blankProject(defaultSettings), waitingOn: "me" };
  test("a waiting step sets waiting on the client", () => expect(pickNextStep(d, "Wait for the deposit").waitingOn).toBe("client"));
  test("a work step sets waiting on me", () => expect(pickNextStep({ ...d, waitingOn: "client" }, "Design the UI").waitingOn).toBe("me"));
  test("'Other' keeps who it waits on and clears a listed step", () => {
    const n = pickNextStep({ ...d, waitingOn: "client", nextStep: "Wait for the deposit" }, "__custom");
    expect(n).toMatchObject({ _customNext: true, nextStep: "", waitingOn: "client" });
  });
});

describe("saving a project", () => {
  test("totals, paid and waitingSince", () => {
    const d = { ...blankProject(defaultSettings), name: "  Site  ", scope: [{ item: "A", price: "100" }, { item: "", price: 0 }], payments: [{ date: "2026-01-01", amount: "40" }, { amount: "" }], waitingOn: "client", _customNext: true };
    const b = prepareForSave(d, null);
    expect(b).toMatchObject({ name: "Site", price: 100, paid: 40, waitingSince: todayStr() });
    expect(b.scope).toEqual([{ item: "A", price: 100 }]);
    expect(b.payments).toHaveLength(1);
    expect(b._customNext).toBeUndefined();
  });
  test("removing every payment sets paid back to 0", () => {
    const orig = { ...blankProject(defaultSettings), name: "x", paid: 50, payments: [{ amount: 50 }] };
    const b = prepareForSave({ ...orig, payments: [] }, orig);
    expect(b.paid).toBe(0);
    expect(paidOf(b)).toBe(0);
  });
  test("the follow-up timer is kept while still waiting, reset when the phase changes", () => {
    const orig = { ...blankProject(defaultSettings), name: "x", waitingOn: "client", waitingSince: "2026-01-01", phase: 4 };
    expect(prepareForSave({ ...orig }, orig).waitingSince).toBe("2026-01-01");
    expect(prepareForSave({ ...orig, phase: 5 }, orig).waitingSince).toBe(todayStr());
    expect(prepareForSave({ ...orig, waitingOn: "me" }, orig).waitingSince).toBe("");
  });
});

describe("helpers", () => {
  test("totals, deposit and wait days", () => {
    const p = { scope: [{ price: 200 }, { price: 100 }], depositPct: 10, payments: [{ amount: 30 }] };
    expect(totalOf(p)).toBe(300);
    expect(depositOf(p, 50)).toBe(30);
    expect(depositOf({ ...p, depositPct: undefined }, 50)).toBe(150);
    expect(paidOf({ paid: 20 })).toBe(20);
    const ago = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
    expect(waitDays({ waitingOn: "client", status: "active", phase: 4, waitingSince: ago })).toBe(5);
    expect(waitDays({ waitingOn: "me", status: "active", phase: 4 })).toBe(-1);
  });
});
