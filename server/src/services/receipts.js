import { newId, r2 } from "./common.js";

// Port of the prototype's syncPayment (reference/docs.js). Pure: it never writes anything.
export const RECEIPT_TYPES = { deposit: "Deposit payment", partial: "Partial payment", full: "Full payment" };

// A project's payments. Old projects only have a single "paid" number.
export const projPays = (p) => (Array.isArray(p?.payments) ? p.payments : +p?.paid > 0 ? [{ date: "", amount: +p.paid, note: "Earlier payment" }] : []);

function linkedIndex(pays, ref) {
  if (!ref || ref === "new") return -1;
  if (ref.startsWith("idx:")) return +ref.slice(4);
  return pays.findIndex((x) => x.id === ref);
}

/**
 * Decide how a confirmed receipt changes the project's payments.
 * - Linked by payment id (payRef). "new" or empty means a new payment.
 * - Saving the same receipt again finds its payment by receiptNo, so it is never added twice.
 * - If the linked payment already belongs to a different receipt, returns { conflict }.
 * Returns { payments, paid, payRef } (payments is a new array).
 */
export function planReceiptSync(projectData, receiptData, number) {
  const pays = JSON.parse(JSON.stringify(projPays(projectData)));
  let i = linkedIndex(pays, receiptData.payRef);
  if (i < 0 && number) i = pays.findIndex((x) => x.receiptNo === number);
  if (i >= 0 && !pays[i]) i = -1;
  if (i >= 0 && pays[i].receiptNo && pays[i].receiptNo !== number) return { conflict: pays[i].receiptNo };
  const entry = {
    date: receiptData.date, amount: r2(receiptData.amount), note: RECEIPT_TYPES[receiptData.payType] || "Payment",
    method: receiptData.method || "", ref: receiptData.txRef || "", receiptNo: number || "", invoiceNo: receiptData.invoiceNo || "",
  };
  let payRef;
  if (i >= 0) {
    payRef = pays[i].id || newId();
    pays[i] = { ...pays[i], ...entry, id: payRef };
  } else {
    payRef = newId();
    pays.push({ id: payRef, ...entry });
  }
  return { payments: pays, paid: r2(pays.reduce((s, x) => s + (+x.amount || 0), 0)), payRef };
}
