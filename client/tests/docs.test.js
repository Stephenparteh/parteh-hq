import { describe, test, expect } from "vitest";
import { createKit } from "../src/docs/kit.js";
import * as IN from "../src/docs/templates/invoice.js";
import * as PR from "../src/docs/templates/proposal.js";
import * as TL from "../src/docs/templates/timeline.js";
import * as HO from "../src/docs/templates/handover.js";
import { longDate, shortDate, addDays } from "../src/docs/helpers.js";
import { planFor, computeAutomation, applyUndo } from "../src/docs/automation.js";
import { withDefaults } from "../src/lib/format.js";

const settings = withDefaults({ payInfo: "Orange Money: 0770 000 000" });
const mkKit = (over = {}) => createKit(() => ({ projects: [], docs: [], settings, today: () => "2026-05-01", ...over }));

describe("invoice totals", () => {
  test("3 items, 15% discount, 10% tax, $18.55 already paid", () => {
    const t = IN.totals({
      items: [{ desc: "Home page", qty: 1, rate: 80 }, { desc: "Extra pages", qty: 4, rate: 20 }, { desc: "Contact form", qty: 1, rate: 25.5 }],
      discType: "percent", discValue: 15, taxOn: "1", taxPct: 10, paidBefore: 18.55,
    });
    expect(t.sub).toBe(185.5);
    expect(t.disc).toBe(27.83);
    expect(t.tax).toBe(15.77);
    expect(t.total).toBe(173.44);
    expect(t.paid).toBe(18.55);
    expect(t.due).toBe(154.89);
  });
  test("a fixed discount can't be more than the subtotal; blank rows are ignored", () => {
    const t = IN.totals({ items: [{ desc: "A", qty: 2, rate: 10 }, { desc: "", qty: 1, rate: 0 }], discType: "amount", discValue: 500 });
    expect(t.lines).toHaveLength(1);
    expect(t.disc).toBe(20);
    expect(t.due).toBe(0);
  });
  test("warnings: nothing to pay, tax without a rate, missing payment details", () => {
    const w = IN.check({ org: "X", items: [{ desc: "A", qty: 1, rate: 10 }], taxOn: "1", taxPct: "" }, { payInfo: "" });
    expect(w.join(" ")).toMatch(/Tax is on but has no percentage/);
    expect(w.join(" ")).toMatch(/how clients pay you/);
    expect(IN.check({ org: "", items: [] }, { payInfo: "x" })).toEqual(expect.arrayContaining(["Add who the invoice is for (Bill to).", "Add at least one item with a price."]));
  });
  test("40+ items render in one table and total correctly", () => {
    const items = Array.from({ length: 45 }, (_, i) => ({ desc: `Item ${i}`, qty: 1, rate: 10 }));
    const model = IN.build({ org: "X", items, date: "2026-01-01", dueDays: 7 }, { name: "S", title: "Dev" });
    expect(model.total).toBe(450);
    expect(model.blocks.find((b) => b.t === "table").rows).toHaveLength(45);
  });
});

describe("payment schedules (the last payment takes the rounding)", () => {
  const sum = (rows) => Math.round(rows.reduce((s, r) => s + +r[3].replace(/[$,]/g, ""), 0) * 100) / 100;
  test("50/50", () => {
    expect(PR.schedule({ plan: "50-50" }, 1000.01).map((r) => r[3])).toEqual(["$500.01", "$500.00"]);
  });
  test("30/40/30 always adds up to the total", () => {
    for (const total of [100.01, 333.33, 1234.57, 99.99, 0.5]) {
      const rows = PR.schedule({ plan: "30-40-30" }, total);
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r[2])).toEqual(["30%", "40%", "30%"]);
      expect(sum(rows)).toBe(total);
    }
    expect(PR.schedule({ plan: "30-40-30" }, 100.01).map((r) => r[3])).toEqual(["$30.00", "$40.00", "$30.01"]);
  });
  test("deposit percent", () => {
    expect(PR.schedule({ plan: "deposit", depositPct: 33 }, 100).map((r) => [r[2], r[3]])).toEqual([["33%", "$33.00"], ["67%", "$67.00"]]);
    expect(PR.schedule({ plan: "deposit", depositPct: 100 }, 100)).toHaveLength(1);
    expect(PR.schedule({ plan: "deposit", depositPct: 0 }, 100).map((r) => r[3])).toEqual(["$100.00"]);
    expect(sum(PR.schedule({ plan: "deposit", depositPct: 33 }, 77.77))).toBe(77.77);
  });
  test("full payment before work starts", () => {
    expect(PR.schedule({ plan: "full" }, 250).map((r) => [r[0], r[3]])).toEqual([["Full payment", "$250.00"]]);
  });
});

describe("timeline dates", () => {
  test("4 weeks with a back end and 3 review days", () => {
    const rows = TL.rows("2026-03-02", 4, true, 3);
    expect(rows.map((r) => [r.stage, r.start, r.end])).toEqual([
      ["Kickoff and content", "2026-03-02", "2026-03-04"],
      ["UI design", "2026-03-05", "2026-03-09"],
      ["Client review: design", "2026-03-10", "2026-03-12"],
      ["Front-end development", "2026-03-13", "2026-03-19"],
      ["Back end and features", "2026-03-20", "2026-03-24"],
      ["Testing and revisions", "2026-03-25", "2026-03-28"],
      ["Launch and handover", "2026-03-29", "2026-03-29"],
    ]);
  });
  test("stages are back to back, end on the last day, and skip the back end when not needed", () => {
    for (const [weeks, back, rv] of [[1, false, 2], [2, true, 5], [6, false, 3], [8, true, 3]]) {
      const rows = TL.rows("2026-01-30", weeks, back, rv);
      rows.forEach((r, i) => { if (i) expect(r.start).toBe(addDays(rows[i - 1].end, 1)); expect(r.end >= r.start).toBe(true); });
      // a 1-week plan cannot fit every stage plus review time, so (as in the prototype) it can run a little over
      if (weeks >= 2) expect(rows.at(-1).end).toBe(addDays("2026-01-30", weeks * 7 - 1));
      expect(rows.some((r) => /Back end/.test(r.stage))).toBe(back);
      expect(rows.find((r) => /review/.test(r.stage))).toBeTruthy();
    }
  });
  test("recalculating dates keeps each stage's status", () => {
    const kit = mkKit(), d = { startDate: "2026-03-02", weeks: 4, hasBack: "1", reviewDays: 3, rows: [] };
    kit.regenRows(d); d.rows[0].status = "Done"; d.rows[1].status = "In progress";
    d.startDate = "2026-04-06"; d.weeks = 6; kit.regenRows(d);
    expect(d.rows[0]).toMatchObject({ status: "Done", start: "2026-04-06" });
    expect(d.rows[1].status).toBe("In progress");
    expect(d.rows[2].status).toBe("Not started");
  });
});

describe("empty dates never crash", () => {
  test("date helpers", () => {
    expect(longDate("")).toBe(""); expect(longDate(undefined)).toBe(""); expect(longDate("not a date")).toBe("");
    expect(shortDate("")).toBe(""); expect(addDays("", 7)).toBe("");
  });
});
