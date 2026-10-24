import { BRAND, money, longDate, r2 } from "../helpers.js";

export const TYPES = { deposit: "Deposit payment", partial: "Partial payment", full: "Full payment" };

export function build(d, brand) {
  const org = (d.org || "").trim() || "Client", amt = r2(d.amount);
  const blocks = [];
  blocks.push({ t: "dochead", title: "Receipt", number: d.number || "Draft", sub: "Payment received" });
  blocks.push({ t: "parties", left: { label: "Received from", lines: [org, d.contactName, d.phone].filter(Boolean) },
    right: { label: "Receipt details", rows: [["Receipt no.", d.number || "Draft"], ["Payment date", longDate(d.date)], ["Payment method", d.method], ["Reference", d.txRef], ["For invoice", d.invoiceNo], ["Project", d.projectName]].filter((r) => r[1]) } });
  blocks.push({ t: "amountbox", label: "Amount received", sub: TYPES[d.payType] || "", amount: money(amt) });
  blocks.push({ t: "table", cols: [{ h: "Description", w: 75 }, { h: "Amount", w: 25, align: "right" }], rows: [[d.description || "Payment", money(amt)]] });
  if (+d.projectTotal > 0) {
    const paid = r2(d.paidToDate), bal = r2(Math.max(0, +d.projectTotal - paid));
    blocks.push({ t: "sub", text: "Project balance" });
    blocks.push({ t: "kv", rows: [["Project total", money(d.projectTotal)], ["Total paid to date", money(paid)], ["Balance remaining", bal > 0 ? money(bal) : "Paid in full"]] });
  }
  blocks.push({ t: "p", text: `This receipt confirms that ${brand.name} received ${money(amt)} from ${org} on ${longDate(d.date)}${d.method ? ` by ${d.method}` : ""}. Thank you for your payment.` });
  blocks.push({ t: "kv", rows: [["Received by", `${brand.name}, ${brand.title}`]] });
  blocks.push({ t: "p", text: "All amounts are in US dollars (USD).", size: 8.5, c: BRAND.neutral });
  return { meta: { docType: "Receipt", number: d.number, client: org, brand, noFirstHeader: true }, blocks, total: amt };
}

export function check(d) {
  const w = [];
  if (!d.confirmed) w.push("Tick “I confirm I have received this money” before creating the receipt.");
  if (!(+d.amount > 0)) w.push("Add the amount received.");
  if (!(d.org || "").trim()) w.push("Add who paid (Received from).");
  if (!d.method) w.push("Choose the payment method.");
  if (!d.date) w.push("Add the payment date.");
  return w;
}
