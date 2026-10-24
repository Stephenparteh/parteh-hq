/* Milestone 5: connect documents to projects. Hooks on save, project Docs tab, card badges, Today items. */
(function () {
  "use strict";
  const K = window.DocsKit, E = window.DocEngine, M = E.money, r2 = E.r2;
  if (!K) return;
  const PH = { proposalSent: 4, proposalOk: 5, contract: 6, invoiceSent: 7, deposit: 8, content: 9, launched: 14 };
  const TYPE_NAME = { proposal: "Proposal", invoice: "Invoice", receipt: "Receipt", agreement: "Agreement", timeline: "Timeline", content: "Content checklist", revision: "Revision log", handover: "Handover", testimonial: "Testimonial request" };
  const first = (s) => String(s || "").trim().split(/\s+/)[0] || "there";
  const docsFor = (pid) => K.docsList.filter(x => x.projectId === pid).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const owedOn = (inv) => r2(Math.max(0, (+inv.total || 0) - K.invoicePaid(inv)));

  /* ---------- styles + undo toast ---------- */
  const st = document.createElement("style");
  st.textContent = `.atoast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(70px + env(safe-area-inset-bottom,0px));background:var(--ink);color:var(--bg);padding:10px 10px 10px 16px;border-radius:14px;font-size:14px;z-index:41;display:flex;gap:12px;align-items:center;justify-content:space-between;width:min(92%,440px);box-shadow:0 4px 16px rgba(0,0,0,.2)}
  .atoast button{border:0;background:var(--bg);color:var(--ink);font:600 13px var(--body);border-radius:99px;padding:7px 12px;cursor:pointer;flex:none}
  .dbadges{display:flex;gap:6px;flex-wrap:wrap}
  .pdoc{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
  .pdoc:last-child{border-bottom:0}
  .pdoc strong{font-family:var(--mono);font-size:13px;font-weight:500}
  .newdocs{display:flex;flex-wrap:wrap;gap:6px}`;
  document.head.appendChild(st);
  let at = null;
  function actionToast(text, undo) {
    if (at) at.remove();
    at = document.createElement("div"); at.className = "atoast"; at.setAttribute("role", "status");
    const sp = document.createElement("span"); sp.textContent = text; at.appendChild(sp);
    if (undo) { const b = document.createElement("button"); b.textContent = "Undo"; b.onclick = async () => { b.disabled = true; await undo(); if (at) { at.remove(); at = null; } }; at.appendChild(b); }
    document.body.appendChild(at);
    const me = at; setTimeout(() => { if (at === me) { me.remove(); at = null; } }, 7000);
  }

  /* ---------- what each document change means for the project ---------- */
  function planFor(doc, prev) {
    const s = doc.status, d = doc.data || {}, t = doc.type, changed = (v) => s === v && prev.status !== v;
    if (t === "proposal") {
      if (changed("Sent")) return { phase: PH.proposalSent, next: "Follow up on the proposal", wait: "client", why: "Proposal sent" };
      if (changed("Accepted")) return { phase: PH.proposalOk, next: "Send the contract", wait: "me", why: "Proposal accepted", scope: true };
      if (changed("Declined")) return { next: "Update the proposal with the client's changes", wait: "me", why: "Proposal declined" };
    }
    if (t === "agreement") {
      if (changed("Sent")) return { phase: PH.proposalOk, next: "Wait for the signed contract", wait: "client", why: "Agreement sent" };
      if (changed("Signed")) return { phase: PH.contract, next: "Send the deposit invoice", wait: "me", why: "Agreement signed" };
    }
    if (t === "invoice" && changed("Sent")) {
      if (d.kind === "deposit") return { phase: PH.invoiceSent, next: "Wait for the deposit", wait: "client", why: "Deposit invoice sent" };
      if (d.kind === "final") return { next: "Collect the final payment", wait: "client", why: "Final invoice sent" };
      return { wait: "client", why: "Invoice sent" };
    }
    if (t === "receipt" && d.confirmed && !prev.confirmed) {
      if (d.payType === "deposit") return { phase: PH.deposit, next: "Send the content checklist", wait: "me", why: "Deposit received" };
      if (d.payType === "full") return { next: "Hand over the website and logins", wait: "me", why: "Paid in full" };
      return { wait: "me", why: "Payment received" };
    }
    if (t === "content" && changed("Sent")) return { phase: PH.content, next: "Collect content from the client", wait: "client", why: "Content checklist sent" };
    if (t === "handover" && (changed("Delivered") || changed("Signed")) && !["Delivered", "Signed"].includes(prev.status)) return { phase: PH.launched, next: "Request a testimonial", wait: "me", why: "Website handed over" };
    if (t === "testimonial") {
      if (prev.status == null) return { next: "Request a testimonial", wait: "client", why: "Testimonial requested" };
      if ((changed("Received") || changed("Approved to share"))) return { next: "Post the project on my portfolio and socials", wait: "me", why: "Testimonial received" };
    }
    return null;
  }

  window.DocHooks = {
    async saved(doc, prev) {
      if (!db || !doc.projectId) return;
      const p = K.proj(doc.projectId); if (!p) return;
      const patch = {}, undo = {};
      const set = (k, v) => { if (JSON.stringify(p[k]) === JSON.stringify(v)) return; patch[k] = v; undo[k] = p[k] === undefined ? { __unset: true } : JSON.parse(JSON.stringify(p[k])); };
      const notes = [];
      // content checklist keeps the project's Content tab in sync
      if (doc.type === "content") set("content", (doc.data.items || []).filter(i => i.status !== "no" && String(i.label || "").trim()).map(i => ({ label: i.label, done: i.status === "rec" || i.status === "ok" })));
      const auto = S().autoMove !== false, plan = auto ? planFor(doc, prev) : null;
      if (plan) {
        if (plan.phase != null && plan.phase > (p.phase || 0)) { set("phase", plan.phase); const pd = { ...(p.phaseDates || {}) }; pd[plan.phase] = today(); set("phaseDates", pd); notes.push(`moved to “${PHASE_NAME(plan.phase)}”`); }
        if (plan.next && plan.next !== p.nextStep) { set("nextStep", plan.next); notes.push(`next: ${plan.next}`); }
        if (plan.wait && plan.wait !== p.waitingOn) { set("waitingOn", plan.wait); set("waitingSince", plan.wait === "client" ? today() : ""); }
        else if (plan.wait === "client" && plan.next) set("waitingSince", today());
        if (plan.scope && !(Array.isArray(p.scope) && p.scope.length) && !(+p.price > 0)) {
          const items = (doc.data.items || []).filter(l => String(l.item || "").trim() || +l.price).map(l => ({ item: l.item, price: +l.price || 0 }));
          if (items.length) { set("scope", items); set("price", r2(items.reduce((s, l) => s + l.price, 0))); if (doc.data.plan === "deposit") set("depositPct", doc.data.depositPct); notes.push("price added from the proposal"); }
        }
      }
      if (!Object.keys(patch).length) return;
      patch.updatedAt = new Date().toISOString();
      try {
        await db.collection("projects").doc(p.id).update(patch);
        if (notes.length) actionToast(`${p.name}: ${notes.join(" · ")}`, async () => {
          const now = K.proj(p.id); if (!now) return;
          const { id, ...body } = JSON.parse(JSON.stringify(now));
          Object.entries(undo).forEach(([k, v]) => { if (v && v.__unset) delete body[k]; else body[k] = v; });
          body.updatedAt = new Date().toISOString();
          try { await db.collection("projects").doc(p.id).set(body); toast("Project change undone"); } catch (e) { toast("Couldn't undo. Change it in the project."); }
        });
      } catch (e) { toast("The document was saved, but the project couldn't be updated."); }
    }
  };
  const PHASE_NAME = (i) => (typeof PHASES !== "undefined" && PHASES[i] ? PHASES[i][1] : `phase ${i + 1}`);

  /* ---------- badges on project cards ---------- */
  window.docBadges = function (pid) {
    const ds = docsFor(pid); if (!ds.length) return "";
    const out = [];
    const prop = ds.find(x => x.type === "proposal"); if (prop) { const [s, c] = K.stateOf(prop); out.push(`<span class="chip ${c}">Proposal: ${esc(s)}</span>`); }
    const ag = ds.find(x => x.type === "agreement"); if (ag) out.push(`<span class="chip ${ag.status === "Signed" ? "" : "plain"}">Agreement: ${esc(ag.status || "Draft")}</span>`);
    const owed = ds.filter(x => x.type === "invoice" && x.status === "Sent").reduce((s, x) => s + owedOn(x), 0);
    if (owed > 0) { const late = ds.some(x => x.type === "invoice" && K.invoiceState(x)[0] === "Overdue"); out.push(`<span class="chip ${late ? "wait" : "gold"}">${M(owed)} ${late ? "overdue" : "owed"}</span>`); }
    return out.length ? `<div class="dbadges">${out.join("")}</div>` : "";
  };

  /* ---------- Today: money owed + proposals waiting ---------- */
  window.todayDocsHTML = function () {
    const owed = K.docsList.filter(x => x.type === "invoice" && x.status === "Sent" && owedOn(x) > 0).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const waiting = K.docsList.filter(x => x.type === "proposal" && x.status === "Sent").filter(x => Math.floor((new Date(today()) - new Date(String(x.updatedAt || x.date).slice(0, 10))) / 864e5) >= 3);
    if (!owed.length && !waiting.length) return "";
    const total = r2(owed.reduce((s, x) => s + owedOn(x), 0));
    return `<section class="block"><div class="sec-head"><h2>Money & replies</h2>${total ? `<span class="note num">${M(total)} owed</span>` : ""}</div>
      ${owed.map(x => { const [stx, cls] = K.invoiceState(x); return `<div class="card ${stx === "Overdue" ? "alert" : ""}"><div class="card-top"><div><h3>${esc(x.client || "Client")}</h3><div class="client">${esc(x.number)} · ${M(owedOn(x))} unpaid</div></div><span class="chip ${cls}">${esc(stx)}</span></div>
        <div class="row"><button class="btn sm ${stx === "Overdue" ? "warn" : ""}" data-d3="remind" data-id="${esc(x.id)}">Copy payment reminder</button><button class="btn sm ghost" data-d3="open" data-id="${esc(x.id)}">Open invoice</button></div></div>`; }).join("")}
      ${waiting.map(x => `<div class="card"><div class="card-top"><div><h3>${esc(x.client || "Client")}</h3><div class="client">${esc(x.number)} · proposal sent ${esc(fmtDate(x.updatedAt))}, no answer yet</div></div><span class="chip gold">Waiting</span></div>
        <div class="row"><button class="btn sm" data-d3="propfu" data-id="${esc(x.id)}">Copy follow-up</button><button class="btn sm ghost" data-d3="open" data-id="${esc(x.id)}">Open proposal</button></div></div>`).join("")}
    </section>`;
  };
  function reminderText(inv) {
    const d = inv.data || {}, due = +d.dueDays ? E.addDays(d.date, d.dueDays) : d.date, late = due < today(), s = S();
    return `Hi ${first(d.contactName)}! Just a friendly reminder about invoice ${inv.number}${d.projectName ? ` for ${d.projectName}` : ""}. The amount of ${M(owedOn(inv))} ${late ? "was" : "is"} due on ${E.longDate(due)}.${s.payInfo ? `\n\nYou can pay by: ${s.payInfo}` : ""}\n\nPlease send me a message once it's paid so I can send your receipt. Thank you! 🙏🏾\n— ${first(s.bizName)}`;
  }
  function proposalFollowUp(pr) {
    const d = pr.data || {};
    return `Hi ${first(d.contactName)}! Just checking in on the proposal I sent for ${d.org || "your website"} (${pr.number}). Do you have any questions, or anything you'd like me to change? I'm happy to jump on a quick call. 🙏🏾\n— ${first(S().bizName)}`;
  }
  document.getElementById("view").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-d3]"); if (!b) return;
    const x = K.docsList.find(z => z.id === b.dataset.id); if (!x) return;
    if (b.dataset.d3 === "open") K.openDoc(x.id);
    else if (b.dataset.d3 === "remind") copy(reminderText(x), "Reminder");
    else if (b.dataset.d3 === "propfu") copy(proposalFollowUp(x), "Follow-up");
  });

  /* ---------- project sheet: Docs tab ---------- */
  window.projectDocsHTML = function (pid) {
    if (!pid) return `<p class="note">Save the project first. Then you can create its documents here.</p>`;
    const ds = docsFor(pid);
    const steps = [["proposal", "Proposal"], ["agreement", "Agreement"], ["invoice", "Invoice"], ["receipt", "Receipt"], ["content", "Content checklist"], ["timeline", "Timeline"], ["revision", "Revision log"], ["handover", "Handover"], ["testimonial", "Testimonial request"]];
    return `<div><div class="sec-head"><span class="eyebrow">This project's documents</span><span class="note">${ds.length}</span></div>
      ${ds.length ? ds.map(x => { const [s, c] = K.stateOf(x); return `<div class="pdoc"><div><strong>${esc(x.number)}</strong><div class="note">${esc(TYPE_NAME[x.type] || "Document")}${["proposal", "invoice", "receipt", "agreement"].includes(x.type) ? ` · ${M(x.total)}` : ""}</div></div><div class="row"><span class="chip ${c}">${esc(s)}</span><button class="btn sm ghost" data-docopen="${esc(x.id)}">Open</button></div></div>`; }).join("") : `<p class="note">No documents yet.</p>`}</div>
      <div><span class="eyebrow">Create</span><div class="newdocs" style="margin-top:6px">${steps.map(([k, n]) => `<button class="btn sm ghost" data-docnew="${k}">+ ${n}</button>`).join("")}</div>
      <p class="note" style="margin-top:6px">Details from this project fill in for you. Your changes here are saved first.</p></div>`;
  };
})();
