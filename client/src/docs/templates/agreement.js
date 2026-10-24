import { money as M, longDate as LD, r2, head, meta, joinList } from "../helpers.js";
import { schedule } from "./proposal.js";

export const JURIS = ["the Republic of Liberia"];
export const LEGAL_FLAGS = ["Fees and payment (late payments, deposit refunds)", "Ownership of the work", "Cancellation", "Limitation of liability", "Disputes and governing law"];

export function build(d, brand) {
  const org = (d.org || "").trim() || "the Client", total = r2(d.total);
  const blocks = [head("Agreement", d, "Website design & development")];
  blocks.push({ t: "parties", left: { label: "Client", lines: [org, [d.contactName, d.contactRole].filter(Boolean).join(", "), d.phone, d.address].filter(Boolean) },
    right: { label: "Agreement details", rows: [["Agreement no.", d.number || "Draft"], ["Date", LD(d.date)], ["Project", d.projectName], ["Proposal", d.proposalNo], ["Total fee", total ? M(total) : ""]].filter((r) => r[1]) } });
  blocks.push({ t: "p", text: `This Service Agreement (“Agreement”) is made on ${LD(d.date)} between ${brand.name}, ${brand.title} (“the Developer”), and ${org} (“the Client”). It sets out the terms for the website project described below.` });
  let n = 0; const H = (t) => blocks.push({ t: "h", n: ++n, text: t, keep: 36 }); const P = (text) => blocks.push({ t: "p", text });
  H("Scope of work");
  const del = [];
  if ((d.pages || []).length) del.push(`A ${d.pages.length}-page website: ${joinList(d.pages)}.`);
  (d.features || []).forEach((f) => del.push(f));
  String(d.extraDeliverables || "").split("\n").map((x) => x.trim()).filter(Boolean).forEach((x) => del.push(x));
  P("The Developer will design and build the following for the Client:");
  blocks.push({ t: "bullets", items: del.length ? del : ["The website described in the approved proposal."] });
  P("Work that is not listed here is outside the scope of this Agreement and will be quoted separately.");
  H("Timeline");
  P(`The project is expected to take about ${d.weeks || 4} week${+d.weeks === 1 ? "" : "s"}. ${d.start || "Work starts after the deposit is received"}. The timeline depends on the Client sending content and feedback on time.`);
  H("Client responsibilities");
  blocks.push({ t: "bullets", items: [`Send the content needed for the website (text, images, logo) within ${d.contentDays || 7} days of the project start.`, `Give feedback within ${d.reviewDays || 3} days of each review request.`, "Make payments on time, as set out below.", "Confirm that they have the right to use all the content they provide."] });
  H("Fees and payment");
  if (total > 0) {
    P(`The total fee for this project is ${M(total)} (US dollars). It is paid as follows:`);
    blocks.push({ t: "table", cols: [{ h: "Payment", w: 30 }, { h: "When", w: 38 }, { h: "Share", w: 12, align: "right" }, { h: "Amount", w: 20, align: "right" }], rows: schedule(d, total) });
  } else P("The fee is set out in the approved proposal.");
  const pay = [];
  pay.push(brand.payInfo ? `Payments are made by: ${brand.payInfo}.` : "Payments are made by the methods agreed with the Developer.");
  if (d.depositTerms === "refundable_before") pay.push("The deposit is refunded in full if the Client cancels before any work starts. Once work has started, it is not refundable.");
  else pay.push("The deposit secures the project and covers early work. It is not refundable once work has started.");
  if (d.lateTerms === "pause") pay.push(`If a payment is more than ${d.lateDays || 14} days late, the Developer may pause work until it is paid.`);
  pay.push("Work is handed over only after the full fee has been paid.");
  blocks.push({ t: "bullets", items: pay });
  H("Revisions and additional work");
  P(`The fee includes ${d.revisions || 2} rounds of revisions on the design and ${d.revisions || 2} on the finished website. Further changes, new pages or new features are charged ${+d.extraRate > 0 ? `at ${M(d.extraRate)} per hour, or a fixed price agreed in writing before the work starts` : "at a price agreed in writing before the work starts"}.`);
  H("Delays and pauses");
  P(`If the Client does not respond or send the content needed for ${d.pauseDays || 14} days, the Developer may pause the project. The timeline moves by the length of the pause. If the project stays paused for more than ${d.closeDays || 60} days, either party may end this Agreement under the Cancellation section.`);
  H("Ownership of the work");
  P(d.ipTransfer === "launch" ? "When the website is launched and the full fee has been paid, the Client owns the final design, content and code created for this project." : "Once the full fee has been paid, the Client owns the final design, content and code created for this project.");
  P("Fonts, plugins, images or code from other providers stay under their own licenses. The Developer keeps ownership of their general tools, methods and code they used before this project.");
  if (d.portfolio !== "no") P("The Developer may show the finished website in their portfolio and marketing, unless the Client asks in writing not to.");
  H("Domain, hosting and other services");
  const svc = ["Domain, hosting, business email and other third-party services are paid by the Client, unless this Agreement says otherwise.", "Accounts are registered in the Client's name wherever possible."];
  if (d.hosting === "included") svc.push("Hosting for the first year is included in the fee. Renewals after the first year are paid by the Client.");
  else svc.push("Renewal fees for these services are the Client's responsibility.");
  blocks.push({ t: "bullets", items: svc });
  H("Confidentiality and data");
  P("Both parties will keep private any confidential information they share during the project. The Developer will use the Client's information only for this project. Passwords and login details are shared privately and are never written in project documents.");
  H("Cancellation");
  P(`Either party may end this Agreement by giving ${d.noticeDays || 14} days' written notice (WhatsApp or email counts). If the Client cancels, the Client pays for the work completed up to that date${d.depositTerms === "refundable_before" ? "" : ", and the deposit is not refunded"}. If the Developer cancels without good reason, any payment for work not yet done is refunded.`);
  H("Warranty and support");
  P(`For ${d.supportDays || 30} days after launch, the Developer will fix errors in the work delivered at no extra cost. This does not cover problems caused by changes made by others, by third-party services, or new requests.`);
  H("Limitation of liability");
  P("The Developer's total responsibility under this Agreement is limited to the amount the Client has paid. The Developer is not responsible for indirect losses, such as lost income or lost data, or for outages of third-party services.");
  H("Disputes and governing law");
  P(`If a disagreement comes up, both parties will first try to solve it by talking in good faith. If that does not work, they may use mediation before going to court. This Agreement is governed by the laws of ${(d.jurisdiction || JURIS[0]).trim()}.`);
  H("Entire agreement");
  P(`This Agreement${d.proposalNo ? `, together with the approved proposal ${d.proposalNo},` : ""} is the full agreement between the parties. Any change must be agreed in writing (WhatsApp or email counts).`);
  blocks.push({ t: "sign", parties: [{ label: "Signed for the Client", name: [d.contactName, org !== "the Client" ? org : ""].filter(Boolean).join(", ") }, { label: "Signed by the Developer", name: `${brand.name}, ${brand.title}` }] });
  return { meta: meta("Agreement", d, brand), blocks, total };
}

export function check(d) {
  const w = [];
  if (!(d.org || "").trim()) w.push("Add the client's organization name.");
  if (!(d.contactName || "").trim()) w.push("Add who signs for the client.");
  if (!(+d.total > 0)) w.push("Add the total fee (or link an accepted proposal).");
  if (!(d.pages || []).length && !(d.features || []).length && !String(d.extraDeliverables || "").trim()) w.push("Add what you will deliver (pages or features).");
  return w;
}
