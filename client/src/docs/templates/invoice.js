import { BRAND, money, longDate, addDays, r2 } from "../helpers.js";

const qtyFmt = (q) => { const n = +q || 0; return Number.isInteger(n) ? String(n) : n.toFixed(2); };
export const KINDS = { deposit: "Deposit invoice", milestone: "Milestone invoice", final: "Final invoice", additional: "Additional work", maintenance: "Maintenance invoice" };
export const NOTES = [
  ["ref", "Please use the invoice number as your payment reference."],
  ["start", "Work starts once the deposit is received."],
  ["next", "The next stage of work continues once this payment is received."],
  ["handover", "The website will be handed over once this invoice is paid in full."],
  ["thanks", "Thank you for your business!"]];

export function totals(d) {
  const lines = (d.items || []).filter((l) => String(l.desc || "").trim() || +l.rate);
  const sub = r2(lines.reduce((s, l) => s + r2((+l.qty || 0) * (+l.rate || 0)), 0));
  const disc = d.discType === "percent" ? r2(sub * (+d.discValue || 0) / 100) : d.discType === "amount" ? r2(Math.min(sub, +d.discValue || 0)) : 0;
  const taxable = r2(sub - disc), tax = d.taxOn ? r2(taxable * (+d.taxPct || 0) / 100) : 0;
  const total = r2(taxable + tax), paid = r2(Math.max(0, +d.paidBefore || 0));
  return { lines, sub, disc, tax, total, paid, due: r2(total - paid) };
}

export function build(d, brand) {
  const t = totals(d), org = (d.org || "").trim() || "Client";
  const dueDate = +d.dueDays ? longDate(addDays(d.date, d.dueDays)) : "Due on receipt";
  const blocks = [];
  blocks.push({ t: "dochead", title: "Invoice", number: d.number || "Draft", sub: KINDS[d.kind] || "" });
  blocks.push({ t: "parties", left: { label: "Bill to", lines: [org, d.contactName, d.phone, d.email, d.address].filter(Boolean) },
    right: { label: "Invoice details", rows: [["Invoice no.", d.number || "Draft"], ["Issue date", longDate(d.date)], ["Due date", dueDate], ["Project", d.projectName]].filter((r) => r[1]) } });
  const foot = [["Subtotal", money(t.sub)]];
  if (t.disc) foot.push([d.discType === "percent" ? `Discount (${+d.discValue}%)` : "Discount", money(-t.disc)]);
  if (t.tax) foot.push([`${(d.taxLabel || "Tax").trim()} (${+d.taxPct}%)`, money(t.tax)]);
  if (t.paid) { foot.push(["Total", money(t.total)]); foot.push(["Already paid", money(-t.paid)]); }
  foot.push(["Amount due (USD)", money(t.due), true]);
  blocks.push({ t: "table", cols: [{ h: "Description", w: 52 }, { h: "Qty", w: 9, align: "right" }, { h: "Rate", w: 19, align: "right" }, { h: "Amount", w: 20, align: "right" }],
    rows: t.lines.map((l) => [l.desc || "Item", qtyFmt(l.qty), money(l.rate), money(r2((+l.qty || 0) * (+l.rate || 0)))]), foot });
  if (d.showSummary && +d.projectTotal > 0) {
    const before = r2(+d.projectPaid || 0), after = r2(+d.projectTotal - before - t.due);
    blocks.push({ t: "sub", text: "Project summary" });
    blocks.push({ t: "kv", rows: [["Project total", money(d.projectTotal)], ["Paid before this invoice", money(before)], ["This invoice", money(t.due)], ["Balance after this invoice", money(Math.max(0, after))]] });
  }
  if (brand.payInfo) { blocks.push({ t: "sub", text: "How to pay" }); blocks.push({ t: "note", text: brand.payInfo }); }
  const notes = NOTES.filter((n) => (d.notes || []).includes(n[0])).map((n) => n[1]);
  if ((d.customNote || "").trim()) notes.push(d.customNote.trim());
  if (notes.length) { blocks.push({ t: "sub", text: "Notes" }); blocks.push({ t: "bullets", items: notes }); }
  blocks.push({ t: "p", text: "All amounts are in US dollars (USD).", size: 8.5, c: BRAND.neutral });
  return { meta: { docType: "Invoice", number: d.number, client: org, brand, noFirstHeader: true }, blocks, total: t.due };
}

export function check(d, brand) {
  const w = [], t = totals(d);
  if (!(d.org || "").trim()) w.push("Add who the invoice is for (Bill to).");
  if (!t.lines.length || t.sub <= 0) w.push("Add at least one item with a price.");
  if (t.lines.some((l) => !(String(l.desc || "").trim()))) w.push("One of the items has no description.");
  if (t.due < 0) w.push("“Already paid” is more than the total.");
  if (t.sub > 0 && t.disc >= t.sub) w.push("The discount covers the whole amount. Check the discount.");
  else if (t.lines.length && t.due === 0 && t.paid === 0) w.push("The amount due is $0.00.");
  if (d.taxOn && !(+d.taxPct > 0)) w.push("Tax is on but has no percentage. Turn it off or add the rate.");
  if (!(brand && brand.payInfo)) w.push("Add how clients pay you in Settings, so the invoice shows payment instructions.");
  return w;
}
