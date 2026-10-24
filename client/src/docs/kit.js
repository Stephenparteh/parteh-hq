/* Document logic shared by the editor, the project sheet, Today and the sample script.
   Ported from reference/docs.js and docs2.js (data parts only; the screens are React now).
   createKit(getCtx): getCtx() returns { projects, docs, settings } and is read fresh on every call. */
import { r2, money as M, longDate, addDays } from "./helpers.js";
import { todayStr, year } from "../lib/format.js";
import { pricesOf } from "../lib/quote.js";
import * as PR from "./templates/proposal.js";
import * as IN from "./templates/invoice.js";
import * as RC from "./templates/receipt.js";
import * as AG from "./templates/agreement.js";
import * as TL from "./templates/timeline.js";
import * as CT from "./templates/content.js";
import * as RV from "./templates/revision.js";
import * as HO from "./templates/handover.js";
import * as TS from "./templates/testimonial.js";

export const SITE_TYPES = ["Business website", "Church / ministry website", "Nonprofit website", "Portfolio website", "Personal brand website", "Event website", "School website", "Online store"];
export const INDUSTRY = ["Church / ministry", "Nonprofit / NGO", "Small business", "Artist / musician", "School / education", "Personal brand", "Event", "Other"];
export const ROLES = ["Founder", "Pastor", "Director", "Manager", "Owner", "CEO", "Secretary", "Coordinator", "Administrator"];
export const METHODS = ["Cash", "Orange Money", "MTN Mobile Money", "Bank transfer", "PayPal", "Other"];
export const KIND_OPTS = [["deposit", "Deposit (start of project)"], ["milestone", "Milestone payment"], ["final", "Final payment"], ["additional", "Additional work"], ["maintenance", "Monthly maintenance"]];
export const MILESTONES = ["Design approval", "Front end complete", "Back end complete", "Website ready for testing"];
export const BACKEND = ["admin", "blog", "events", "giving", "contact", "newsletter"];
export const ACCESS = ["Login details will be shared with you privately by phone.", "Login details will be shared with you in person.", "You will get an email invitation to each account and set your own password."];
export const REGISTRARS = ["", "Namecheap", "GoDaddy", "Hostinger", "Porkbun", "Cloudflare", "Squarespace Domains", "Other"];
export const HOSTS = ["", "Vercel", "Netlify", "Render", "Hostinger", "cPanel hosting", "GitHub Pages", "Other"];
export const DOC_TYPES = [
  ["proposal", "Proposal", "Pages, features, timeline and price, ready to send."],
  ["invoice", "Invoice", "Deposit, milestone, final, extra work or maintenance."],
  ["receipt", "Payment receipt", "Only for money you've actually received."],
  ["agreement", "Service agreement", "The contract, flagged for legal review."],
  ["timeline", "Project timeline", "Milestones, reviews and launch dates."],
  ["content", "Content checklist", "What the client needs to send."],
  ["revision", "Revision log", "Changes the client asks for, in or out of scope."],
  ["handover", "Handover", "Final details, with no passwords."],
  ["testimonial", "Testimonial request", "A thank-you and a request for feedback."]];
export const TYPE_NAME = { proposal: "Proposal", invoice: "Invoice", receipt: "Receipt", agreement: "Agreement", timeline: "Timeline", content: "Content checklist", revision: "Revision log", handover: "Handover", testimonial: "Testimonial request" };

export const sumItems = (d) => (d.items || []).reduce((s, l) => s + (+l.price || 0), 0);
const rid = () => "pay_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const newPaymentId = rid;
export const featureLabels = (pd) => PR.FEATURES.filter((f) => (pd.features || []).includes(f[0])).map((f) => f[1]).concat((pd.extraFeatures || []).filter(Boolean));

