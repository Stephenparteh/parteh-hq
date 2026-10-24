/* Milestone 4 templates: agreement, timeline, content checklist, revision log, handover, testimonial request. Adds to window.DocEngine. */
(function (G) {
  "use strict";
  const E = G.DocEngine, M = E.money, LD = E.longDate, r2 = E.r2, BR = E.BRAND;
  const shortDate = (s) => { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T00:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const joinList = (a) => a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const head = (title, d, sub) => ({ t: "dochead", title, number: d.number || "Draft", sub: sub || d.projectName || "" });
  const meta = (docType, d, brand) => ({ docType, number: d.number, client: (d.org || "").trim() || "Client", brand, noFirstHeader: true });

  /* ---------- SERVICE AGREEMENT ---------- */
  const JURIS = ["the Republic of Liberia"];
  const LEGAL_FLAGS = ["Fees and payment (late payments, deposit refunds)", "Ownership of the work", "Cancellation", "Limitation of liability", "Disputes and governing law"];
  function buildAgreement(d, brand) {
    const org = (d.org || "").trim() || "the Client", total = r2(d.total);
    const blocks = [head("Agreement", d, "Website design & development")];
    blocks.push({ t: "parties", left: { label: "Client", lines: [org, [d.contactName, d.contactRole].filter(Boolean).join(", "), d.phone, d.address].filter(Boolean) },
      right: { label: "Agreement details", rows: [["Agreement no.", d.number || "Draft"], ["Date", LD(d.date)], ["Project", d.projectName], ["Proposal", d.proposalNo], ["Total fee", total ? M(total) : ""]].filter(r => r[1]) } });
    blocks.push({ t: "p", text: `This Service Agreement (“Agreement”) is made on ${LD(d.date)} between ${brand.name}, ${brand.title} (“the Developer”), and ${org} (“the Client”). It sets out the terms for the website project described below.` });
    let n = 0; const H = (t) => blocks.push({ t: "h", n: ++n, text: t, keep: 36 }); const P = (text) => blocks.push({ t: "p", text });
    H("Scope of work");
    const del = [];
    if ((d.pages || []).length) del.push(`A ${d.pages.length}-page website: ${joinList(d.pages)}.`);
    (d.features || []).forEach(f => del.push(f));
    String(d.extraDeliverables || "").split("\n").map(x => x.trim()).filter(Boolean).forEach(x => del.push(x));
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
      blocks.push({ t: "table", cols: [{ h: "Payment", w: 30 }, { h: "When", w: 38 }, { h: "Share", w: 12, align: "right" }, { h: "Amount", w: 20, align: "right" }], rows: E.proposal.schedule(d, total) });
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
  function checkAgreement(d) {
    const w = [];
    if (!(d.org || "").trim()) w.push("Add the client's organization name.");
    if (!(d.contactName || "").trim()) w.push("Add who signs for the client.");
    if (!(+d.total > 0)) w.push("Add the total fee (or link an accepted proposal).");
    if (!(d.pages || []).length && !(d.features || []).length && !String(d.extraDeliverables || "").trim()) w.push("Add what you will deliver (pages or features).");
    return w;
  }

  /* ---------- PROJECT TIMELINE ---------- */
  const TL_STATUS = ["Not started", "In progress", "Done"];
  function timelineRows(start, weeks, hasBack, reviewDays) {
    const days = Math.max(7, (+weeks || 4) * 7), rv = +reviewDays || 3;
    const work = [
      ["Kickoff and content", "Confirm the plan. Client sends logo, photos and text.", 0.7, "content"],
      ["UI design", "Design the main pages.", 1.4],
      ["Client review: design", "Client reviews the design and sends feedback.", 0, "review"],
      ["Front-end development", "Build the pages from the approved design.", 1.8],
      ...(hasBack ? [["Back end and features", "Forms, admin dashboard and other features.", 1.3]] : []),
      ["Testing and revisions", "Client tests the website. I make the agreed changes.", 1.0, "review2"],
      ["Launch and handover", "Domain, SEO, go live and hand over.", 0.5]];
    const reviewTotal = rv, workDays = Math.max(work.length, days - reviewTotal), wsum = work.reduce((s, x) => s + x[2], 0);
    let cursor = 0; const rows = [];
    work.forEach((x, i) => {
      const len = x[3] === "review" ? rv : (i === work.length - 1 ? Math.max(1, days - cursor) : Math.max(1, Math.round(x[2] / wsum * workDays)));
      const a = E.addDays(start, cursor), b = E.addDays(start, cursor + len - 1); cursor += len;
      rows.push({ stage: x[0], desc: x[1], start: a, end: b, status: "Not started" });
    });
    return rows;
  }
  function buildTimeline(d, brand) {
    const rows = d.rows || [], done = rows.filter(r => r.status === "Done").length, prog = rows.length ? Math.round(done / rows.length * 100) : 0;
    const end = rows.length ? rows[rows.length - 1].end : "";
    const content = rows.find(r => /content/i.test(r.stage));
    const blocks = [head("Timeline", d)];
    blocks.push({ t: "parties", left: { label: "Prepared for", lines: [(d.org || "").trim() || "Client", d.contactName].filter(Boolean) },
      right: { label: "Project dates", rows: [["Timeline no.", d.number || "Draft"], ["Start", LD(d.startDate)], ["Content due", content ? LD(content.end) : ""], ["Estimated launch", LD(end)], ["Progress", `${prog}% (${done} of ${rows.length} stages done)`]].filter(r => r[1]) } });
    blocks.push({ t: "table", cols: [{ h: "Stage", w: 26 }, { h: "Dates", w: 22 }, { h: "What happens", w: 36 }, { h: "Status", w: 16 }], firstBold: true,
      rows: rows.map(r => [r.stage, r.start === r.end ? shortDate(r.start) : `${shortDate(r.start)} – ${shortDate(r.end)}`, r.desc, r.status]) });
    blocks.push({ t: "p", text: `Dates are estimates. They move if content or feedback arrives late. Please send feedback within ${d.reviewDays || 3} days of each review request.`, size: 9.5 });
    if ((d.note || "").trim()) blocks.push({ t: "note", text: d.note.trim() });
    return { meta: meta("Timeline", d, brand), blocks, total: 0 };
  }
  function checkTimeline(d) { const w = []; if (!d.startDate) w.push("Choose the start date."); if (!(d.rows || []).length) w.push("Create the timeline stages."); return w; }

  /* ---------- CONTENT CHECKLIST ---------- */
  const CT_STATUS = [["no", "Not requested"], ["req", "Requested"], ["rec", "Received"], ["ok", "Approved"]];
  const CT_PRESETS = [
    ["Brand", "Logo (clear PNG or SVG file)"], ["Brand", "Brand colors and fonts (if you have them)"],
    ["About", "Business description and background"], ["About", "Mission and vision"],
    ["Services", "List of services or products, with short descriptions"], ["Services", "Prices (only if they should show on the site)"],
    ["Contact", "Phone, email, address and opening hours"], ["Contact", "Social media links"],
    ["Media", "Photos (team, place, events, work)"], ["Media", "Videos (links)"],
    ["Team", "Team or leaders: names, roles and photos"], ["Trust", "Testimonials or reviews"],
    ["Pages", "Text for each page"], ["Legal", "Privacy policy or terms (if needed)"],
    ["Payments", "Booking or payment details (if needed)"], ["Domain", "Preferred domain name"]];
  const ctLabel = (k) => (CT_STATUS.find(x => x[0] === k) || CT_STATUS[0])[1];
  function buildContent(d, brand) {
    const items = (d.items || []).filter(x => x.status !== "no" && String(x.label || "").trim());
    const got = items.filter(x => x.status === "rec" || x.status === "ok").length;
    const blocks = [head("Checklist", d, "Website content")];
    blocks.push({ t: "parties", left: { label: "Prepared for", lines: [(d.org || "").trim() || "Client", d.contactName].filter(Boolean) },
      right: { label: "Details", rows: [["Checklist no.", d.number || "Draft"], ["Date", LD(d.date)], ["Please send by", LD(d.dueDate)], ["How to send", d.sendVia], ["Received", `${got} of ${items.length}`]].filter(r => r[1]) } });
    blocks.push({ t: "p", text: "To build your website, I need the items below. Items marked “Requested” are still missing. Send what you have now. We can add the rest later." });
    blocks.push({ t: "table", cols: [{ h: "Item", w: 56 }, { h: "Section", w: 20 }, { h: "Status", w: 24 }], rows: items.map(x => [x.label + (x.note ? ` (${x.note})` : ""), x.cat || "", ctLabel(x.status)]) });
    blocks.push({ t: "note", text: "Please do not send passwords by WhatsApp or email. If I need access to an account, we will set up a safe way to share it." });
    return { meta: meta("Checklist", d, brand), blocks, total: 0 };
  }
  function checkContent(d) { const w = []; if (!(d.items || []).some(x => x.status !== "no")) w.push("Mark at least one item as Requested."); if (!d.dueDate) w.push("Choose the date the client should send content by."); return w; }

  /* ---------- REVISION LOG ---------- */
  const RV_STATUS = ["New", "Approved", "In progress", "Done", "Declined"];
  const RV_SCOPE = [["in", "Included"], ["extra", "Extra (needs approval)"], ["check", "Not sure yet"]];
  const RV_IMPACT = ["No delay", "+1 day", "+2–3 days", "+1 week"];
  function revTotals(d) {
    const reqs = d.requests || [];
    const extra = reqs.filter(r => r.scope === "extra" && r.status !== "Declined");
    const rounds = new Set(reqs.filter(r => r.scope === "in" && r.round && r.round !== "extra").map(r => r.round)).size;
    return { count: reqs.length, extraCount: extra.length, extraCost: r2(extra.reduce((s, r) => s + (+r.cost || 0), 0)), rounds };
  }
  function buildRevision(d, brand) {
    const t = revTotals(d), reqs = d.requests || [];
    const blocks = [head("Revisions", d)];
    blocks.push({ t: "parties", left: { label: "Prepared for", lines: [(d.org || "").trim() || "Client", d.contactName].filter(Boolean) },
      right: { label: "Summary", rows: [["Log no.", d.number || "Draft"], ["Updated", LD(d.date)], ["Revision rounds included", String(d.rounds || 2)], ["Rounds used", String(t.rounds)], ["Extra requests", String(t.extraCount)]] } });
    blocks.push({ t: "table", cols: [{ h: "Date", w: 13 }, { h: "Page and request", w: 45 }, { h: "Scope", w: 15 }, { h: "Status", w: 13 }, { h: "Cost", w: 14, align: "right" }],
      rows: reqs.map(r => [shortDate(r.date), `${r.page ? r.page + ": " : ""}${r.desc || ""}${r.impact && r.impact !== "No delay" ? ` (${r.impact})` : ""}`, r.scope === "extra" ? "Extra" : r.scope === "in" ? `Included${r.round && r.round !== "extra" ? ` (round ${r.round})` : ""}` : "To confirm", r.status || "New", r.scope === "extra" ? (+r.cost ? M(r.cost) : "To quote") : "—"]),
      foot: t.extraCost ? [["Extra work total", M(t.extraCost), true]] : [] });
    blocks.push({ t: "p", text: "Requests marked “Extra” are outside the agreed scope. I will only start them after you approve the cost and any change to the timeline.", size: 9.5 });
    return { meta: meta("Revisions", d, brand), blocks, total: t.extraCost };
  }
  function checkRevision(d) { const w = []; if (!(d.requests || []).length) w.push("Add at least one request."); if ((d.requests || []).some(r => !String(r.desc || "").trim())) w.push("One request has no description."); return w; }

  /* ---------- HANDOVER ---------- */
  const HO_ACCOUNTS = ["Website admin dashboard", "Domain registrar account", "Hosting account", "Business email", "Google Business Profile", "Google Analytics / Search Console"];
  const HO_MANAGE = [
    ["admin", "Update text, photos and posts from the admin dashboard."],
    ["images", "Use clear, compressed images so pages load fast."],
    ["logins", "Keep your logins private and change passwords if someone leaves your team."],
    ["renew", "Renew the domain and hosting before they expire, or the site will go offline."],
    ["backup", "Ask me before making big changes, so nothing breaks."],
    ["contact", "Contact me for new pages, features or anything that stops working."]];
  const HO_OWNER = { done: "All accounts and files have been transferred to the Client. The Client now owns and controls the website.", progress: "The transfer of accounts to the Client is in progress. It will be finished by the date agreed with the Client.", managed: "The Developer manages some accounts on the Client's behalf, as agreed. The Client can ask for full control at any time." };
  function buildHandover(d, brand) {
    const org = (d.org || "").trim() || "Client", bal = r2(Math.max(0, (+d.projectTotal || 0) - (+d.paidTotal || 0)));
    const blocks = [head("Handover", d)];
    blocks.push({ t: "parties", left: { label: "Handed over to", lines: [org, d.contactName, d.phone].filter(Boolean) },
      right: { label: "Details", rows: [["Handover no.", d.number || "Draft"], ["Handover date", LD(d.date)], ["Launch date", LD(d.launchDate)]].filter(r => r[1]) } });
    let n = 0; const H = (t) => blocks.push({ t: "h", n: ++n, text: t, keep: 34 });
    H("Your website");
    blocks.push({ t: "kv", rows: [["Live website", d.siteUrl], ["Admin area", d.adminUrl]].filter(r => r[1]) });
    const del = String(d.deliverables || "").split("\n").map(x => x.trim()).filter(Boolean);
    if (del.length) { H("What was delivered"); blocks.push({ t: "bullets", items: del }); }
    H("Access and logins");
    blocks.push({ t: "note", text: `For your security, no passwords are written in this document. ${d.accessMethod || "Login details will be shared with you privately."}` });
    if ((d.accounts || []).length) { blocks.push({ t: "sub", text: "Accounts handed over" }); blocks.push({ t: "bullets", items: d.accounts }); }
    const dh = [["Domain", d.domain], ["Registrar", d.registrar], ["Domain renews on", LD(d.domainRenew)], ["Hosting", d.host], ["Hosting renews on", LD(d.hostRenew)], ["Renewals paid by", d.paidBy]].filter(r => r[1]);
    if (dh.length) { H("Domain and hosting"); blocks.push({ t: "kv", rows: dh }); }
    H("Ownership");
    blocks.push({ t: "p", text: HO_OWNER[d.ownership] || HO_OWNER.done });
    const man = HO_MANAGE.filter(x => (d.manage || []).includes(x[0])).map(x => x[1]);
    if (man.length) { H("Looking after your website"); blocks.push({ t: "bullets", items: man }); }
    const lim = String(d.limitations || "").split("\n").map(x => x.trim()).filter(Boolean);
    H("Known limitations and open items");
    blocks.push(lim.length ? { t: "bullets", items: lim } : { t: "p", text: "None at the time of handover." });
    H("Support");
    const sup = [`Free support until ${LD(E.addDays(d.launchDate || d.date, d.supportDays || 30))} (${d.supportDays || 30} days after launch) to fix errors in the work delivered.`];
    if (d.maintenance === "monthly" && +d.maintenancePrice > 0) sup.push(`Monthly maintenance plan: ${M(d.maintenancePrice)} per month.`); else sup.push("After the support period, changes and fixes are quoted separately.");
    blocks.push({ t: "bullets", items: sup });
    if (+d.projectTotal > 0) { H("Final payment"); blocks.push({ t: "kv", rows: [["Project total", M(d.projectTotal)], ["Paid", M(d.paidTotal)], ["Balance", bal > 0 ? M(bal) : "Paid in full"]] }); }
    H("Client acknowledgment");
    blocks.push({ t: "p", text: "By signing below, the Client confirms they have received the website and the items listed in this document." });
    blocks.push({ t: "sign", parties: [{ label: "Received by the Client", name: [d.contactName, org].filter(Boolean).join(", ") }, { label: "Handed over by", name: `${brand.name}, ${brand.title}` }] });
    return { meta: meta("Handover", d, brand), blocks, total: 0 };
  }
  const PW_RE = /\b(password|passwd|passcode|pwd|pin)\b\s*(is\s+\S|[:=])/i;
  function handoverBlockers(d) { const txt = JSON.stringify(d); return PW_RE.test(txt) ? ["It looks like a password is written in this document. Remove it and share logins privately."] : []; }
  function checkHandover(d) { const w = []; if (!(d.siteUrl || "").trim()) w.push("Add the live website address."); if (!(d.org || "").trim()) w.push("Add the client's name."); if (!d.launchDate) w.push("Add the launch date."); return w; }

  /* ---------- TESTIMONIAL REQUEST (message only) ---------- */
  const TS_QUESTIONS = [["before", "What made you decide to get a website?"], ["liked", "What did you like most about working with me?"], ["result", "What has changed since the website went live?"], ["recommend", "Would you recommend me to others? Why?"]];
  function testimonialMessages(d, brand) {
    const first = String(d.contactName || "").trim().split(/\s+/)[0] || "there", me = String(brand.name || "").split(/\s+/)[0] || brand.name;
    const qs = TS_QUESTIONS.filter(q => (d.questions || []).includes(q[0])).map(q => q[1]);
    const proj = d.projectName || "your website", biz = (d.org || "").trim();
    const how = (d.link || "").trim() ? `You can reply here, or use this short form: ${d.link.trim()}` : "You can simply reply to this message.";
    const perm = d.askPermission ? "If you're happy for me to share your words, with your name and business, on my website and social media, please let me know. If you'd rather keep it private, that's completely fine." : "";
    const wa = [`Hi ${first}! 👋🏾`, `Thank you again for trusting me with ${proj}${biz ? ` for ${biz}` : ""}. It was a pleasure working with you.`,
      `Would you mind sharing a few honest words about your experience? It really helps my small business grow.${qs.length ? "\n\nYou can answer any of these:\n" + qs.map(q => "• " + q).join("\n") : ""}`, how, perm, `Thank you! 🙏🏾\n${me}`].filter(Boolean).join("\n\n");
    const em = [`Hi ${first},`, `Thank you again for trusting me with ${proj}${biz ? ` for ${biz}` : ""}. It was a pleasure working with you.`,
      `Would you mind sharing a few honest words about your experience? Your feedback really helps my business grow.${qs.length ? "\n\nYou can answer any of these:\n" + qs.map(q => "- " + q).join("\n") : ""}`, how, perm, `Thank you,\n${brand.name}\n${brand.title}${brand.phone ? "\n" + brand.phone : ""}${brand.portfolio ? "\n" + brand.portfolio : ""}`].filter(Boolean).join("\n\n");
    return { whatsapp: wa, email: { subject: `A quick favour: your feedback on ${proj}`, body: em } };
  }

  Object.assign(E, {
    agreement: { build: buildAgreement, check: checkAgreement, LEGAL_FLAGS, JURIS },
    timeline: { build: buildTimeline, check: checkTimeline, rows: timelineRows, STATUS: TL_STATUS },
    content: { build: buildContent, check: checkContent, STATUS: CT_STATUS, PRESETS: CT_PRESETS },
    revision: { build: buildRevision, check: checkRevision, totals: revTotals, STATUS: RV_STATUS, SCOPE: RV_SCOPE, IMPACT: RV_IMPACT },
    handover: { build: buildHandover, check: checkHandover, block: handoverBlockers, ACCOUNTS: HO_ACCOUNTS, MANAGE: HO_MANAGE },
    testimonial: { messages: testimonialMessages, QUESTIONS: TS_QUESTIONS },
  });
})(typeof window !== "undefined" ? window : globalThis);
