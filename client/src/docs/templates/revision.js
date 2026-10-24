import { money as M, longDate as LD, shortDate, r2, head, meta } from "../helpers.js";

export const STATUS = ["New", "Approved", "In progress", "Done", "Declined"];
export const SCOPE = [["in", "Included"], ["extra", "Extra (needs approval)"], ["check", "Not sure yet"]];
export const IMPACT = ["No delay", "+1 day", "+2–3 days", "+1 week"];

export function totals(d) {
  const reqs = d.requests || [];
  const extra = reqs.filter((r) => r.scope === "extra" && r.status !== "Declined");
  const rounds = new Set(reqs.filter((r) => r.scope === "in" && r.round && r.round !== "extra").map((r) => r.round)).size;
  return { count: reqs.length, extraCount: extra.length, extraCost: r2(extra.reduce((s, r) => s + (+r.cost || 0), 0)), rounds };
}

export function build(d, brand) {
  const t = totals(d), reqs = d.requests || [];
  const blocks = [head("Revisions", d)];
  blocks.push({ t: "parties", left: { label: "Prepared for", lines: [(d.org || "").trim() || "Client", d.contactName].filter(Boolean) },
    right: { label: "Summary", rows: [["Log no.", d.number || "Draft"], ["Updated", LD(d.date)], ["Revision rounds included", String(d.rounds || 2)], ["Rounds used", String(t.rounds)], ["Extra requests", String(t.extraCount)]] } });
  blocks.push({ t: "table", cols: [{ h: "Date", w: 13 }, { h: "Page and request", w: 45 }, { h: "Scope", w: 15 }, { h: "Status", w: 13 }, { h: "Cost", w: 14, align: "right" }],
    rows: reqs.map((r) => [shortDate(r.date), `${r.page ? r.page + ": " : ""}${r.desc || ""}${r.impact && r.impact !== "No delay" ? ` (${r.impact})` : ""}`, r.scope === "extra" ? "Extra" : r.scope === "in" ? `Included${r.round && r.round !== "extra" ? ` (round ${r.round})` : ""}` : "To confirm", r.status || "New", r.scope === "extra" ? (+r.cost ? M(r.cost) : "To quote") : "—"]),
    foot: t.extraCost ? [["Extra work total", M(t.extraCost), true]] : [] });
  blocks.push({ t: "p", text: "Requests marked “Extra” are outside the agreed scope. I will only start them after you approve the cost and any change to the timeline.", size: 9.5 });
  return { meta: meta("Revisions", d, brand), blocks, total: t.extraCost };
}

export function check(d) { const w = []; if (!(d.requests || []).length) w.push("Add at least one request."); if ((d.requests || []).some((r) => !String(r.desc || "").trim())) w.push("One request has no description."); return w; }
