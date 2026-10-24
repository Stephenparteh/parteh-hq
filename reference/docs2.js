/* Milestone 4 builders: agreement, timeline, content checklist, revision log, handover, testimonial request. Registers into DocsKit.TY. */
(function () {
  "use strict";
  const K = window.DocsKit, E = window.DocEngine, PR = E.proposal, M = E.money, r2 = E.r2;
  if (!K) return;
  const st2 = document.createElement("style");
  st2.textContent = `.ctrow{display:grid;grid-template-columns:1fr 132px 36px;gap:6px;align-items:center;padding-bottom:6px;border-bottom:1px solid var(--line)}
  @media (max-width:520px){.ctrow{grid-template-columns:1fr 36px}.ctrow select{grid-column:1;grid-row:2}.ctrow .rm{grid-column:2;grid-row:1}}`;
  document.head.appendChild(st2);
  const { opt, sel, txt, fs, projSelect } = K.h;
  const AG = E.agreement, TL = E.timeline, CT = E.content, RV = E.revision, HO = E.handover, TS = E.testimonial;
  const ROLES = ["Founder", "Pastor", "Director", "Manager", "Owner", "CEO", "Secretary", "Coordinator", "Administrator"];
  const BACKEND = ["admin", "blog", "events", "giving", "contact", "newsletter"];
  const open = (id) => K.openFs[id];
  const rin = (list, i, f, v, attrs = "") => `<input data-rl="${list}" data-ri="${i}" data-rf="${f}" value="${esc(v ?? "")}" ${attrs}>`;
  const rsel = (list, i, f, options, v, extra = "") => `<select data-rl="${list}" data-ri="${i}" data-rf="${f}" ${extra}>${options.map(o => Array.isArray(o) ? opt(o[0], v, o[1]) : opt(o, v)).join("")}</select>`;
  const pickArr = (key, items, d) => `<div class="pick">${items.map(([v, n]) => `<label><input type="checkbox" data-arr="${key}" value="${esc(v)}" ${(d[key] || []).includes(v) ? "checked" : ""}>${esc(n)}</label>`).join("")}</div>`;
  const days = (arr, unit = "days") => arr.map(n => [n, `${n} ${unit}`]);

  function latestProposal(pid) {
    const ps = K.docsList.filter(x => x.type === "proposal" && (!pid || x.projectId === pid)).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return ps.find(x => x.status === "Accepted") || ps[0] || null;
  }
  function clientFrom(pid, prop) {
    const p = K.proj(pid), pd = prop && prop.data || {};
    return { org: (p && (p.client || p.name)) || pd.org || "", contactName: (p && p.contactName) || pd.contactName || "", contactRole: pd.contactRole || "", phone: (p && p.contact) || pd.phone || "", projectName: (p && p.name) || "" };
  }
  const featureLabels = (pd) => PR.FEATURES.filter(f => (pd.features || []).includes(f[0])).map(f => f[1]).concat((pd.extraFeatures || []).filter(Boolean));

  /* ---------- AGREEMENT ---------- */
  function agFromProposal(d, prop) {
    if (!prop) { d.proposalNo = ""; return; }
    const pd = prop.data || {};
    Object.assign(d, { proposalNo: prop.number || "", pages: (pd.pages || []).map(p => p.name).filter(Boolean), features: featureLabels(pd), total: r2((pd.items || []).reduce((s, l) => s + (+l.price || 0), 0)),
      plan: pd.plan || "deposit", depositPct: pd.depositPct ?? S().depositPct, weeks: pd.weeks || 4, start: pd.start || PR.START[0], reviewDays: pd.reviewDays || 3, revisions: pd.revisions || 2, supportDays: pd.supportDays || 30, hosting: pd.hosting || "client" });
    if (pd.org) d.org = pd.org; if (pd.contactName) d.contactName = pd.contactName; if (pd.contactRole) d.contactRole = pd.contactRole; if (pd.phone) d.phone = pd.phone;
  }
  function newAgreement(pid) {
    const prop = latestProposal(pid), p = K.proj(pid);
    const d = { date: today(), ...clientFrom(pid, prop), address: "", proposalNo: "", pages: [], features: [], extraDeliverables: "", total: K.projTotal(p), plan: "deposit", depositPct: S().depositPct ?? 50,
      weeks: 4, start: PR.START[0], contentDays: 7, reviewDays: 3, lateTerms: "pause", lateDays: 14, depositTerms: "nonrefundable", revisions: 2, extraRate: "", pauseDays: 14, closeDays: 60,
      ipTransfer: "full", portfolio: "yes", hosting: "client", noticeDays: 14, supportDays: 30, jurisdiction: AG.JURIS[0] };
    agFromProposal(d, prop);
    return { type: "agreement", status: "Draft", projectId: pid || "", data: d };
  }
  function agreementForm() {
    const d = K.cur.data, props = K.docsList.filter(x => x.type === "proposal" && (!K.cur.projectId || x.projectId === K.cur.projectId));
    const pageNames = [...new Set([...PR.PAGES.map(p => p[1]), ...(d.pages || [])])].map(n => [n, n]);
    const featNames = [...new Set([...PR.FEATURES.map(f => f[1]), ...(d.features || [])])].map(n => [n, n]);
    return [
      fs("client", "Client & proposal", `${projSelect()}
        <label>Based on proposal<select data-dsrc="1">${[["", "None (fill in by hand)"], ...props.map(x => [x.id, `${x.number} · ${x.status || "Draft"} · ${M(x.total)}`])].map(o => opt(o[0], (props.find(x => x.number === d.proposalNo) || {}).id || "", o[1])).join("")}</select></label>
        <div class="grid2">${txt("Organization / client", "org", d)}${txt("Who signs for the client", "contactName", d)}
        ${sel("Their role", "contactRole", [["", "Not needed"], ...ROLES.map(r => [r, r])], d)}${txt("Phone / WhatsApp", "phone", d, 'inputmode="tel"')}
        ${txt("Client address (optional)", "address", d)}${txt("Agreement date", "date", d, 'type="date"')}</div>`, open("client")),
      fs("scope", "Scope of work", `<span class="note">Pages</span>${pickArr("pages", pageNames, d)}
        <span class="note">Features</span>${pickArr("features", featNames, d)}
        <label>Other deliverables (one per line, optional)<textarea data-pk="extraDeliverables">${esc(d.extraDeliverables || "")}</textarea></label>`, open("scope")),
      fs("money", `Fees & payment <span class="note num">${M(d.total)}</span>`, `<div class="grid2">
        <label>Total fee (USD)<input data-pk="total" type="number" min="0" inputmode="decimal" value="${esc(d.total)}"></label>
        ${sel("Payment plan", "plan", [["deposit", `Deposit (${d.depositPct}%) to start, balance on launch`], ["50-50", "50% to start, 50% on launch"], ["30-40-30", "30% start, 40% design, 30% launch"], ["full", "100% before work starts"]], d)}
        ${d.plan === "deposit" ? sel("Deposit", "depositPct", [10, 20, 25, 30, 40, 50].map(n => [n, n + "%"]), d) : ""}
        ${sel("Deposit refund", "depositTerms", [["nonrefundable", "Not refundable once work starts"], ["refundable_before", "Refundable only before work starts"]], d)}
        ${sel("Late payments", "lateTerms", [["pause", "I may pause work"], ["none", "Say nothing"]], d)}
        ${d.lateTerms === "pause" ? sel("Pause after", "lateDays", days([7, 14, 30]), d) : ""}</div>`, open("money")),
      fs("time", "Timeline & client duties", `<div class="grid2">
        ${sel("Project length", "weeks", [1, 2, 3, 4, 5, 6, 8].map(n => [n, `${n} week${n > 1 ? "s" : ""}`]), d)}${sel("Work starts", "start", PR.START, d)}
        ${sel("Client sends content within", "contentDays", days([3, 7, 14]), d)}${sel("Client gives feedback within", "reviewDays", days([2, 3, 5]), d)}
        ${sel("Pause project after no reply for", "pauseDays", days([7, 14, 30]), d)}${sel("Either side can end it after a pause of", "closeDays", days([30, 60, 90]), d)}</div>`, open("time")),
      fs("terms", "Revisions, ownership & other terms", `<div class="grid2">
        ${sel("Revision rounds", "revisions", [[1, "1 round"], [2, "2 rounds"], [3, "3 rounds"]], d)}
        <label>Extra work hourly rate (optional, USD)<input data-pk="extraRate" type="number" min="0" inputmode="decimal" value="${esc(d.extraRate)}" placeholder="Leave empty to quote each time"></label>
        ${sel("Client owns the work", "ipTransfer", [["full", "Once fully paid"], ["launch", "At launch, once fully paid"]], d)}
        ${sel("Show it in my portfolio", "portfolio", [["yes", "Yes, unless they say no"], ["no", "Don't mention it"]], d)}
        ${sel("Hosting", "hosting", [["client", "Client pays the host"], ["included", "First year included"], ["free", "Free hosting plan"]], d)}
        ${sel("Notice to cancel", "noticeDays", days([7, 14, 30]), d)}
        ${sel("Free support after launch", "supportDays", days([14, 30, 60, 90]), d)}
        ${txt("Laws of", "jurisdiction", d)}</div>`, open("terms")),
    ].join("");
  }
  const legalInfo = () => `<div class="warnbox" style="background:var(--gold-soft)"><strong>Template, not legal advice.</strong> I'm not a lawyer. Before you use this with clients, ask a lawyer in Liberia to check these parts:<ul>${AG.LEGAL_FLAGS.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>`;

  /* ---------- TIMELINE ---------- */
  function regenRows(d) {
    const old = {}; (d.rows || []).forEach(r => old[r.stage] = r.status);
    d.rows = TL.rows(d.startDate || today(), d.weeks, !!d.hasBack, d.reviewDays).map(r => ({ ...r, status: old[r.stage] || r.status }));
  }
  function newTimeline(pid) {
    const prop = latestProposal(pid), pd = prop && prop.data || {};
    const d = { date: today(), ...clientFrom(pid, prop), startDate: today(), weeks: pd.weeks || 4, hasBack: prop ? ((pd.features || []).some(k => BACKEND.includes(k)) ? "1" : "") : "1", reviewDays: pd.reviewDays || 3, rows: [], note: "" };
    regenRows(d);
    return { type: "timeline", status: "Draft", projectId: pid || "", data: d };
  }
  function timelineForm() {
    const d = K.cur.data, rows = d.rows || [], done = rows.filter(r => r.status === "Done").length;
    return [
      fs("client", "Project & dates", `${projSelect()}<div class="grid2">${txt("Organization / client", "org", d)}${txt("Contact person", "contactName", d)}
        ${txt("Start date", "startDate", d, 'type="date"')}${sel("Project length", "weeks", [1, 2, 3, 4, 5, 6, 8].map(n => [n, `${n} week${n > 1 ? "s" : ""}`]), d, 'data-refill="1"')}
        ${sel("Has a back end (forms, admin…)", "hasBack", [["1", "Yes"], ["", "No"]], d, 'data-refill="1"')}${sel("Client review time", "reviewDays", days([2, 3, 5]), d, 'data-refill="1"')}</div>
        <div class="row"><button class="btn sm ghost" data-dact="tact" data-x="regen" type="button">Recalculate dates</button><span class="note">Keeps the status of each stage.</span></div>`, open("client")),
      fs("stages", `Stages <span class="note num">${done}/${rows.length} done</span>`, rows.map((r, i) => `<div class="pg"><div class="pg-h">${rin("rows", i, "stage", r.stage, 'aria-label="Stage name"')}<button class="rm" data-dact="rlrm" data-rl="rows" data-i="${i}" aria-label="Remove stage">×</button></div>
          <div class="grid2"><label>From${rin("rows", i, "start", r.start, 'type="date"')}</label><label>To${rin("rows", i, "end", r.end, 'type="date"')}</label></div>
          ${rin("rows", i, "desc", r.desc, 'aria-label="What happens"')}
          <label>Status${rsel("rows", i, "status", TL.STATUS, r.status, 'data-rr="1"')}</label></div>`).join("") + `<div class="row"><button class="btn sm ghost" data-dact="rladd" data-rl="rows">+ Add stage</button></div>`, open("stages")),
      fs("note", "Note (optional)", `<label>Extra note on the timeline<textarea data-pk="note">${esc(d.note || "")}</textarea></label>`, open("note")),
    ].join("");
  }

  /* ---------- CONTENT CHECKLIST ---------- */
  function newContent(pid) {
    const p = K.proj(pid), prop = latestProposal(pid);
    let items;
    if (p && Array.isArray(p.content) && p.content.length) items = p.content.map(c => ({ cat: "", label: c.label, status: c.done ? "rec" : "req", note: "" }));
    else items = CT.PRESETS.map(([cat, label]) => ({ cat, label, status: /Prices|Videos|privacy|Booking/i.test(label) ? "no" : "req", note: "" }));
    const d = { date: today(), dueDate: E.addDays(today(), 7), sendVia: "WhatsApp", ...clientFrom(pid, prop), items };
    return { type: "content", status: "Draft", projectId: pid || "", data: d };
  }
  function contentForm() {
    const d = K.cur.data, items = d.items || [], have = new Set(items.map(x => x.label));
    const missing = CT.PRESETS.filter(p => !have.has(p[1]));
    const got = items.filter(x => x.status === "rec" || x.status === "ok").length, need = items.filter(x => x.status !== "no").length;
    return [
      fs("client", "Project & deadline", `${projSelect()}<div class="grid2">${txt("Organization / client", "org", d)}${txt("Contact person", "contactName", d)}
        ${txt("Send content by", "dueDate", d, 'type="date"')}${sel("How to send", "sendVia", ["WhatsApp", "Email", "Google Drive link", "In person"], d)}</div>`, open("client")),
      fs("items", `Items <span class="note num">${got}/${need} received</span>`, items.map((x, i) => `<div class="ctrow">${rin("items", i, "label", x.label, 'aria-label="Item"')}${rsel("items", i, "status", CT.STATUS, x.status, 'aria-label="Status" data-rr="1"')}<button class="rm" data-dact="rlrm" data-rl="items" data-i="${i}" aria-label="Remove">×</button></div>`).join("")
        + `${missing.length ? `<label>Add from the list<select data-pk="_add" data-refill="1"><option value="">Choose an item…</option>${missing.map(p => opt(p[1], "", `${p[0]}: ${p[1]}`)).join("")}</select></label>` : ""}
        <div class="row"><button class="btn sm ghost" data-dact="rladd" data-rl="items">+ Custom item</button><button class="btn sm ghost" data-dact="tact" data-x="copymissing">Copy “still needed” message</button></div>
        <p class="note">Not requested items don't show on the PDF.</p>`, open("items")),
    ].join("");
  }

  /* ---------- REVISION LOG ---------- */
  function newRevision(pid) {
    const prop = latestProposal(pid), pd = prop && prop.data || {};
    const d = { date: today(), ...clientFrom(pid, prop), rounds: pd.revisions || 2, pagesList: (pd.pages || []).map(p => p.name).filter(Boolean), requests: [] };
    return { type: "revision", status: "Open", projectId: pid || "", data: d };
  }
  const revSum = (d) => { const t = RV.totals(d); return `<span>Revision rounds included</span><span class="num">${d.rounds || 2}</span><span>Rounds used</span><span class="num">${t.rounds}</span><span>Extra requests</span><span class="num">${t.extraCount}</span><span class="tot">Extra work total</span><span class="num tot">${M(t.extraCost)}</span>`; };
  function revisionForm() {
    const d = K.cur.data, reqs = d.requests || [];
    const pages = [...new Set([...(d.pagesList && d.pagesList.length ? d.pagesList : ["Home", "About", "Services / Programs", "Contact"]), "Whole website", "Other"])];
    return [
      fs("client", "Project", `${projSelect()}<div class="grid2">${txt("Organization / client", "org", d)}${txt("Contact person", "contactName", d)}
        ${sel("Revision rounds included", "rounds", [[1, "1 round"], [2, "2 rounds"], [3, "3 rounds"]], d)}${txt("Last updated", "date", d, 'type="date"')}</div>
        <div class="sumbox" id="d-sum">${revSum(d)}</div>
        <div class="row"><button class="btn sm ghost" data-dact="tact" data-x="copyhow">Copy “how to send changes” message</button></div>`, open("client")),
      fs("reqs", `Requests <span class="note num">${reqs.length}</span>`, reqs.map((r, i) => `<div class="pg"><div class="pg-h"><span>Request ${i + 1}</span><button class="rm" data-dact="rlrm" data-rl="requests" data-i="${i}" aria-label="Remove request">×</button></div>
          <div class="grid2"><label>Date${rin("requests", i, "date", r.date, 'type="date"')}</label><label>Page${rsel("requests", i, "page", pages, r.page)}</label></div>
          <label>What they want changed<textarea data-rl="requests" data-ri="${i}" data-rf="desc">${esc(r.desc || "")}</textarea></label>
          <div class="grid2"><label>In scope?${rsel("requests", i, "scope", RV.SCOPE, r.scope, 'data-rr="1"')}</label>
          ${r.scope === "in" ? `<label>Revision round${rsel("requests", i, "round", [["1", "Round 1"], ["2", "Round 2"], ["3", "Round 3"]], r.round)}</label>` : ""}
          ${r.scope === "extra" ? `<label>Extra cost (USD)${rin("requests", i, "cost", r.cost, 'type="number" min="0" inputmode="decimal"')}</label>` : ""}
          <label>Status${rsel("requests", i, "status", RV.STATUS, r.status)}</label><label>Time impact${rsel("requests", i, "impact", RV.IMPACT, r.impact)}</label></div></div>`).join("")
        + `<div class="row"><button class="btn sm ghost" data-dact="rladd" data-rl="requests">+ Add request</button>${RV.totals(d).extraCount ? `<button class="btn sm ghost" data-dact="tact" data-x="copyextra">Copy extra-cost approval message</button>` : ""}</div>`, open("reqs") ?? true),
    ].join("");
  }

  /* ---------- HANDOVER ---------- */
  const ACCESS = ["Login details will be shared with you privately by phone.", "Login details will be shared with you in person.", "You will get an email invitation to each account and set your own password."];
  const REGISTRARS = ["", "Namecheap", "GoDaddy", "Hostinger", "Porkbun", "Cloudflare", "Squarespace Domains", "Other"];
  const HOSTS = ["", "Vercel", "Netlify", "Render", "Hostinger", "cPanel hosting", "GitHub Pages", "Other"];
  function newHandover(pid) {
    const p = K.proj(pid), prop = latestProposal(pid), pd = prop && prop.data || {};
    const del = [];
    if ((pd.pages || []).length) del.push(`${pd.pages.length}-page website: ${pd.pages.map(x => x.name).join(", ")}`);
    featureLabels(pd).forEach(f => del.push(f));
    if (!del.length && p && Array.isArray(p.scope)) p.scope.filter(l => +l.price > 0).forEach(l => del.push(l.item));
    const d = { date: today(), launchDate: today(), ...clientFrom(pid, prop), siteUrl: "", adminUrl: "", deliverables: del.join("\n"), accessMethod: ACCESS[0], accounts: ["Website admin dashboard"],
      domain: pd.domainName || "", registrar: "", domainRenew: "", host: "", hostRenew: "", paidBy: "Client", ownership: "done", manage: ["admin", "logins", "renew", "contact"], limitations: "",
      supportDays: pd.supportDays || 30, maintenance: pd.maintenance === "offer" ? "monthly" : "none", maintenancePrice: pd.maintenancePrice || "", projectTotal: K.projTotal(p), paidTotal: K.projPaid(p) };
    return { type: "handover", status: "Draft", projectId: pid || "", data: d };
  }
  function handoverForm() {
    const d = K.cur.data;
    return [
      fs("client", "Client & dates", `${projSelect()}<div class="grid2">${txt("Organization / client", "org", d)}${txt("Contact person", "contactName", d)}
        ${txt("Phone / WhatsApp", "phone", d, 'inputmode="tel"')}${txt("Launch date", "launchDate", d, 'type="date"')}${txt("Handover date", "date", d, 'type="date"')}</div>`, open("client")),
      fs("site", "Website & deliverables", `<div class="grid2">${txt("Live website address", "siteUrl", d, 'inputmode="url" placeholder="https://"')}${txt("Admin area address (optional)", "adminUrl", d, 'inputmode="url"')}</div>
        <label>What was delivered (one per line)<textarea data-pk="deliverables">${esc(d.deliverables || "")}</textarea></label>`, open("site")),
      fs("access", "Access & logins", `<p class="note">Never type a password here. The app blocks the PDF if it finds one.</p>${sel("How logins are shared", "accessMethod", ACCESS, d)}
        <span class="note">Accounts handed over</span>${pickArr("accounts", HO.ACCOUNTS.map(a => [a, a]), d)}`, open("access")),
      fs("domain", "Domain & hosting", `<div class="grid2">${txt("Domain", "domain", d, 'placeholder="e.g. christlife.org"')}${sel("Registrar", "registrar", REGISTRARS.map(r => [r, r || "Choose…"]), d)}
        ${txt("Domain renews on", "domainRenew", d, 'type="date"')}${sel("Hosting", "host", HOSTS.map(r => [r, r || "Choose…"]), d)}
        ${txt("Hosting renews on (optional)", "hostRenew", d, 'type="date"')}${sel("Renewals paid by", "paidBy", ["Client", "Stephen (included for now)", "Shared"], d)}</div>`, open("domain")),
      fs("own", "Ownership & care", `${sel("Ownership", "ownership", [["done", "Everything transferred to the client"], ["progress", "Transfer in progress"], ["managed", "I manage some accounts for them"]], d)}
        <span class="note">Tips for looking after the site</span>${pickArr("manage", HO.MANAGE, d)}
        <label>Known limitations or open items (one per line)<textarea data-pk="limitations" placeholder="Leave empty if there are none">${esc(d.limitations || "")}</textarea></label>`, open("own")),
      fs("support", "Support & payment", `<div class="grid2">${sel("Free support after launch", "supportDays", days([14, 30, 60, 90]), d)}${sel("Maintenance", "maintenance", [["none", "No plan"], ["monthly", "Monthly plan"]], d)}
        ${d.maintenance === "monthly" ? txt("Monthly price (USD)", "maintenancePrice", d, 'type="number" min="0" inputmode="decimal"') : ""}
        ${txt("Project total (USD)", "projectTotal", d, 'type="number" min="0" inputmode="decimal"')}${txt("Paid so far (USD)", "paidTotal", d, 'type="number" min="0" inputmode="decimal"')}</div>
        <p class="note">Filled from the project's payments. Check it before sending.</p>`, open("support")),
    ].join("");
  }

  /* ---------- TESTIMONIAL ---------- */
  function newTestimonial(pid) {
    const d = { date: today(), ...clientFrom(pid, latestProposal(pid)), questions: ["liked", "recommend"], askPermission: true, link: "", received: "", permission: false };
    return { type: "testimonial", status: "Requested", projectId: pid || "", data: d };
  }
  function testimonialForm() {
    const d = K.cur.data;
    return [
      fs("client", "Who to ask", `${projSelect()}<div class="grid2">${txt("Contact person", "contactName", d)}${txt("Organization / business", "org", d)}${txt("Project name", "projectName", d)}${txt("Date asked", "date", d, 'type="date"')}</div>`, open("client")),
      fs("msg", "Message", `<span class="note">Questions to include (optional)</span>${pickArr("questions", TS.QUESTIONS, d)}
        ${txt("Link to a feedback form (optional)", "link", d, 'inputmode="url" placeholder="e.g. a Google Form link"')}
        <label class="incl"><input type="checkbox" data-pk="askPermission" ${d.askPermission ? "checked" : ""}> Ask if I can share their words publicly</label>`, open("msg") ?? true),
      fs("reply", "Their reply", `<label>Paste their testimonial here when it arrives<textarea data-pk="received">${esc(d.received || "")}</textarea></label>
        <label class="incl"><input type="checkbox" data-pk="permission" ${d.permission ? "checked" : ""}> They said I can share it publicly</label>
        <p class="note">Only use it in your portfolio or posts when this box is ticked.</p>`, open("reply")),
    ].join("");
  }
  function testimonialPreview(d) {
    const m = TS.messages(d, K.brand());
    return `<section class="card"><div class="sec-head"><h2>WhatsApp message</h2><button class="btn sm" data-dact="tact" data-x="copywa">Copy</button></div><div class="ref-box" style="max-height:none;color:var(--ink)">${esc(m.whatsapp)}</div></section>
      <section class="card"><div class="sec-head"><h2>Email</h2><button class="btn sm" data-dact="tact" data-x="copyem">Copy</button></div><p class="note"><strong>Subject:</strong> ${esc(m.email.subject)}</p><div class="ref-box" style="max-height:none;color:var(--ink)">${esc(m.email.body)}</div></section>
      ${d.received ? `<section class="card"><h2>Their testimonial</h2><div class="ref-box" style="max-height:none;color:var(--ink)">${esc(d.received)}</div><span class="chip ${d.permission ? "" : "plain"}">${d.permission ? "OK to share publicly" : "Keep private: no permission yet"}</span></section>` : ""}`;
  }

  /* ---------- actions ---------- */
  function action(x, d) {
    const me = S().bizName.split(/\s+/)[0];
    if (x === "regen") { regenRows(d); K.touch(); K.rerender(); toast("Dates recalculated"); }
    else if (x === "copymissing") { const miss = (d.items || []).filter(i => i.status === "req").map(i => "• " + i.label); copy(`Hi ${String(d.contactName || "").split(/\s+/)[0] || "there"}! To keep ${d.projectName || "your website"} moving, I still need:\n\n${miss.join("\n") || "• Nothing, you're all set 🎉"}\n\nPlease send them by ${E.longDate(d.dueDate)}. Thank you! 🙏🏾\n— ${me}`, "Message"); }
    else if (x === "copyhow") copy(`Hi! To keep changes organised, please send each change like this:\n\nPage: (for example Home)\nWhat to change: …\nPriority: Low, Normal or High\nScreenshot or link: (optional)\n\nYour plan includes ${d.rounds || 2} rounds of revisions. Thank you! 🙏🏾\n— ${me}`, "Message");
    else if (x === "copyextra") { const ex = (d.requests || []).filter(r => r.scope === "extra" && r.status !== "Declined"); const t = RV.totals(d); copy(`Hi ${String(d.contactName || "").split(/\s+/)[0] || "there"}! These changes are outside the agreed scope:\n\n${ex.map(r => `• ${r.page ? r.page + ": " : ""}${r.desc}: ${+r.cost ? M(r.cost) : "price to confirm"}${r.impact && r.impact !== "No delay" ? ` (${r.impact})` : ""}`).join("\n")}\n\nTotal: ${M(t.extraCost)}. Reply “Approved” and I'll start on them. 🙏🏾\n— ${me}`, "Message"); }
    else if (x === "copywa") copy(TS.messages(d, K.brand()).whatsapp, "WhatsApp message");
    else if (x === "copyem") { const m = TS.messages(d, K.brand()).email; copy(`Subject: ${m.subject}\n\n${m.body}`, "Email"); }
  }

  /* ---------- register ---------- */
  const common = { action, client: (d) => d.org, total: () => 0, money: false };
  const reproject = (make) => (d, pid) => { const fresh = make(pid).data; Object.keys(d).forEach(k => delete d[k]); Object.assign(d, fresh); };
  Object.assign(K.TY, {
    agreement: { ...common, prefix: "AGR", label: "Agreement", statuses: ["Draft", "Sent", "Signed", "Cancelled"], make: newAgreement, form: agreementForm, check: AG.check, build: (d) => AG.build(d, K.brand()), info: legalInfo, total: (d) => +d.total || 0, money: true,
      onProject: reproject(newAgreement), fromSource: (d, id) => agFromProposal(d, K.docsList.find(x => x.id === id)) },
    timeline: { ...common, prefix: "TML", label: "Timeline", statuses: ["Draft", "Sent"], make: newTimeline, form: timelineForm, check: TL.check, build: (d) => TL.build(d, K.brand()), onProject: reproject(newTimeline),
      refill: (d) => regenRows(d), newRow: () => ({ stage: "New stage", desc: "", start: today(), end: today(), status: "Not started" }) },
    content: { ...common, prefix: "CNT", label: "Content checklist", statuses: ["Draft", "Sent"], make: newContent, form: contentForm, check: CT.check, build: (d) => CT.build(d, K.brand()), onProject: reproject(newContent),
      refill: (d, k) => { if (k === "_add" && d._add) { const p = CT.PRESETS.find(x => x[1] === d._add); d.items.push({ cat: p ? p[0] : "", label: d._add, status: "req", note: "" }); } delete d._add; },
      newRow: () => ({ cat: "Other", label: "", status: "req", note: "" }) },
    revision: { ...common, prefix: "REV", label: "Revision log", statuses: ["Open", "Closed"], make: newRevision, form: revisionForm, check: RV.check, build: (d) => RV.build(d, K.brand()), total: (d) => RV.totals(d).extraCost, money: true,
      onProject: reproject(newRevision), newRow: () => ({ date: today(), page: "", desc: "", scope: "in", round: "1", status: "New", cost: "", impact: "No delay" }),
      live: (d) => { const e = document.getElementById("d-sum"); if (e) e.innerHTML = revSum(d); } },
    handover: { ...common, prefix: "HND", label: "Handover", statuses: ["Draft", "Delivered", "Signed"], make: newHandover, form: handoverForm, check: HO.check, block: HO.block, build: (d) => HO.build(d, K.brand()), onProject: reproject(newHandover) },
    testimonial: { ...common, prefix: "TST", label: "Testimonial request", statuses: ["Requested", "Received", "Approved to share"], make: newTestimonial, form: testimonialForm, check: (d) => (d.contactName || "").trim() ? [] : ["Add the contact person's name."],
      messageOnly: true, word: false, preview: testimonialPreview, onProject: reproject(newTestimonial) },
  });
})();
