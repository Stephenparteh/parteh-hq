/* Docs tab: document list + builders (proposal, invoice, receipt). Uses globals from the main page script (db, projects, S, prices, view, render, esc, toast, copy, today, year, downloads, fmtDate, $). */
(function () {
  "use strict";
  const E = window.DocEngine, PR = E.proposal, IN = E.invoice, RC = E.receipt, r2 = E.r2, M = E.money;
  const LIBS = { jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", docx: "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js" };
  const libP = {};
  function loadScript(k) {
    if (libP[k]) return libP[k];
    libP[k] = new Promise((res, rej) => { const s = document.createElement("script"); s.src = LIBS[k]; s.onload = res; s.onerror = () => { libP[k] = null; rej(new Error("lib")); }; document.head.appendChild(s); });
    return libP[k];
  }
  const ready = (word) => Promise.all([loadScript("jspdf"), E.loadFonts(), word ? loadScript("docx") : null]);

  const SITE_TYPES = ["Business website", "Church / ministry website", "Nonprofit website", "Portfolio website", "Personal brand website", "Event website", "School website", "Online store"];
  const INDUSTRY = ["Church / ministry", "Nonprofit / NGO", "Small business", "Artist / musician", "School / education", "Personal brand", "Event", "Other"];
  const ROLES = ["Founder", "Pastor", "Director", "Manager", "Owner", "CEO", "Secretary", "Coordinator", "Administrator"];
  const METHODS = ["Cash", "Orange Money", "MTN Mobile Money", "Bank transfer", "PayPal", "Other"];
  const KIND_OPTS = [["deposit", "Deposit (start of project)"], ["milestone", "Milestone payment"], ["final", "Final payment"], ["additional", "Additional work"], ["maintenance", "Monthly maintenance"]];
  const MILESTONES = ["Design approval", "Front end complete", "Back end complete", "Website ready for testing"];
  const DOC_TYPES = [
    ["proposal", "Proposal", "Pages, features, timeline and price, ready to send.", true],
    ["invoice", "Invoice", "Deposit, milestone, final, extra work or maintenance.", true],
    ["receipt", "Payment receipt", "Only for money you've actually received.", true],
    ["agreement", "Service agreement", "The contract, flagged for legal review.", false],
    ["timeline", "Project timeline", "Milestones, reviews and launch dates.", false],
    ["content", "Content checklist", "What the client needs to send.", false],
    ["revision", "Revision log", "Changes the client asks for, in or out of scope.", false],
    ["handover", "Handover", "Final details, with no passwords.", false],
    ["testimonial", "Testimonial request", "A thank-you and a request for feedback.", false]];

  let docsList = [], dv = "home", cur = null, dirty = false, mode = "fill", leaveArmed = false, pdfArmed = false, busy = false, savedStatus = null, savedConfirmed = false;

  /* ---------- styles ---------- */
  const st = document.createElement("style");
  st.textContent = `
  .dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
  .dtype{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:6px;min-width:0}
  .dtype h3{font-size:16px}.dtype p{margin:0;font-size:13px;color:var(--muted)}
  .dtype.soon{background:transparent;border-style:dashed}
  .dtype .row{margin-top:auto;padding-top:6px}
  .dfilter{display:flex;gap:4px;flex-wrap:wrap}
  .drow{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;text-align:left;font:inherit;color:inherit;cursor:pointer;width:100%}
  .drow:hover{border-color:var(--muted)}
  .drow strong{font-family:var(--mono);font-size:13px;font-weight:500}
  .drow .sub{grid-column:1/-1;font-size:13px;color:var(--muted)}
  .ed{display:flex;flex-direction:column;gap:14px}
  .ed-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
  .ed-top label{flex-direction:row;align-items:center;gap:8px}
  .ed-top select{width:auto}
  .ed-actions{display:flex;gap:8px;flex-wrap:wrap}
  details.fs{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:0 14px}
  details.fs>summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 0;font-family:var(--display);font-weight:700;font-size:16px}
  details.fs>summary::-webkit-details-marker{display:none}
  details.fs>summary::after{content:"+";font-family:var(--body);color:var(--muted);font-size:20px;line-height:1}
  details.fs[open]>summary::after{content:"\\2212"}
  details.fs .fs-body{display:flex;flex-direction:column;gap:12px;padding-bottom:16px}
  .pick{display:flex;flex-wrap:wrap;gap:6px}
  .pick label{flex-direction:row;align-items:center;gap:7px;border:1px solid var(--line);border-radius:99px;padding:7px 12px;font-size:13px;color:var(--ink);font-weight:500;cursor:pointer;background:var(--bg)}
  .pick label:has(input:checked){background:var(--accent-soft);border-color:var(--accent)}
  .pick input{width:16px;height:16px;accent-color:var(--accent);padding:0}
  .incl{flex-direction:row!important;align-items:center;gap:8px;color:var(--ink)!important;font-size:13px!important}
  .incl input{width:18px;height:18px;accent-color:var(--accent);padding:0}
  .confirm{flex-direction:row!important;align-items:flex-start;gap:10px;color:var(--ink)!important;font-size:15px!important;font-weight:600!important;background:var(--gold-soft);border-radius:12px;padding:12px}
  .confirm input{width:22px;height:22px;accent-color:var(--accent);padding:0;flex:none;margin-top:1px}
  .pg{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--bg)}
  .pg .pg-h{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:600;font-size:14px}
  .pg textarea{min-height:52px;font-size:14px;background:var(--surface)}
  .it{display:grid;grid-template-columns:1fr 96px 36px;gap:6px}
  .it3{display:grid;grid-template-columns:1fr 56px 84px 36px;gap:6px;align-items:center}
  .it3-h{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
  @media (max-width:440px){.it3{grid-template-columns:1fr 48px 72px 32px}}
  .ref-box{font-size:13px;white-space:pre-wrap;background:var(--bg);border-radius:10px;padding:10px;max-height:180px;overflow:auto;color:var(--muted)}
  .sumbox{display:grid;grid-template-columns:1fr auto;gap:4px 12px;font-size:14px;background:var(--bg);border-radius:12px;padding:12px}
  .sumbox .num{text-align:right}
  .sumbox .tot{font-weight:600;border-top:1px solid var(--line);padding-top:6px}
  .ed-bar{position:sticky;bottom:0;padding-block:10px calc(10px + env(safe-area-inset-bottom,0px));background:var(--bg);border-top:1px solid var(--line);display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;z-index:5}
  .ed-bar .note{flex:1;min-width:140px}
  .warnbox{background:var(--wait-soft);color:var(--ink);border-radius:12px;padding:12px 14px;font-size:14px}
  .warnbox ul{margin:6px 0 0;padding-left:18px}
  .okbox{background:var(--accent-soft);border-radius:12px;padding:10px 14px;font-size:14px}
  .doc-pages{display:flex;flex-direction:column;gap:14px;width:100%;max-width:760px;margin:0 auto}
  .doc-page{background:#fff;border:1px solid var(--line);border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .doc-page canvas{display:block}
  .tot-line{display:flex;justify-content:space-between;font-weight:600;padding:8px 2px;border-top:1px solid var(--line)}
  `;
  document.head.appendChild(st);

  /* ---------- data helpers ---------- */
  let booted = false;
  window.docsBoot = function () {
    if (!db || booted) return; booted = true;
    db.collection("docs").onSnapshot(s => { docsList = s.docs.map(d => ({ id: d.id, ...d.data() })); if ((view === "docs" && dv === "home") || view === "today" || view === "projects") render(); }, () => { });
  };
  const brand = () => { const s = S(); return { name: s.bizName, title: s.tagline, tagline: s.service, email: s.email, phone: s.phone, portfolio: s.portfolio, payInfo: s.payInfo, about: s.about }; };
  const proj = (pid) => projects.find(x => x.id === pid);
  const projPays = (p) => Array.isArray(p?.payments) ? p.payments : (+p?.paid > 0 ? [{ date: "", amount: +p.paid, note: "Earlier payment" }] : []);
  const projTotal = (p) => !p ? 0 : (Array.isArray(p.scope) && p.scope.length ? r2(p.scope.reduce((s, l) => s + (+l.price || 0), 0)) : r2(+p.price || 0));
  const projPaid = (p) => r2(projPays(p).reduce((s, x) => s + (+x.amount || 0), 0));
  const pagePreset = (k) => { const p = PR.PAGES.find(x => x[0] === k); return p ? { key: p[0], name: p[1], purpose: p[2] } : null; };
  const sumItems = (d) => (d.items || []).reduce((s, l) => s + (+l.price || 0), 0);
  const monthLabel = (off) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + off, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); };
  const newId = () => "pay_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function nextNumber(prefix) {
    const Y = String(year()), re = new RegExp(`^${prefix}-${Y}-(\\d+)$`);
    const max = docsList.reduce((m, d) => { const x = re.exec(d.number || ""); return x ? Math.max(m, +x[1]) : m; }, 0);
    return `${prefix}-${Y}-${String(max + 1).padStart(3, "0")}`;
  }
  const receiptsFor = (invNo) => docsList.filter(x => x.type === "receipt" && x.data && x.data.confirmed && x.data.invoiceNo === invNo);
  const invoicePaid = (inv) => r2(receiptsFor(inv.number).reduce((s, x) => s + (+x.data.amount || 0), 0));
  function invoiceState(inv) {
    if (inv.status === "Cancelled") return ["Cancelled", "plain"];
    const paid = invoicePaid(inv), tot = +inv.total || 0;
    if (tot > 0 && paid >= tot) return ["Paid", ""];
    if (paid > 0) return ["Partly paid", "gold"];
    const due = inv.data && +inv.data.dueDays ? E.addDays(inv.data.date, inv.data.dueDays) : inv.data?.date;
    if (inv.status === "Sent" && due && due < today()) return ["Overdue", "wait"];
    return [inv.status || "Draft", inv.status === "Sent" ? "gold" : "plain"];
  }
  function stateOf(d) {
    if (d.type === "invoice") return invoiceState(d);
    if (d.type === "receipt") return d.data?.confirmed ? ["Received", ""] : ["Draft", "plain"];
    const s = d.status || "Draft"; return [s, s === "Accepted" ? "" : s === "Sent" ? "gold" : "plain"];
  }

  /* ---------- proposal ---------- */
  function itemsFromProject(p) {
    if (Array.isArray(p.scope) && p.scope.length) return p.scope.map(l => ({ item: l.item, price: +l.price || 0 }));
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

  /* ---------- invoice ---------- */
  function fillInvoice(d, pid, opts = {}) {
    const p = proj(pid);
    if (p) { d.org = p.client || p.name || ""; d.contactName = p.contactName || ""; d.phone = p.contact || ""; d.projectName = p.name || ""; }
    d.projectTotal = projTotal(p) || r2(opts.total || 0); d.projectPaid = projPaid(p);
    const name = d.projectName || "the website project", tot = d.projectTotal;
    const dp = +(opts.depositPct ?? p?.depositPct ?? S().depositPct) || 0;
    if (d.kind === "deposit") { d.items = [{ desc: `Deposit (${dp}%) for ${name}`, qty: 1, rate: r2(tot * dp / 100) }]; d.paidBefore = 0; d.showSummary = tot > 0; d.notes = ["start", "ref", "thanks"]; }
    else if (d.kind === "milestone") { d.items = [{ desc: `Milestone payment: ${d.milestone} (${d.milestonePct}%)`, qty: 1, rate: r2(tot * (+d.milestonePct || 0) / 100) }]; d.paidBefore = 0; d.showSummary = tot > 0; d.notes = ["next", "ref", "thanks"]; }
    else if (d.kind === "final") {
      const sc = p && Array.isArray(p.scope) && p.scope.length ? p.scope.map(l => ({ desc: l.item, qty: 1, rate: +l.price || 0 })) : (tot ? [{ desc: `${name}: full project`, qty: 1, rate: tot }] : []);
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

  /* ---------- receipt ---------- */
  function payKey(x, i) { return x.id || "idx:" + i; }
  function linkedIndex(p, ref) { const pays = projPays(p); if (!ref || ref === "new") return -1; if (ref.startsWith("idx:")) return +ref.slice(4); return pays.findIndex(x => x.id === ref); }
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
    const inv = docsList.find(x => x.type === "invoice" && x.number === d.invoiceNo);
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
    if (p && !opts.newPayment) { const pays = projPays(p); const i = opts.payRef ? -2 : pays.findIndex(x => !x.receiptNo && +x.amount > 0); if (opts.payRef) fillReceiptFromPayment(d, pid, opts.payRef); else if (i >= 0) fillReceiptFromPayment(d, pid, payKey(pays[i], i)); else guessReceipt(d, pid); }
    else guessReceipt(d, pid);
    return { type: "receipt", status: "Issued", projectId: pid || "", data: d };
  }
  async function syncPayment() {
    const d = cur.data, p = proj(cur.projectId); if (!p || !d.confirmed) return true;
    const pays = JSON.parse(JSON.stringify(projPays(p)));
    let i = linkedIndex(p, d.payRef);
    const entry = { date: d.date, amount: r2(d.amount), note: RC.TYPES[d.payType] || "Payment", method: d.method || "", ref: d.txRef || "", receiptNo: cur.number, invoiceNo: d.invoiceNo || "" };
    if (i >= 0 && pays[i]) { pays[i] = { ...pays[i], ...entry, id: pays[i].id || newId() }; d.payRef = pays[i].id; }
    else { const id = newId(); pays.push({ id, ...entry }); d.payRef = id; }
    try { await db.collection("projects").doc(p.id).update({ payments: pays, paid: r2(pays.reduce((s, x) => s + (+x.amount || 0), 0)), updatedAt: new Date().toISOString() }); return true; }
    catch (e) { toast("Couldn't add the payment to the project. Try again."); return false; }
  }

  /* ---------- type registry ---------- */
  const TY = {
    proposal: { prefix: "PRO", label: "Proposal", statuses: ["Draft", "Sent", "Accepted", "Declined"], make: (pid) => newProposal(pid), form: () => proposalForm(), check: (d) => PR.check(d), build: (d) => PR.build(d, brand()), total: (d) => sumItems(d), client: (d) => d.org },
    invoice: { prefix: "INV", label: "Invoice", statuses: ["Draft", "Sent", "Cancelled"], make: (pid) => newInvoice(pid), form: () => invoiceForm(), check: (d) => IN.check(d, brand()), build: (d) => IN.build(d, brand()), total: (d) => IN.totals(d).due, client: (d) => d.org },
    receipt: { prefix: "RCT", label: "Receipt", statuses: null, hard: true, make: (pid) => newReceipt(pid), form: () => receiptForm(), check: (d) => { const w = RC.check(d); const dup = dupReceipt(); if (dup) w.push(`This payment already has receipt ${dup}.`); return w; }, build: (d) => { prepReceipt(d, cur.projectId); return RC.build(d, brand()); }, total: (d) => +d.amount || 0, client: (d) => d.org },
  };
  function dupReceipt() {
    const d = cur.data, p = proj(cur.projectId); if (!p || !d.payRef || d.payRef === "new") return "";
    const x = projPays(p)[linkedIndex(p, d.payRef)];
    return x && x.receiptNo && x.receiptNo !== cur.number ? x.receiptNo : "";
  }

  /* ---------- home ---------- */
  let listFilter = "all";
  function renderHome() {
    const s = S(), all = docsList.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const list = listFilter === "all" ? all : listFilter === "other" ? all.filter(d => !["proposal", "invoice", "receipt"].includes(d.type)) : all.filter(d => d.type === listFilter);
    const unpaid = docsList.filter(d => d.type === "invoice" && ["Sent", "Overdue", "Partly paid"].includes(invoiceState(d)[0]));
    const owed = r2(unpaid.reduce((a, d) => a + Math.max(0, (+d.total || 0) - invoicePaid(d)), 0));
    const tab = (k, n) => `<button data-dact="lf" data-lf="${k}" aria-pressed="${listFilter === k}">${n}</button>`;
    $("view").innerHTML = `<div class="list">
      <div class="sec-head"><h2>Documents</h2><span class="note">USD · A4 · your brand</span></div>
      ${owed > 0 ? `<div class="warnbox"><strong>${M(owed)}</strong> still owed on ${unpaid.length} invoice${unpaid.length === 1 ? "" : "s"}. When a client pays, open the invoice and tap “Make receipt”.</div>` : ""}
      <section class="block"><div class="sec-head"><h2>Your documents</h2><span class="note">${all.length}</span></div>
        ${all.length ? `<div class="tabs dfilter" role="group" aria-label="Filter documents">${tab("all", "All") + tab("proposal", "Proposals") + tab("invoice", "Invoices") + tab("receipt", "Receipts") + tab("other", "Other")}</div>` : ""}
        ${list.length ? list.map(d => { const [stx, cls] = stateOf(d); return `<button class="drow" data-dact="open" data-did="${esc(d.id)}"><strong>${esc(d.number || "Draft")}</strong><span class="chip ${cls}">${esc(stx)}</span>
          <span class="sub">${esc((DOC_TYPES.find(t => t[0] === d.type) || [, "Document"])[1])} · ${esc(d.client || "No client")}${TY[d.type] && TY[d.type].money === false ? "" : ` · ${M(d.total || 0)}`} · ${esc(fmtDate(d.date || d.updatedAt))}</span></button>`; }).join("")
        : `<div class="empty">${all.length ? "Nothing here yet." : "No documents yet. Start with a proposal for your next client."}</div>`}
      </section>
      <section class="block"><div class="sec-head"><h2>New document</h2></div>
      <div class="dgrid">
        ${DOC_TYPES.filter(t => TY[t[0]]).map(([k, n, desc]) => `<div class="dtype"><span class="eyebrow">Template</span><h3>${n}</h3><p>${desc}</p><div class="row"><button class="btn sm" data-dact="new" data-dtype="${k}">New ${n.toLowerCase()}</button></div></div>`).join("")}
        <div class="dtype"><span class="eyebrow">Google Form</span><h3>Discovery questionnaire</h3>
          <p>${s.formLink ? "Send your form to new leads." : "Add your Google Form link in Settings to send it from here."}</p>
          <div class="row">${s.formLink ? `<button class="btn sm ghost" data-dact="formmsg">Copy form message</button>` : `<button class="btn sm ghost" data-dact="settings">Open Settings</button>`}</div></div>
      </div>
      ${DOC_TYPES.some(t => !TY[t[0]]) ? `<div class="dtype soon"><span class="eyebrow">On the way</span>
        <p><strong style="color:var(--ink)">Next milestone:</strong> ${DOC_TYPES.filter(t => !TY[t[0]]).map(t => t[1]).join(" · ")}</p></div>` : ""}
      </section></div>`;
  }

  /* ---------- form helpers ---------- */
  const opt = (v, c, label) => `<option value="${esc(v)}" ${String(c) === String(v) ? "selected" : ""}>${esc(label ?? v)}</option>`;
  const sel = (label, k, options, d, extra = "") => `<label>${label}<select data-pk="${k}" ${extra}>${options.map(o => Array.isArray(o) ? opt(o[0], d[k], o[1]) : opt(o, d[k])).join("")}</select></label>`;
  const txt = (label, k, d, attrs = "") => `<label>${label}<input data-pk="${k}" value="${esc(d[k] ?? "")}" ${attrs}></label>`;
  const incl = (k, d) => `<label class="incl"><input type="checkbox" data-sec="${k}" ${d.sections?.[k] !== false ? "checked" : ""}> Include this section</label>`;
  const fs = (id, title, body, open) => `<details class="fs" data-fs="${id}" ${open ? "open" : ""}><summary>${title}</summary><div class="fs-body">${body}</div></details>`;
  const projSelect = () => `<label>Project<select data-dproj="1">${[["", "No project (fill in by hand)"], ...projects.filter(x => x.status !== "lost").map(x => [x.id, x.name])].map(o => opt(o[0], cur.projectId, o[1])).join("")}</select></label>`;
  const priceListOpts = () => { const P = prices(), out = []; Object.entries(P.base || {}).forEach(([k, v]) => out.push([`base:${k}`, `${k}: design & build (home page) · $${v}`])); out.push(["page", `Extra page · $${P.page}`]); (P.features || []).forEach(f => out.push([`f:${f.k}`, `${f.n} · $${f.p}`])); return out; };
  let openFs = { client: true };

  function proposalForm() {
    const d = cur.data, p = proj(cur.projectId), total = sumItems(d);
    const priceList = [...priceListOpts(), ["disc15", "Church / nonprofit discount (−15%)"], ["custom", "Custom item (type it)"]];
    return [
      fs("client", "Project & client", `${projSelect()}
        ${p && p.brief ? `<div><span class="eyebrow">Their form answers (from the project)</span><div class="ref-box">${esc(p.brief)}</div></div>` : ""}
        <div class="grid2">${txt("Organization / client", "org", d, 'placeholder="e.g. Christ Life"')}${sel("Type of client", "industry", [["", "Choose…"], ...INDUSTRY], d)}
        ${txt("Contact person", "contactName", d)}${sel("Their role", "contactRole", [["", "Not needed"], ...ROLES], d)}
        ${txt("Phone / WhatsApp", "phone", d, 'inputmode="tel"')}${txt("Email (optional)", "email", d, 'inputmode="email"')}
        ${sel("Website type", "siteType", SITE_TYPES, d)}${txt("Proposal date", "date", d, 'type="date"')}
        ${sel("Valid for", "validDays", [[7, "7 days"], [14, "14 days"], [30, "30 days"]], d)}</div>`, openFs.client),
      fs("goals", "Goals", `<span class="note">What should the website help them do?</span>
        <div class="pick">${PR.GOALS.map(([k, n]) => `<label><input type="checkbox" data-arr="goals" value="${k}" ${d.goals.includes(k) ? "checked" : ""}>${esc(n)}</label>`).join("")}</div>
        <label>In the client's words (optional)<textarea data-pk="goalNote" placeholder="Copy one sentence from their form, if it helps">${esc(d.goalNote || "")}</textarea></label>`, openFs.goals),
      fs("pages", `Pages <span class="note num">${d.pages.length}</span>`, `<span class="note">Tap to add or remove a page. You can edit what each page is for.</span>
        <div class="pick">${PR.PAGES.map(([k, n]) => `<label><input type="checkbox" data-page="${k}" ${d.pages.some(x => x.key === k) ? "checked" : ""}>${esc(n)}</label>`).join("")}</div>
        ${d.pages.map((pg, i) => `<div class="pg"><div class="pg-h"><span>${esc(pg.name)}</span>${pg.key.startsWith("custom") ? `<button class="rm" data-dact="rmpage" data-i="${i}" aria-label="Remove page">×</button>` : ""}</div>
          <textarea data-pagep="${i}" aria-label="${esc(pg.name)} purpose">${esc(pg.purpose)}</textarea></div>`).join("")}
        <div class="it" style="grid-template-columns:1fr auto"><input id="d-newpage" placeholder="Other page name"><button class="btn sm ghost" data-dact="addpage">Add page</button></div>`, openFs.pages),
      fs("features", "Features", `<div class="pick">${PR.FEATURES.map(([k, n]) => `<label><input type="checkbox" data-arr="features" value="${k}" ${d.features.includes(k) ? "checked" : ""}>${esc(n)}</label>`).join("")}</div>
        ${(d.extraFeatures || []).map((f, i) => `<div class="it" style="grid-template-columns:1fr 36px"><input data-xf="${i}" value="${esc(f)}" aria-label="Extra feature"><button class="rm" data-dact="rmfeat" data-i="${i}" aria-label="Remove">×</button></div>`).join("")}
        <div class="row"><button class="btn sm ghost" data-dact="addfeat">+ Other feature</button></div>`, openFs.features),
      fs("design", "Design direction", `${incl("design", d)}<div class="grid2">${sel("Style", "style", PR.DESIGN, d)}${txt("Colors (optional)", "colors", d, 'placeholder="e.g. blue and gold from their logo"')}</div>
        ${txt("Design references (optional)", "references", d, 'placeholder="Websites they like"')}`, openFs.design),
      fs("domain", "Domain, hosting & email", `${incl("domain", d)}<div class="grid2">
        ${sel("Domain", "domain", [["register", "I register it in the client's name"], ["client", "Client already owns one"], ["help", "Client buys it, I guide them"], ["none", "Leave out"]], d)}
        ${txt("Preferred domain (optional)", "domainName", d, 'placeholder="e.g. christlife.org"')}
        ${sel("Hosting", "hosting", [["client", "Client pays the host directly"], ["included", "First year included in price"], ["free", "Free hosting plan"], ["none", "Leave out"]], d)}
        ${sel("Business email", "bizEmail", [["none", "Not included"], ["setup", "I set it up"], ["addon", "Optional add-on"]], d)}</div>`, openFs.domain),
      fs("timeline", "Timeline", `${incl("timeline", d)}<div class="grid2">
        ${sel("Project length", "weeks", [1, 2, 3, 4, 5, 6, 8].map(n => [n, `${n} week${n > 1 ? "s" : ""}`]), d)}
        ${sel("Work starts", "start", PR.START, d)}
        ${sel("Client sends feedback within", "reviewDays", [[2, "2 days"], [3, "3 days"], [5, "5 days"]], d)}</div>
        <span class="note">The week-by-week table is created for you from the project length.</span>`, openFs.timeline),
      fs("support", "Revisions & support", `${incl("support", d)}<div class="grid2">
        ${sel("Revision rounds", "revisions", [[1, "1 round"], [2, "2 rounds"], [3, "3 rounds"]], d)}
        ${sel("Free support after launch", "supportDays", [[14, "14 days"], [30, "30 days"], [60, "60 days"], [90, "90 days"]], d)}
        ${sel("Monthly maintenance", "maintenance", [["none", "Don't offer"], ["offer", "Offer a monthly plan"]], d)}
        ${d.maintenance === "offer" ? txt("Monthly price (USD)", "maintenancePrice", d, 'type="number" min="0" inputmode="decimal"') : ""}</div>`, openFs.support),
      fs("money", `Investment <span class="note num" id="d-total">${M(total)}</span>`, `
        ${(d.items || []).map((l, i) => `<div class="it"><input data-item="${i}" data-fl="item" value="${esc(l.item)}" aria-label="Item"><input data-item="${i}" data-fl="price" type="number" inputmode="decimal" value="${esc(l.price)}" aria-label="Price"><button class="rm" data-dact="rmitem" data-i="${i}" aria-label="Remove item">×</button></div>`).join("") || `<p class="note">No items yet.</p>`}
        <div class="grid2"><label>Add from your price list<select data-additem="1"><option value="">Choose an item…</option>${priceList.map(o => opt(o[0], "", o[1])).join("")}</select></label>
        ${p ? `<label>&nbsp;<button class="btn sm ghost" data-dact="loadproj" type="button">Use the project's price</button></label>` : ""}</div>
        <div class="tot-line"><span>Total</span><span class="num" id="d-total2">${M(total)}</span></div>
        <div class="grid2">${sel("Payment plan", "plan", [["deposit", `Deposit (${d.depositPct}%) to start, balance on launch`], ["50-50", "50% to start, 50% on launch"], ["30-40-30", "30% start, 40% design, 30% launch"], ["full", "100% before work starts"]], d)}
        ${d.plan === "deposit" ? sel("Deposit", "depositPct", [10, 20, 25, 30, 40, 50].map(n => [n, n + "%"]), d) : ""}</div>
        ${S().payInfo ? "" : `<p class="note">Tip: add how clients pay you in Settings and it will show on the proposal.</p>`}`, openFs.money),
      fs("about", "About you", `${incl("about", d)}<p class="note">Uses the “About me” text from Settings.</p>`, openFs.about)
    ].join("");
  }

  function invTotalsHTML(d) {
    const t = IN.totals(d);
    return `<span>Subtotal</span><span class="num">${M(t.sub)}</span>${t.disc ? `<span>Discount</span><span class="num">${M(-t.disc)}</span>` : ""}${t.tax ? `<span>${esc(d.taxLabel || "Tax")}</span><span class="num">${M(t.tax)}</span>` : ""}${t.paid ? `<span>Total</span><span class="num">${M(t.total)}</span><span>Already paid</span><span class="num">${M(-t.paid)}</span>` : ""}<span class="tot">Amount due</span><span class="num tot">${M(t.due)}</span>`;
  }
  function invoiceForm() {
    const d = cur.data, p = proj(cur.projectId), t = IN.totals(d);
    const dueOpts = [[0, "Due on receipt"], [3, "In 3 days"], [7, "In 7 days"], [14, "In 14 days"], [30, "In 30 days"]];
    const months = [-1, 0, 1, 2, 3].map(o => monthLabel(o));
    return [
      fs("client", "Invoice type & project", `
        <label>What is this invoice for?<select data-ikind="1">${KIND_OPTS.map(o => opt(o[0], d.kind, o[1])).join("")}</select></label>
        ${projSelect()}
        ${p ? `<p class="note">Project total ${M(projTotal(p))} · Paid so far ${M(projPaid(p))}${projTotal(p) ? "" : " · Add the price in the project's Money tab to fill amounts for you."}</p>` : ""}
        ${d.kind === "milestone" ? `<div class="grid2">${sel("Milestone", "milestone", MILESTONES, d, 'data-refill="1"')}${sel("Share of project", "milestonePct", [20, 25, 30, 40, 50, 60].map(n => [n, n + "%"]), d, 'data-refill="1"')}</div>` : ""}
        ${d.kind === "maintenance" ? `<div class="grid2">${sel("Month", "month", months, d, 'data-refill="1"')}<label>Monthly price (USD)<input data-pk="monthlyPrice" data-refill="1" type="number" min="0" inputmode="decimal" value="${esc(d.monthlyPrice)}"></label></div>` : ""}
        <div class="grid2">${txt("Issue date", "date", d, 'type="date"')}${sel("Payment due", "dueDays", dueOpts, d)}</div>`, openFs.client),
      fs("billto", "Bill to", `<div class="grid2">${txt("Organization / client", "org", d)}${txt("Contact person", "contactName", d)}
        ${txt("Phone / WhatsApp", "phone", d, 'inputmode="tel"')}${txt("Email (optional)", "email", d, 'inputmode="email"')}</div>
        ${txt("Address (optional)", "address", d)}`, openFs.billto),
      fs("items", `Items <span class="note num" id="d-total">${M(t.due)}</span>`, `
        <div class="it3"><span class="it3-h">Description</span><span class="it3-h">Qty</span><span class="it3-h">Rate $</span><span></span></div>
        ${(d.items || []).map((l, i) => `<div class="it3"><input data-ii="${i}" data-fl="desc" value="${esc(l.desc)}" aria-label="Description" placeholder="What it's for"><input data-ii="${i}" data-fl="qty" type="number" min="0" inputmode="decimal" value="${esc(l.qty)}" aria-label="Quantity"><input data-ii="${i}" data-fl="rate" type="number" inputmode="decimal" value="${esc(l.rate)}" aria-label="Rate"><button class="rm" data-dact="rmii" data-i="${i}" aria-label="Remove item">×</button></div>`).join("") || `<p class="note">No items yet.</p>`}
        <label>Add from your price list<select data-addii="1"><option value="">Choose an item…</option>${[...priceListOpts(), ["custom", "Custom item (type it)"]].map(o => opt(o[0], "", o[1])).join("")}</select></label>
        <div class="sumbox" id="d-sum">${invTotalsHTML(d)}</div>`, openFs.items),
      fs("disc", "Discount & tax", `<div class="grid2">${sel("Discount", "discType", [["none", "No discount"], ["percent", "Percent (%)"], ["amount", "Amount ($)"]], d)}
        ${d.discType !== "none" ? txt(d.discType === "percent" ? "Discount %" : "Discount $", "discValue", d, 'type="number" min="0" inputmode="decimal" data-live="1"') : ""}
        ${sel("Tax", "taxOn", [["", "No tax"], ["1", "Add tax"]], d)}
        ${d.taxOn ? txt("Tax name", "taxLabel", d) + txt("Tax %", "taxPct", d, 'type="number" min="0" inputmode="decimal" data-live="1"') : ""}</div>
        <p class="note">Only add tax if you are registered to charge it.</p>`, openFs.disc),
      fs("paid", "Payments", `${txt("Already paid toward this invoice (USD)", "paidBefore", d, 'type="number" min="0" inputmode="decimal" data-live="1"')}
        <p class="note">${d.kind === "final" ? "Filled from the payments logged on the project. Check it matches what you've received." : "Leave at 0 unless the client already paid part of this invoice."}</p>
        <label class="incl"><input type="checkbox" data-pk="showSummary" ${d.showSummary ? "checked" : ""}> Show project total and balance on the invoice</label>`, openFs.paid),
      fs("notes", "Notes", `<div class="pick">${IN.NOTES.map(([k, n]) => `<label><input type="checkbox" data-arr="notes" value="${k}" ${(d.notes || []).includes(k) ? "checked" : ""}>${esc(n)}</label>`).join("")}</div>
        <label>Extra note (optional)<textarea data-pk="customNote">${esc(d.customNote || "")}</textarea></label>
        ${S().payInfo ? `<p class="note">Payment instructions come from Settings: ${esc(S().payInfo)}</p>` : `<p class="note">Add how clients pay you in Settings. It will show on every invoice.</p>`}`, openFs.notes)
    ].join("");
  }

  function rcSumHTML(d) {
    prepReceipt(d, cur.projectId);
    if (!(+d.projectTotal > 0)) return `<span>Amount received</span><span class="num tot">${M(d.amount)}</span>`;
    const bal = r2(Math.max(0, d.projectTotal - d.paidToDate));
    return `<span>Project total</span><span class="num">${M(d.projectTotal)}</span><span>Paid to date (with this payment)</span><span class="num">${M(d.paidToDate)}</span><span class="tot">Balance remaining</span><span class="num tot">${bal > 0 ? M(bal) : "Paid in full"}</span>`;
  }
  function receiptForm() {
    const d = cur.data, p = proj(cur.projectId);
    const pays = projPays(p);
    const payOpts = [...pays.map((x, i) => [payKey(x, i), `${x.date ? fmtDate(x.date) + " · " : ""}${M(x.amount)} · ${x.note || "Payment"}${x.receiptNo ? ` (receipt ${x.receiptNo})` : ""}`]), ["new", "Record a new payment"]];
    const invs = docsList.filter(x => x.type === "invoice" && x.status !== "Cancelled" && (!cur.projectId || x.projectId === cur.projectId));
    return [
      fs("client", "Payment", `${projSelect()}
        ${p ? `<label>Which payment?<select data-rpay="1">${payOpts.map(o => opt(o[0], d.payRef, o[1])).join("")}</select></label>
          ${d.payRef === "new" ? `<p class="note">Saving this receipt adds the payment to the project, so your money total updates too.</p>` : ""}` : ""}
        <div class="grid2"><label>Amount received (USD)<input data-pk="amount" data-live="1" type="number" min="0" inputmode="decimal" value="${esc(d.amount)}"></label>${txt("Payment date", "date", d, 'type="date"')}
        ${sel("Payment method", "method", [["", "Choose…"], ...METHODS], d)}${txt("Transaction ID (optional)", "txRef", d, 'placeholder="From the SMS or bank slip"')}
        ${sel("For invoice", "invoiceNo", [["", "No invoice"], ...invs.map(x => [x.number, `${x.number} · ${M(x.total)}`])], d)}</div>
        <div class="sumbox" id="d-sum">${rcSumHTML(d)}</div>`, openFs.client),
      fs("from", "Received from", `<div class="grid2">${txt("Organization / client", "org", d)}${txt("Contact person", "contactName", d)}${txt("Phone / WhatsApp", "phone", d, 'inputmode="tel"')}</div>`, openFs.from),
      fs("details", "Receipt details", `<div class="grid2">${sel("Type of payment", "payType", Object.entries(RC.TYPES), d)}</div>
        ${txt("Description", "description", d)}
        <div class="row"><button class="btn sm ghost" data-dact="rcguess" type="button">Suggest type and description</button></div>`, openFs.details),
      `<label class="confirm"><input type="checkbox" data-pk="confirmed" ${d.confirmed ? "checked" : ""}><span>I confirm I have received this money.<br><span class="note" style="font-weight:400">A receipt is proof of payment. Only create one after the money is in your hand or account.</span></span></label>`
    ].join("");
  }

  /* ---------- editor ---------- */
  function renderEditor() {
    const T = TY[cur.type], d = cur.data, blockers = T.block ? T.block(d) : (T.hard ? T.check(d) : []);
    const warns = [...new Set([...blockers, ...T.check(d)])];
    const blockHard = blockers.length > 0;
    let extra = "";
    if (cur.type === "proposal" && cur.status === "Accepted" && cur.id) extra = `<button class="btn sm" data-dact="toinv">Create deposit invoice</button>`;
    if (cur.type === "invoice" && cur.id && cur.status !== "Cancelled") { const [stx] = invoiceState({ ...cur, total: T.total(d) }); if (stx !== "Paid") extra = `<button class="btn sm" data-dact="torc">Client paid? Make receipt</button>`; }
    const chipNow = cur.type === "invoice" && cur.id ? (() => { const [stx, cls] = invoiceState({ ...cur, total: T.total(d) }); return ` <span class="chip ${cls}" style="vertical-align:middle">${esc(stx)}</span>`; })() : "";
    $("view").innerHTML = `<div class="ed">
      <div class="ed-top"><button class="btn sm ghost" data-dact="back">${leaveArmed ? "Tap again to leave without saving" : "← Documents"}</button>
        ${T.statuses ? `<label class="note">Status <select data-dstatus="1">${T.statuses.map(s => opt(s, cur.status)).join("")}</select></label>` : ""}</div>
      <div><span class="eyebrow">${T.label}</span><h1 style="font-size:24px">${esc(cur.number || "New " + T.label.toLowerCase())}${chipNow}${dirty ? ` <span class="chip gold" style="vertical-align:middle">Unsaved</span>` : ""}</h1></div>
      ${extra ? `<div class="ed-actions">${extra}</div>` : ""}
      ${T.info ? T.info(d) : ""}
      <div class="tabs" role="group" aria-label="Mode" style="align-self:flex-start"><button data-dact="fill" aria-pressed="${mode === "fill"}">1. Fill in</button><button data-dact="preview" aria-pressed="${mode === "preview"}">2. Preview & save</button></div>
      ${mode === "fill" ? `<div id="docform" class="list">${T.form()}</div>` : `<div class="list">
        ${warns.length ? `<div class="warnbox"><strong>${blockHard ? "Fix these before saving the file:" : "Check before sending:"}</strong><ul>${warns.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>` : `<div class="okbox">Everything needed is filled in.</div>`}
        ${T.messageOnly ? T.preview(d) : `<div id="docprev" class="doc-pages"><div class="empty">Preparing preview…</div></div>`}</div>`}
      <div class="ed-bar">${mode === "fill"
        ? `<button class="btn ghost" data-dact="save">Save draft</button><button class="btn" data-dact="preview">Preview →</button>`
        : T.messageOnly ? `<button class="btn ghost" data-dact="fill">← Edit</button><span class="note" id="d-msg"></span><button class="btn" data-dact="save">Save</button>`
        : `<button class="btn ghost" data-dact="fill">← Edit</button><span class="note" id="d-msg"></span><div class="row">${T.word === false ? "" : `<button class="btn ghost" data-dact="docx" ${busy || blockHard ? "disabled" : ""}>Word file</button>`}<button class="btn" data-dact="pdf" ${busy || blockHard ? "disabled" : ""}>${pdfArmed ? "Save PDF anyway" : "Save PDF"}</button></div>`}</div>
    </div>`;
    if (mode === "preview" && !T.messageOnly) drawPreview();
  }
  async function drawPreview() {
    if (!$("docprev")) return;
    try {
      await ready(false);
      if (!$("docprev")) return;
      E.preview(TY[cur.type].build(cur.data), $("docprev"), Math.min(760, $("docprev").clientWidth || 600));
    } catch (e) { if ($("docprev")) $("docprev").innerHTML = `<div class="empty">Couldn't load the document tools. Check your connection, then tap “2. Preview & save” again.</div>`; }
  }

  try { if (db) window.docsBoot(); } catch (e) { }
  window.renderDocs = function () { if (dv === "edit" && cur) renderEditor(); else { dv = "home"; renderHome(); } };
  function openEditor(doc) { savedStatus = doc.id ? doc.status : null; savedConfirmed = !!(doc.id && doc.data && doc.data.confirmed); cur = JSON.parse(JSON.stringify(doc)); dirty = !doc.id; mode = "fill"; leaveArmed = false; pdfArmed = false; dv = "edit"; openFs = { client: true }; render(); window.scrollTo(0, 0); }
  function goDocs() { view = "docs"; try { localStorage.setItem("pv", view); } catch (e) { } }
  window.openProposalFor = function (pid) {
    goDocs();
    const ex = docsList.filter(d => d.type === "proposal" && d.projectId === pid).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];
    openEditor(ex || newProposal(pid));
  };
  window.openDocFor = function (type, pid, opts = {}) {
    goDocs();
    openEditor(type === "invoice" ? newInvoice(pid, opts.kind, opts) : type === "receipt" ? newReceipt(pid, opts) : TY[type] ? TY[type].make(pid, opts) : newProposal(pid));
  };
  window.DocsKit = { TY, DOC_TYPES, get cur() { return cur; }, get docsList() { return docsList; }, h: { opt, sel, txt, fs, incl, projSelect, priceListOpts }, get openFs() { return openFs; },
    proj, projPays, projTotal, projPaid, brand, monthLabel, nextNumber, invoicePaid, invoiceState, stateOf,
    openDoc: (id) => { const x = docsList.find(z => z.id === id); if (x) { goDocs(); openEditor(x); } }, rerender: () => { const y = window.scrollY; renderEditor(); window.scrollTo(0, y); }, touch: () => touch() };

  /* ---------- save & export ---------- */
  async function saveDoc(quiet) {
    if (!db) { toast("Can't save here. Open the page in Claude."); return false; }
    const T = TY[cur.type], d = cur.data;
    if (!cur.number) cur.number = nextNumber(T.prefix);
    d.number = cur.number;
    if (cur.type === "receipt") { prepReceipt(d, cur.projectId); if (d.confirmed && !dupReceipt() && !(await syncPayment())) return false; }
    const now = new Date().toISOString();
    const body = { type: cur.type, number: cur.number, status: cur.status || "Draft", projectId: cur.projectId || "", client: (T.client(d) || "").trim(), total: r2(T.total(d)), date: d.date || today(), data: d, createdAt: cur.createdAt || now, updatedAt: now };
    try {
      if (cur.id) await db.collection("docs").doc(cur.id).set(body);
      else { const ref = await db.collection("docs").add(body); cur.id = ref.id; }
      cur.createdAt = body.createdAt; dirty = false; if (!quiet) toast(`Saved as ${cur.number}`);
      const prev = { status: savedStatus, confirmed: savedConfirmed }; savedStatus = cur.status; savedConfirmed = !!d.confirmed;
      try { if (window.DocHooks) window.DocHooks.saved(JSON.parse(JSON.stringify(cur)), prev); } catch (e) { }
      return true;
    } catch (e) { toast(e && e.code === "quota_exceeded" ? "Storage is full. Delete old documents first." : "Couldn't save. Check your connection and try again."); return false; }
  }
  const fileBase = () => `${cur.number} ${(TY[cur.type].client(cur.data) || "Client").replace(/[^\w\- .&]+/g, "").trim()} - ${TY[cur.type].label}`.slice(0, 120);
  async function deliver(filename, blob) {
    const msg = $("d-msg");
    if (!downloads) { if (msg) msg.textContent = "Saving files only works when this page is open in Claude."; return; }
    try { await downloads.save({ filename, data: blob }); if ($("d-msg")) $("d-msg").textContent = `Saved ${filename}`; toast("File saved"); }
    catch (e) { const c = e && e.code; if ($("d-msg")) $("d-msg").textContent = c === "declined" ? "Save cancelled." : c === "rate_limited" ? "Another save is open. Try again in a moment." : "Couldn't save the file here."; }
  }
  async function exportFile(kind) {
    if (busy) return;
    const T = TY[cur.type], warns = T.check(cur.data), blockers = T.block ? T.block(cur.data) : (T.hard ? warns : []);
    if (blockers.length) { toast("Fix the items in the red box first."); return; }
    if (warns.length && !pdfArmed) { pdfArmed = true; renderEditor(); toast("Some details are missing. Tap again to save anyway."); return; }
    busy = true; renderEditor(); const msg = () => $("d-msg");
    try {
      if (!(await saveDoc(true))) return;
      if (msg()) msg().textContent = "Creating your file…";
      await ready(kind === "docx");
      const model = T.build(cur.data);
      if (kind === "pdf") { const { pdf } = E.toPdf(model); await deliver(fileBase() + ".pdf", pdf.output("blob")); }
      else { const blob = await E.toDocx(model); await deliver(fileBase() + ".docx", blob); }
    } catch (e) { if (msg()) msg().textContent = "Couldn't create the file. Check your connection and try again."; }
    finally { busy = false; pdfArmed = false; const keep = msg() ? msg().textContent : ""; renderEditor(); if (msg()) msg().textContent = keep; }
  }

  /* ---------- events ---------- */
  const V = $("view");
  const touch = () => { if (!dirty) { dirty = true; const h = V.querySelector(".ed h1"); if (h && !h.querySelector(".chip.gold")) h.insertAdjacentHTML("beforeend", ` <span class="chip gold" style="vertical-align:middle">Unsaved</span>`); } leaveArmed = false; pdfArmed = false; };
  function live() {
    const d = cur.data;
    if (cur.type === "proposal") { const t = M(sumItems(d)); ["d-total", "d-total2"].forEach(id => { const e = $(id); if (e) e.textContent = t; }); }
    if (cur.type === "invoice") { const e = $("d-sum"); if (e) e.innerHTML = invTotalsHTML(d); const t = $("d-total"); if (t) t.textContent = M(IN.totals(d).due); }
    if (cur.type === "receipt") { const e = $("d-sum"); if (e) e.innerHTML = rcSumHTML(d); }
    if (TY[cur.type].live) TY[cur.type].live(d);
  }
  const NUMERIC = ["validDays", "weeks", "reviewDays", "revisions", "supportDays", "depositPct", "dueDays", "milestonePct", "contentDays", "lateDays", "pauseDays", "closeDays", "noticeDays", "rounds"];
  V.addEventListener("input", (e) => {
    if (view !== "docs" || dv !== "edit" || !cur) return;
    const t = e.target, d = cur.data;
    if (t.dataset.pk && t.tagName !== "SELECT" && t.type !== "checkbox") { d[t.dataset.pk] = t.type === "number" ? (t.value === "" ? "" : +t.value) : t.value; touch(); if (t.type === "number") live(); }
    else if (t.dataset.pagep) { d.pages[+t.dataset.pagep].purpose = t.value; touch(); }
    else if (t.dataset.item) { const l = d.items[+t.dataset.item]; l[t.dataset.fl] = t.dataset.fl === "price" ? (t.value === "" ? 0 : +t.value) : t.value; touch(); live(); }
    else if (t.dataset.ii) { const l = d.items[+t.dataset.ii]; l[t.dataset.fl] = t.dataset.fl === "desc" ? t.value : (t.value === "" ? "" : +t.value); touch(); live(); }
    else if (t.dataset.xf) { d.extraFeatures[+t.dataset.xf] = t.value; touch(); }
    else if (t.dataset.rl && t.tagName !== "SELECT" && t.type !== "checkbox") { const row = d[t.dataset.rl][+t.dataset.ri]; row[t.dataset.rf] = t.type === "number" ? (t.value === "" ? "" : +t.value) : t.value; touch(); if (t.type === "number") live(); }
  });
  V.addEventListener("toggle", (e) => { const f = e.target.closest && e.target.closest("details.fs"); if (f) openFs[f.dataset.fs] = f.open; }, true);
  V.addEventListener("change", (e) => {
    if (view !== "docs" || dv !== "edit" || !cur) return;
    const t = e.target, d = cur.data; let re = true;
    if (t.dataset.dstatus) { cur.status = t.value; touch(); }
    else if (t.dataset.dproj) {
      cur.projectId = t.value;
      if (TY[cur.type].onProject) TY[cur.type].onProject(d, t.value);
      else if (cur.type === "proposal") { if (t.value) applyProject(d, t.value); }
      else if (cur.type === "invoice") fillInvoice(d, t.value);
      else { const p = proj(t.value); if (p) { d.org = p.client || p.name || ""; d.contactName = p.contactName || ""; d.phone = p.contact || ""; } const pays = projPays(p); const i = pays.findIndex(x => !x.receiptNo && +x.amount > 0); fillReceiptFromPayment(d, t.value, p && i >= 0 ? payKey(pays[i], i) : "new"); }
      touch();
    }
    else if (t.dataset.rl) { const row = d[t.dataset.rl][+t.dataset.ri]; row[t.dataset.rf] = t.type === "checkbox" ? t.checked : t.value; touch(); const T = TY[cur.type]; if (T.onRowChange) T.onRowChange(d, t.dataset.rl, +t.dataset.ri, t.dataset.rf); re = !!t.dataset.rr; if (!re) live(); }
    else if (t.dataset.ikind) { d.kind = t.value; fillInvoice(d, cur.projectId); touch(); toast("Items filled in for this type of invoice"); }
    else if (t.dataset.rpay) { fillReceiptFromPayment(d, cur.projectId, t.value); touch(); }
    else if (t.type === "checkbox" && t.dataset.pk) { d[t.dataset.pk] = t.checked; touch(); re = cur.type === "receipt"; }
    else if (t.dataset.pk && t.tagName === "SELECT") { const v = t.value; d[t.dataset.pk] = NUMERIC.includes(t.dataset.pk) ? +v : v; if (t.dataset.refill) { if (cur.type === "invoice") fillInvoice(d, cur.projectId); else if (TY[cur.type].refill) TY[cur.type].refill(d, t.dataset.pk); } touch(); }
    else if (t.dataset.dsrc) { const T = TY[cur.type]; if (T.fromSource) T.fromSource(d, t.value); touch(); }
    else if (t.dataset.pk && t.dataset.refill) { fillInvoice(d, cur.projectId); touch(); }
    else if (t.dataset.arr) { const a = d[t.dataset.arr] = d[t.dataset.arr] || []; const i = a.indexOf(t.value); if (t.checked && i < 0) a.push(t.value); if (!t.checked && i >= 0) a.splice(i, 1); touch(); re = false; }
    else if (t.dataset.page) { const k = t.dataset.page, i = d.pages.findIndex(x => x.key === k); if (t.checked && i < 0) { const order = PR.PAGES.map(p => p[0]); d.pages.push(pagePreset(k)); d.pages.sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99)); } if (!t.checked && i >= 0) d.pages.splice(i, 1); touch(); }
    else if (t.dataset.sec) { d.sections = d.sections || {}; d.sections[t.dataset.sec] = t.checked; touch(); re = false; }
    else if (t.dataset.additem || t.dataset.addii) {
      const v = t.value, P = prices(); if (!v) return;
      const add = (desc, price) => cur.type === "invoice" ? d.items.push({ desc, qty: 1, rate: price }) : d.items.push({ item: desc, price });
      if (v.startsWith("base:")) { const k = v.slice(5); add(`${k}: design & build (home page)`, +P.base[k] || 0); }
      else if (v === "page") add("Extra page", +P.page || 0);
      else if (v.startsWith("f:")) { const f = P.features.find(x => x.k === v.slice(2)); if (f) add(f.n, +f.p || 0); }
      else if (v === "disc15") { const sub = d.items.filter(l => +l.price > 0).reduce((s, l) => s + (+l.price), 0); add("Church / nonprofit discount (−15%)", -Math.round(sub * 0.15)); }
      else add("", 0);
      touch();
    }
    else re = false;
    if (re) { const y = window.scrollY; renderEditor(); window.scrollTo(0, y); }
  });
  V.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-dact]"); if (!b || view !== "docs") return;
    const a = b.dataset.dact, d = cur && cur.data, rerender = () => { const y = window.scrollY; renderEditor(); window.scrollTo(0, y); };
    if (a === "new") openEditor(TY[b.dataset.dtype].make(""));
    else if (a === "lf") { listFilter = b.dataset.lf; renderHome(); }
    else if (a === "open") { const x = docsList.find(z => z.id === b.dataset.did); if (x) openEditor(x); }
    else if (a === "formmsg") copy(`Hi! Thank you for reaching out about a website 🙏🏾\n\nPlease fill this short form so I can understand what you need:\n${S().formLink}\n\nOnce you're done, I'll review your answers and get back to you.\n\n— ${S().bizName}`, "Form message");
    else if (a === "settings") $("settingsBtn").click();
    else if (a === "back") { if (dirty && !leaveArmed) { leaveArmed = true; rerender(); return; } dv = "home"; cur = null; dirty = false; leaveArmed = false; render(); window.scrollTo(0, 0); }
    else if (a === "save") { if (await saveDoc(false)) rerender(); }
    else if (a === "preview") { mode = "preview"; pdfArmed = false; renderEditor(); window.scrollTo(0, 0); }
    else if (a === "fill") { mode = "fill"; renderEditor(); }
    else if (a === "pdf") exportFile("pdf");
    else if (a === "docx") exportFile("docx");
    else if (a === "toinv") { if (dirty && !(await saveDoc(true))) return; openEditor(newInvoice(cur.projectId, "deposit", { total: sumItems(d), depositPct: d.plan === "deposit" ? d.depositPct : d.plan === "50-50" ? 50 : d.plan === "30-40-30" ? 30 : 100 })); }
    else if (a === "torc") { if (dirty && !(await saveDoc(true))) return; const due = r2(IN.totals(d).due - invoicePaid({ number: cur.number })); openEditor(newReceipt(cur.projectId, { invoiceNo: cur.number, amount: due > 0 ? due : "", newPayment: true })); }
    else if (a === "rladd") { const T = TY[cur.type]; (d[b.dataset.rl] = d[b.dataset.rl] || []).push(T.newRow ? T.newRow(b.dataset.rl, d) : {}); touch(); rerender(); }
    else if (a === "rlrm") { d[b.dataset.rl].splice(+b.dataset.i, 1); touch(); rerender(); }
    else if (a === "tact") { const T = TY[cur.type]; if (T.action) { T.action(b.dataset.x, d, b); } }
    else if (a === "rcguess") { guessReceipt(d, cur.projectId); touch(); rerender(); }
    else if (a === "addpage") { const n = ($("d-newpage").value || "").trim(); if (!n) { toast("Type the page name first"); return; } d.pages.push({ key: "custom-" + Date.now(), name: n, purpose: "" }); touch(); rerender(); }
    else if (a === "rmpage") { d.pages.splice(+b.dataset.i, 1); touch(); rerender(); }
    else if (a === "addfeat") { (d.extraFeatures = d.extraFeatures || []).push(""); touch(); rerender(); }
    else if (a === "rmfeat") { d.extraFeatures.splice(+b.dataset.i, 1); touch(); rerender(); }
    else if (a === "rmitem" || a === "rmii") { d.items.splice(+b.dataset.i, 1); touch(); rerender(); }
    else if (a === "loadproj") { const p = proj(cur.projectId); const it = p ? itemsFromProject(p) : []; if (!it.length) { toast("That project has no price yet. Add it in the project's Money tab."); return; } d.items = it; touch(); rerender(); }
  });
})();
