import { PHASES } from "../constants.js";
import { totalOf, paidOf } from "./format.js";

export const CSV_HEADER = ["Project", "Client", "Contact person", "Phone", "Type", "Billing", "Status", "Phase", "Next step", "Total (USD)", "Paid (USD)", "Balance (USD)", "Source", "Referred by", "Started"];
const q = (v) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

export function projectsToCsv(projects) {
  const rows = [CSV_HEADER];
  projects.forEach((p) => {
    const tot = totalOf(p), paid = paidOf(p);
    rows.push([p.name, p.client, p.contactName, p.contact, p.type, p.billing, p.status, PHASES[p.phase || 0][1], p.nextStep, tot, paid, Math.max(0, tot - paid), p.source, p.referredBy, p.startDate]);
  });
  return rows.map((r) => r.map(q).join(",")).join("\n");
}