export function createKit(getCtx) {
  const ctx = () => getCtx();
  const S = () => ctx().settings;
  const today = () => (ctx().today ? ctx().today() : todayStr());
  const proj = (pid) => ctx().projects.find((x) => x.id === pid);
  const projPays = (p) => (Array.isArray(p?.payments) ? p.payments : +p?.paid > 0 ? [{ date: "", amount: +p.paid, note: "Earlier payment" }] : []);
  const projTotal = (p) => (!p ? 0 : (Array.isArray(p.scope) && p.scope.length ? r2(p.scope.reduce((s, l) => s + (+l.price || 0), 0)) : r2(+p.price || 0)));
  const projPaid = (p) => r2(projPays(p).reduce((s, x) => s + (+x.amount || 0), 0));
  const pagePreset = (k) => { const p = PR.PAGES.find((x) => x[0] === k); return p ? { key: p[0], name: p[1], purpose: p[2] } : null; };
  const monthLabel = (off) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + off, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); };
  const brand = () => { const s = S(); return { name: s.bizName, title: s.tagline, tagline: s.service, email: s.email, phone: s.phone, portfolio: s.portfolio, payInfo: s.payInfo, about: s.about }; };

  /* ---- invoice status comes from confirmed receipts. An invoice is never proof of payment. ---- */
  const receiptsFor = (invNo) => ctx().docs.filter((x) => x.type === "receipt" && x.data && x.data.confirmed && x.data.invoiceNo === invNo);
  const invoicePaid = (inv) => r2(receiptsFor(inv.number).reduce((s, x) => s + (+x.data.amount || 0), 0));
  function invoiceState(inv) {
    if (inv.status === "Cancelled") return ["Cancelled", "plain"];
    const paid = invoicePaid(inv), tot = +inv.total || 0;
    if (tot > 0 && paid >= tot) return ["Paid", ""];
    if (paid > 0) return ["Partly paid", "gold"];
    const due = inv.data && +inv.data.dueDays ? addDays(inv.data.date, inv.data.dueDays) : inv.data?.date;
    if (inv.status === "Sent" && due && due < today()) return ["Overdue", "wait"];
    return [inv.status || "Draft", inv.status === "Sent" ? "gold" : "plain"];
  }
  function stateOf(d) {
    if (d.type === "invoice") return invoiceState(d);
    if (d.type === "receipt") return d.data?.confirmed ? ["Received", ""] : ["Draft", "plain"];
    const s = d.status || "Draft"; return [s, s === "Accepted" ? "" : s === "Sent" ? "gold" : "plain"];
  }
  const owedOn = (inv) => r2(Math.max(0, (+inv.total || 0) - invoicePaid(inv)));

  /* ---- proposal ---- */
  function itemsFromProject(p) {
    if (Array.isArray(p.scope) && p.scope.length) return p.scope.map((l) => ({ item: l.item, price: +l.price || 0 }));
    if (+p.price) return [{ item: `${p.type || "Website"} design and development`, price: +p.price }];
    return [];
  }
  function applyProject(d, pid) {
    const p = proj(pid); if (!p) return;
    d.org = p.client || p.name || ""; d.contactName = p.contactName || ""; d.phone = p.contact || "";
    const it = itemsFromProject(p); if (it.length) d.items = it;
    d.depositPct = p.depositPct ?? S().depositPct;
    if (/church|ministr|pentecostal|christ|chapel|gospel/i.test(`${p.client} ${p.name}`)) { d.siteType = "Church / ministry website"; d.industry = "Church / ministry"; }
  }
  function newProposal(pid) {
    const s = S();
    const d = {
      title: "Website Design & Development Proposal", date: today(), validDays: 14, org: "", contactName: "", contactRole: "", phone: "", email: "", industry: "", siteType: "Business website",
      goals: [], goalNote: "", pages: ["home", "about", "services", "contact"].map(pagePreset), features: ["mobile", "speed", "social", "contact", "whatsapp"], extraFeatures: [],
      style: PR.DESIGN[0], colors: "", references: "", domain: "register", domainName: "", hosting: "client", bizEmail: "none",
      weeks: 4, start: PR.START[0], reviewDays: 3, revisions: 2, supportDays: 30, maintenance: "none", maintenancePrice: "",
      items: [], plan: "deposit", depositPct: s.depositPct ?? 50, sections: { design: true, domain: true, timeline: true, support: true, about: true }, solutionNote: "" };
    if (pid) applyProject(d, pid);
    return { type: "proposal", status: "Draft", projectId: pid || "", data: d };
  }

  /* ---- invoice ---- */
  function fillInvoice(d, pid, opts = {}) {
    const p = proj(pid);
    if (p) { d.org = p.client || p.name || ""; d.contactName = p.contactName || ""; d.phone = p.contact || ""; d.projectName = p.name || ""; }
    d.projectTotal = projTotal(p) || r2(opts.total || 0); d.projectPaid = projPaid(p);
    const name = d.projectName || "the website project", tot = d.projectTotal;
    const dp = +(opts.depositPct ?? p?.depositPct ?? S().depositPct) || 0;
    if (d.kind === "deposit") { d.items = [{ desc: `Deposit (${dp}%) for ${name}`, qty: 1, rate: r2(tot * dp / 100) }]; d.paidBefore = 0; d.showSummary = tot > 0; d.notes = ["start", "ref", "thanks"]; }
    else if (d.kind === "milestone") { d.items = [{ desc: `Milestone payment: ${d.milestone} (${d.milestonePct}%)`, qty: 1, rate: r2(tot * (+d.milestonePct || 0) / 100) }]; d.paidBefore = 0; d.showSummary = tot > 0; d.notes = ["next", "ref", "thanks"]; }
    else if (d.kind === "final") {
      const sc = p && Array.isArray(p.scope) && p.scope.length ? p.scope.map((l) => ({ desc: l.item, qty: 1, rate: +l.price || 0 })) : (tot ? [{ desc: `${name}: full project`, qty: 1, rate: tot }] : []);
      d.items = sc.length ? sc : [{ desc: "", qty: 1, rate: 0 }]; d.paidBefore = d.projectPaid; d.showSummary = false; d.notes = ["handover", "ref", "thanks"];
    }
    else if (d.kind === "maintenance") { d.items = [{ desc: `Website maintenance: ${d.month}`, qty: 1, rate: +d.monthlyPrice || 0 }]; d.paidBefore = 0; d.showSummary = false; d.notes = ["ref", "thanks"]; }
    else { d.items = [{ desc: "", qty: 1, rate: 0 }]; d.paidBefore = 0; d.showSummary = false; d.notes = ["ref", "thanks"]; }
  }
  function newInvoice(pid, kind, opts) {
    const d = { kind: kind || (pid ? "deposit" : "additional"), date: today(), dueDays: 7, org: "", contactName: "", phone: "", email: "", address: "", projectName: "",
      items: [], discType: "none", discValue: "", taxOn: "", taxPct: "", taxLabel: "Tax", paidBefore: 0, showSummary: false, projectTotal: 0, projectPaid: 0,
      notes: ["ref", "thanks"], customNote: "", milestone: MILESTONES[0], milestonePct: 40, month: monthLabel(0), monthlyPrice: "" };
    fillInvoice(d, pid, opts);
    return { type: "invoice", status: "Draft", projectId: pid || "", data: d };
  }

  /* ---- receipt ---- */
  const payKey = (x, i) => x.id || "idx:" + i;
  function linkedIndex(p, ref) { const pays = projPays(p); if (!ref || ref === "new") return -1; if (ref.startsWith("idx:")) return +ref.slice(4); return pays.findIndex((x) => x.id === ref); }
  function prepReceipt(d, pid) {
    const p = proj(pid);
    d.projectName = p ? p.name : (d.projectName || "");
    d.projectTotal = projTotal(p);
    if (p) { const i = linkedIndex(p, d.payRef); const others = projPays(p).filter((_, j) => j !== i).reduce((s, x) => s + (+x.amount || 0), 0); d.paidToDate = r2(others + (+d.amount || 0)); }
    else d.paidToDate = r2(+d.amount || 0);
  }
  function guessReceipt(d, pid) {
    const p = proj(pid), name = d.projectName || p?.name || "the website project", tot = projTotal(p);
    let before = 0;
    if (p) { const i = linkedIndex(p, d.payRef); before = projPays(p).filter((_, j) => j !== i && (i < 0 || j < i)).reduce((s, x) => s + (+x.amount || 0), 0); }
    const inv = ctx().docs.find((x) => x.type === "invoice" && x.number === d.invoiceNo);
    if (tot > 0 && before + (+d.amount || 0) >= tot - 0.005) d.payType = "full";
    else if ((inv && inv.data?.kind === "deposit") || before === 0) d.payType = "deposit";
    else d.payType = "partial";
    d.description = d.payType === "deposit" ? `Deposit for ${name}` : d.payType === "full" ? (before > 0 ? `Final payment for ${name}` : `Full payment for ${name}`) : `Payment toward ${name}`;
  }
  function fillReceiptFromPayment(d, pid, ref) {
    const p = proj(pid); d.payRef = ref || "new";
    if (p && ref && ref !== "new") { const i = linkedIndex(p, ref), x = projPays(p)[i]; if (x) { d.amount = +x.amount || 0; d.date = x.date || today(); if (x.method) d.method = x.method; if (x.ref) d.txRef = x.ref; if (x.invoiceNo) d.invoiceNo = x.invoiceNo; } }
    guessReceipt(d, pid);
  }
  function newReceipt(pid, opts = {}) {
    const p = proj(pid);
    const d = { date: today(), org: p ? (p.client || p.name || "") : "", contactName: p?.contactName || "", phone: p?.contact || "", projectName: p?.name || "", amount: opts.amount || "", method: "", txRef: "", invoiceNo: opts.invoiceNo || "", payType: "deposit", description: "", payRef: "new", confirmed: false };
    if (p && !opts.newPayment) { const pays = projPays(p); const i = opts.payRef ? -2 : pays.findIndex((x) => !x.receiptNo && +x.amount > 0); if (opts.payRef) fillReceiptFromPayment(d, pid, opts.payRef); else if (i >= 0) fillReceiptFromPayment(d, pid, payKey(pays[i], i)); else guessReceipt(d, pid); }
    else guessReceipt(d, pid);
    return { type: "receipt", status: "Issued", projectId: pid || "", data: d };
  }
  // The receipt number already on the payment this receipt points at (if it is a different receipt).
  function dupReceipt(cur) {
    const d = cur.data, p = proj(cur.projectId); if (!p || !d.payRef || d.payRef === "new") return "";
    const x = projPays(p)[linkedIndex(p, d.payRef)];
    return x && x.receiptNo && x.receiptNo !== cur.number ? x.receiptNo : "";
  }

  /* ---- docs2 types ---- */
  function latestProposal(pid) {
    const ps = ctx().docs.filter((x) => x.type === "proposal" && (!pid || x.projectId === pid)).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return ps.find((x) => x.status === "Accepted") || ps[0] || null;
  }
  function clientFrom(pid, prop) {
    const p = proj(pid), pd = (prop && prop.data) || {};
    return { org: (p && (p.client || p.name)) || pd.org || "", contactName: (p && p.contactName) || pd.contactName || "", contactRole: pd.contactRole || "", phone: (p && p.contact) || pd.phone || "", projectName: (p && p.name) || "" };
  }
  function agFromProposal(d, prop) {
    if (!prop) { d.proposalNo = ""; return; }
    const pd = prop.data || {};
    Object.assign(d, { proposalNo: prop.number || "", pages: (pd.pages || []).map((p) => p.name).filter(Boolean), features: featureLabels(pd), total: r2((pd.items || []).reduce((s, l) => s + (+l.price || 0), 0)),
      plan: pd.plan || "deposit", depositPct: pd.depositPct ?? S().depositPct, weeks: pd.weeks || 4, start: pd.start || PR.START[0], reviewDays: pd.reviewDays || 3, revisions: pd.revisions || 2, supportDays: pd.supportDays || 30, hosting: pd.hosting || "client" });
    if (pd.org) d.org = pd.org; if (pd.contactName) d.contactName = pd.contactName; if (pd.contactRole) d.contactRole = pd.contactRole; if (pd.phone) d.phone = pd.phone;
  }
  function newAgreement(pid) {
    const prop = latestProposal(pid), p = proj(pid);
    const d = { date: today(), ...clientFrom(pid, prop), address: "", proposalNo: "", pages: [], features: [], extraDeliverables: "", total: projTotal(p), plan: "deposit", depositPct: S().depositPct ?? 50,
      weeks: 4, start: PR.START[0], contentDays: 7, reviewDays: 3, lateTerms: "pause", lateDays: 14, depositTerms: "nonrefundable", revisions: 2, extraRate: "", pauseDays: 14, closeDays: 60,
      ipTransfer: "full", portfolio: "yes", hosting: "client", noticeDays: 14, supportDays: 30, jurisdiction: AG.JURIS[0] };
    agFromProposal(d, prop);
    return { type: "agreement", status: "Draft", projectId: pid || "", data: d };
  }
  // Recalculating dates keeps each stage's status.
  function regenRows(d) {
    const old = {}; (d.rows || []).forEach((r) => { old[r.stage] = r.status; });
    d.rows = TL.rows(d.startDate || today(), d.weeks, !!d.hasBack, d.reviewDays).map((r) => ({ ...r, status: old[r.stage] || r.status }));
  }
  function newTimeline(pid) {
    const prop = latestProposal(pid), pd = (prop && prop.data) || {};
    const d = { date: today(), ...clientFrom(pid, prop), startDate: today(), weeks: pd.weeks || 4, hasBack: prop ? ((pd.features || []).some((k) => BACKEND.includes(k)) ? "1" : "") : "1", reviewDays: pd.reviewDays || 3, rows: [], note: "" };
    regenRows(d);
    return { type: "timeline", status: "Draft", projectId: pid || "", data: d };
  }
  function newContent(pid) {
    const p = proj(pid), prop = latestProposal(pid);
    let items;
    if (p && Array.isArray(p.content) && p.content.length) items = p.content.map((c) => ({ cat: "", label: c.label, status: c.done ? "rec" : "req", note: "" }));
    else items = CT.PRESETS.map(([cat, label]) => ({ cat, label, status: /Prices|Videos|privacy|Booking/i.test(label) ? "no" : "req", note: "" }));
    const d = { date: today(), dueDate: addDays(today(), 7), sendVia: "WhatsApp", ...clientFrom(pid, prop), items };
    return { type: "content", status: "Draft", projectId: pid || "", data: d };
  }
  function newRevision(pid) {
    const prop = latestProposal(pid), pd = (prop && prop.data) || {};
    const d = { date: today(), ...clientFrom(pid, prop), rounds: pd.revisions || 2, pagesList: (pd.pages || []).map((p) => p.name).filter(Boolean), requests: [] };
    return { type: "revision", status: "Open", projectId: pid || "", data: d };
  }
  function newHandover(pid) {
    const p = proj(pid), prop = latestProposal(pid), pd = (prop && prop.data) || {};
    const del = [];
    if ((pd.pages || []).length) del.push(`${pd.pages.length}-page website: ${pd.pages.map((x) => x.name).join(", ")}`);
    featureLabels(pd).forEach((f) => del.push(f));
    if (!del.length && p && Array.isArray(p.scope)) p.scope.filter((l) => +l.price > 0).forEach((l) => del.push(l.item));
    const d = { date: today(), launchDate: today(), ...clientFrom(pid, prop), siteUrl: "", adminUrl: "", deliverables: del.join("\n"), accessMethod: ACCESS[0], accounts: ["Website admin dashboard"],
      domain: pd.domainName || "", registrar: "", domainRenew: "", host: "", hostRenew: "", paidBy: "Client", ownership: "done", manage: ["admin", "logins", "renew", "contact"], limitations: "",
      supportDays: pd.supportDays || 30, maintenance: pd.maintenance === "offer" ? "monthly" : "none", maintenancePrice: pd.maintenancePrice || "", projectTotal: projTotal(p), paidTotal: projPaid(p) };
    return { type: "handover", status: "Draft", projectId: pid || "", data: d };
  }
  function newTestimonial(pid) {
    const d = { date: today(), ...clientFrom(pid, latestProposal(pid)), questions: ["liked", "recommend"], askPermission: true, link: "", received: "", permission: false };
    return { type: "testimonial", status: "Requested", projectId: pid || "", data: d };
  }

  /* ---- messages the forms can copy ---- */
  const me = () => String(S().bizName || "").split(/\s+/)[0];
  const hi = (d) => String(d.contactName || "").split(/\s+/)[0] || "there";
  const msg = {
    missingContent: (d) => { const miss = (d.items || []).filter((i) => i.status === "req").map((i) => "• " + i.label); return `Hi ${hi(d)}! To keep ${d.projectName || "your website"} moving, I still need:\n\n${miss.join("\n") || "• Nothing, you're all set 🎉"}\n\nPlease send them by ${longDate(d.dueDate)}. Thank you! 🙏🏾\n— ${me()}`; },
    howToSend: (d) => `Hi! To keep changes organised, please send each change like this:\n\nPage: (for example Home)\nWhat to change: …\nPriority: Low, Normal or High\nScreenshot or link: (optional)\n\nYour plan includes ${d.rounds || 2} rounds of revisions. Thank you! 🙏🏾\n— ${me()}`,
    extraApproval: (d) => { const ex = (d.requests || []).filter((r) => r.scope === "extra" && r.status !== "Declined"); const t = RV.totals(d); return `Hi ${hi(d)}! These changes are outside the agreed scope:\n\n${ex.map((r) => `• ${r.page ? r.page + ": " : ""}${r.desc}: ${+r.cost ? M(r.cost) : "price to confirm"}${r.impact && r.impact !== "No delay" ? ` (${r.impact})` : ""}`).join("\n")}\n\nTotal: ${M(t.extraCost)}. Reply “Approved” and I'll start on them. 🙏🏾\n— ${me()}`; },
    reminder: (inv) => {
      const d = inv.data || {}, due = +d.dueDays ? addDays(d.date, d.dueDays) : d.date, late = due < today(), s = S();
      return `Hi ${hi(d)}! Just a friendly reminder about invoice ${inv.number}${d.projectName ? ` for ${d.projectName}` : ""}. The amount of ${M(owedOn(inv))} ${late ? "was" : "is"} due on ${longDate(due)}.${s.payInfo ? `\n\nYou can pay by: ${s.payInfo}` : ""}\n\nPlease send me a message once it's paid so I can send your receipt. Thank you! 🙏🏾\n— ${String(s.bizName || "").split(/\s+/)[0]}`;
    },
    proposalFollowUp: (pr) => { const d = pr.data || {}; return `Hi ${hi(d)}! Just checking in on the proposal I sent for ${d.org || "your website"} (${pr.number}). Do you have any questions, or anything you'd like me to change? I'm happy to jump on a quick call. 🙏🏾\n— ${me()}`; },
    formMessage: () => `Hi! Thank you for reaching out about a website 🙏🏾\n\nPlease fill this short form so I can understand what you need:\n${S().formLink}\n\nOnce you're done, I'll review your answers and get back to you.\n\n— ${S().bizName}`,
  };

  /* ---- the registry of document types ---- */
  const reproject = (make) => (d, pid) => { const fresh = make(pid).data; Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, fresh); };
  const common = { client: (d) => d.org, total: () => 0, money: false };
  const TY = {
    proposal: { prefix: "PRO", label: "Proposal", statuses: ["Draft", "Sent", "Accepted", "Declined"], make: (pid) => newProposal(pid), check: (d) => PR.check(d), build: (d) => PR.build(d, brand()), total: sumItems, client: (d) => d.org, money: true,
      onProject: (d, pid) => { if (pid) applyProject(d, pid); } },
    invoice: { prefix: "INV", label: "Invoice", statuses: ["Draft", "Sent", "Cancelled"], make: (pid, o = {}) => newInvoice(pid, o.kind, o), check: (d) => IN.check(d, brand()), build: (d) => IN.build(d, brand()), total: (d) => IN.totals(d).due, client: (d) => d.org, money: true,
      onProject: (d, pid) => fillInvoice(d, pid) },
    receipt: { prefix: "RCT", label: "Receipt", statuses: null, hard: true, make: (pid, o = {}) => newReceipt(pid, o), money: true,
      check: (d, cur) => { const w = RC.check(d); const dup = dupReceipt(cur); if (dup) w.push(`This payment already has receipt ${dup}.`); return w; },
      build: (d, cur) => { prepReceipt(d, cur.projectId); return RC.build(d, brand()); }, total: (d) => +d.amount || 0, client: (d) => d.org,
      onProject: (d, pid) => { const p = proj(pid); if (p) { d.org = p.client || p.name || ""; d.contactName = p.contactName || ""; d.phone = p.contact || ""; } const pays = projPays(p); const i = pays.findIndex((x) => !x.receiptNo && +x.amount > 0); fillReceiptFromPayment(d, pid, p && i >= 0 ? payKey(pays[i], i) : "new"); } },
    agreement: { ...common, prefix: "AGR", label: "Agreement", statuses: ["Draft", "Sent", "Signed", "Cancelled"], make: newAgreement, check: AG.check, build: (d) => AG.build(d, brand()), total: (d) => +d.total || 0, money: true,
      onProject: reproject(newAgreement), fromSource: (d, id) => agFromProposal(d, ctx().docs.find((x) => x.id === id)) },
    timeline: { ...common, prefix: "TML", label: "Timeline", statuses: ["Draft", "Sent"], make: newTimeline, check: TL.check, build: (d) => TL.build(d, brand()), onProject: reproject(newTimeline), refill: (d) => regenRows(d),
      newRow: () => ({ stage: "New stage", desc: "", start: today(), end: today(), status: "Not started" }) },
    content: { ...common, prefix: "CNT", label: "Content checklist", statuses: ["Draft", "Sent"], make: newContent, check: CT.check, build: (d) => CT.build(d, brand()), onProject: reproject(newContent),
      refill: (d, k) => { if (k === "_add" && d._add) { const p = CT.PRESETS.find((x) => x[1] === d._add); d.items.push({ cat: p ? p[0] : "", label: d._add, status: "req", note: "" }); } delete d._add; },
      newRow: () => ({ cat: "Other", label: "", status: "req", note: "" }) },
    revision: { ...common, prefix: "REV", label: "Revision log", statuses: ["Open", "Closed"], make: newRevision, check: RV.check, build: (d) => RV.build(d, brand()), total: (d) => RV.totals(d).extraCost, money: true,
      onProject: reproject(newRevision), newRow: () => ({ date: today(), page: "", desc: "", scope: "in", round: "1", status: "New", cost: "", impact: "No delay" }) },
    handover: { ...common, prefix: "HND", label: "Handover", statuses: ["Draft", "Delivered", "Signed"], make: newHandover, check: HO.check, block: HO.block, build: (d) => HO.build(d, brand()), onProject: reproject(newHandover) },
    testimonial: { ...common, prefix: "TST", label: "Testimonial request", statuses: ["Requested", "Received", "Approved to share"], make: newTestimonial, check: (d) => ((d.contactName || "").trim() ? [] : ["Add the contact person's name."]),
      messageOnly: true, word: false, onProject: reproject(newTestimonial) },
  };

  return { TY, S, today, proj, projPays, projTotal, projPaid, pagePreset, monthLabel, brand, receiptsFor, invoicePaid, invoiceState, stateOf, owedOn,
    itemsFromProject, applyProject, newProposal, fillInvoice, newInvoice, payKey, linkedIndex, prepReceipt, guessReceipt, fillReceiptFromPayment, newReceipt, dupReceipt,
    latestProposal, clientFrom, agFromProposal, newAgreement, regenRows, newTimeline, newContent, newRevision, newHandover, newTestimonial, msg, pricesOf: () => pricesOf(S()), year };
}
