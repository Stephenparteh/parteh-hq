import { money as M, longDate as LD, addDays, r2, head, meta } from "../helpers.js";

export const ACCOUNTS = ["Website admin dashboard", "Domain registrar account", "Hosting account", "Business email", "Google Business Profile", "Google Analytics / Search Console"];
export const MANAGE = [
  ["admin", "Update text, photos and posts from the admin dashboard."],
  ["images", "Use clear, compressed images so pages load fast."],
  ["logins", "Keep your logins private and change passwords if someone leaves your team."],
  ["renew", "Renew the domain and hosting before they expire, or the site will go offline."],
  ["backup", "Ask me before making big changes, so nothing breaks."],
  ["contact", "Contact me for new pages, features or anything that stops working."]];
const OWNER = { done: "All accounts and files have been transferred to the Client. The Client now owns and controls the website.", progress: "The transfer of accounts to the Client is in progress. It will be finished by the date agreed with the Client.", managed: "The Developer manages some accounts on the Client's behalf, as agreed. The Client can ask for full control at any time." };

export function build(d, brand) {
  const org = (d.org || "").trim() || "Client", bal = r2(Math.max(0, (+d.projectTotal || 0) - (+d.paidTotal || 0)));
  const blocks = [head("Handover", d)];
  blocks.push({ t: "parties", left: { label: "Handed over to", lines: [org, d.contactName, d.phone].filter(Boolean) },
    right: { label: "Details", rows: [["Handover no.", d.number || "Draft"], ["Handover date", LD(d.date)], ["Launch date", LD(d.launchDate)]].filter((r) => r[1]) } });
  let n = 0; const H = (t) => blocks.push({ t: "h", n: ++n, text: t, keep: 34 });
  H("Your website");
  blocks.push({ t: "kv", rows: [["Live website", d.siteUrl], ["Admin area", d.adminUrl]].filter((r) => r[1]) });
  const del = String(d.deliverables || "").split("\n").map((x) => x.trim()).filter(Boolean);
  if (del.length) { H("What was delivered"); blocks.push({ t: "bullets", items: del }); }
  H("Access and logins");
  blocks.push({ t: "note", text: `For your security, no passwords are written in this document. ${d.accessMethod || "Login details will be shared with you privately."}` });
  if ((d.accounts || []).length) { blocks.push({ t: "sub", text: "Accounts handed over" }); blocks.push({ t: "bullets", items: d.accounts }); }
  const dh = [["Domain", d.domain], ["Registrar", d.registrar], ["Domain renews on", LD(d.domainRenew)], ["Hosting", d.host], ["Hosting renews on", LD(d.hostRenew)], ["Renewals paid by", d.paidBy]].filter((r) => r[1]);
  if (dh.length) { H("Domain and hosting"); blocks.push({ t: "kv", rows: dh }); }
  H("Ownership");
  blocks.push({ t: "p", text: OWNER[d.ownership] || OWNER.done });
  const man = MANAGE.filter((x) => (d.manage || []).includes(x[0])).map((x) => x[1]);
  if (man.length) { H("Looking after your website"); blocks.push({ t: "bullets", items: man }); }
  const lim = String(d.limitations || "").split("\n").map((x) => x.trim()).filter(Boolean);
  H("Known limitations and open items");
  blocks.push(lim.length ? { t: "bullets", items: lim } : { t: "p", text: "None at the time of handover." });
  H("Support");
  const sup = [`Free support until ${LD(addDays(d.launchDate || d.date, d.supportDays || 30))} (${d.supportDays || 30} days after launch) to fix errors in the work delivered.`];
  if (d.maintenance === "monthly" && +d.maintenancePrice > 0) sup.push(`Monthly maintenance plan: ${M(d.maintenancePrice)} per month.`); else sup.push("After the support period, changes and fixes are quoted separately.");
  blocks.push({ t: "bullets", items: sup });
  if (+d.projectTotal > 0) { H("Final payment"); blocks.push({ t: "kv", rows: [["Project total", M(d.projectTotal)], ["Paid", M(d.paidTotal)], ["Balance", bal > 0 ? M(bal) : "Paid in full"]] }); }
  H("Client acknowledgment");
  blocks.push({ t: "p", text: "By signing below, the Client confirms they have received the website and the items listed in this document." });
  blocks.push({ t: "sign", parties: [{ label: "Received by the Client", name: [d.contactName, org].filter(Boolean).join(", ") }, { label: "Handed over by", name: `${brand.name}, ${brand.title}` }] });
  return { meta: meta("Handover", d, brand), blocks, total: 0 };
}

// Same rule on the server: the word "password" (or pin...) followed by "is <value>", ":" or "=".
const PW_RE = /\b(password|passwd|passcode|pwd|pin)\b\s*(is\s+\S|[:=])/i;
export function block(d) { return PW_RE.test(JSON.stringify(d)) ? ["It looks like a password is written in this document. Remove it and share logins privately."] : []; }
export function check(d) { const w = []; if (!(d.siteUrl || "").trim()) w.push("Add the live website address."); if (!(d.org || "").trim()) w.push("Add the client's name."); if (!d.launchDate) w.push("Add the launch date."); return w; }
