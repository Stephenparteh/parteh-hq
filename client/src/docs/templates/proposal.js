import { BRAND, money, longDate, addDays, lc, joinList } from "../helpers.js";

export const GOALS = [
  ["credibility", "Build trust and credibility online"], ["info", "Share clear information about who they are and what they do"],
  ["contact", "Make it easy for people to get in touch"], ["leads", "Get more inquiries and new customers"],
  ["donations", "Accept donations and support online"], ["events", "Promote events and keep people updated"],
  ["media", "Share sermons, music or videos"], ["portfolio", "Showcase their work and past projects"],
  ["sell", "Sell products or services online"], ["members", "Keep members and the community connected"]];
export const PAGES = [
  ["home", "Home", "The first impression. Introduces {org}, highlights the most important information and guides visitors to the right pages."],
  ["about", "About", "Tells the story, mission and vision of {org} and builds trust with visitors."],
  ["services", "Services / Programs", "Explains what {org} offers in a clear, simple way."],
  ["ministries", "Ministries / Departments", "Presents each ministry or department and how people can get involved."],
  ["team", "Team / Leadership", "Introduces the leaders and team behind {org}."],
  ["gallery", "Gallery", "Shows photos of events, work and community life."],
  ["events", "Events", "Lists upcoming events with dates, times and locations."],
  ["news", "Blog / News", "Shares updates, announcements and articles."],
  ["media", "Sermons / Media", "Hosts sermons, music or videos for visitors to watch or listen to."],
  ["portfolio", "Portfolio / Projects", "Shows past work and results."],
  ["give", "Give / Donate", "Explains how to give and support {org}."],
  ["testimonials", "Testimonials", "Shares feedback from clients, members or partners."],
  ["faq", "FAQ", "Answers common questions so visitors find what they need quickly."],
  ["shop", "Shop / Products", "Displays products with prices and how to order."],
  ["contact", "Contact", "Contact details, location map, contact form and social media links."]];
export const FEATURES = [
  ["mobile", "Mobile-friendly design that works on phones, tablets and computers", true],
  ["speed", "Fast-loading, optimized pages", true],
  ["social", "Links to social media pages", true],
  ["contact", "Contact form that sends messages to the client's email"],
  ["whatsapp", "WhatsApp chat button so visitors can message in one tap"],
  ["gallery", "Photo gallery"], ["blog", "Blog / news section the client can update"],
  ["events", "Events calendar"], ["media", "Sermons, music or video page"],
  ["giving", "Online giving / donations"], ["admin", "Admin dashboard so the client can update content without a developer"],
  ["seo", "Basic SEO and Google listing setup so people can find the website on Google"],
  ["logo", "Logo design"], ["map", "Google Maps location"], ["newsletter", "Email newsletter sign-up"]];
export const DESIGN = ["Modern and minimal", "Bold and vibrant", "Elegant and classic", "Warm and welcoming", "Based on the client's existing brand"];
export const DOMAIN = {
  register: "I will register the domain name in the client's name. The client owns the domain.",
  client: "The client already owns a domain. I will connect it to the new website.",
  help: "The client will buy the domain. I will guide them through the purchase and connect it to the website.",
  none: "",
};
export const HOSTING = {
  included: "Hosting for the first year is included in this project. From the second year, renewal fees are paid by the client.",
  client: "The client will pay the hosting provider directly. I will set up the hosting account and put the website online.",
  free: "The website will run on a free hosting plan, which suits a small website. A paid plan may be needed later as the website grows.",
  none: "",
};
export const EMAIL = {
  none: "Business email is not included in this proposal.",
  setup: "I will set up a business email address (for example info@yourdomain). Email service fees, if any, are paid by the client.",
  addon: "Business email setup is available as an optional add-on and can be quoted separately.",
};
export const PLANS = {
  "50-50": [["Deposit to start", "Before work begins", 50], ["Final payment", "On launch, before handover", 50]],
  "30-40-30": [["Deposit to start", "Before work begins", 30], ["Design approval", "When the design is approved", 40], ["Final payment", "On launch, before handover", 30]],
  "deposit": null, // uses depositPct
  "full": [["Full payment", "Before work begins", 100]],
};
export const START = ["Within 2 days after the deposit is received", "Within 1 week after the deposit is received", "On a date agreed with the client"];

export function timeline(d) {
  const weeks = Math.max(1, +d.weeks || 4), days = weeks * 7, hasBack = (d.features || []).some((k) => ["admin", "blog", "events", "giving", "contact", "newsletter"].includes(k));
  const phases = [
    ["Kickoff and content", "Confirm the plan and collect the logo, photos and text.", 0.7],
    ["UI design", "Design the look of the main pages and share it for review.", 1.4],
    ["Front-end development", "Build the pages based on the approved design.", 1.8],
    ...(hasBack ? [["Back end and features", "Connect the forms, admin dashboard and other features.", 1.3]] : []),
    ["Testing and revisions", "The client tests the website and I make the agreed changes.", 1.0],
    ["Launch and handover", "Connect the domain, set up SEO, go live and hand over.", 0.5]];
  const tot = phases.reduce((s, p) => s + p[2], 0); let start = 0;
  return phases.map((p, i) => {
    const len = i === phases.length - 1 ? days - start : Math.max(1, Math.round(p[2] / tot * days));
    const a = start + 1, b = Math.min(days, start + len); start = b;
    const lbl = weeks <= 2 ? (a === b ? `Day ${a}` : `Days ${a}–${b}`) : (() => { const wa = Math.ceil(a / 7), wb = Math.ceil(b / 7); return wa === wb ? `Week ${wa}` : `Weeks ${wa}–${wb}`; })();
    return [lbl, p[0], p[1]];
  });
}

// Rows of [name, when, share, amount]. The last payment takes whatever is left, so the rows always add up to the total.
export function schedule(d, total) {
  let plan = PLANS[d.plan];
  if (!plan) { const dp = Math.min(100, Math.max(0, +d.depositPct || 0)); plan = dp >= 100 ? [["Full payment", "Before work begins", 100]] : [["Deposit to start", "Before work begins", dp], ["Final payment", "On launch, before handover", 100 - dp]]; }
  let used = 0;
  return plan.filter((p) => p[2] > 0).map((p, i, arr) => { const amt = i === arr.length - 1 ? Math.round((total - used) * 100) / 100 : Math.round(total * p[2]) / 100; used += amt; return [p[0], p[1], `${p[2]}%`, money(amt)]; });
}

export function build(d, brand) {
  const org = (d.org || "").trim() || "the client", sec = d.sections || {};
  const fill = (s) => String(s).replaceAll("{org}", org);
  const goals = GOALS.filter((g) => (d.goals || []).includes(g[0])).map((g) => g[1]);
  const pages = (d.pages || []).filter((p) => p.name);
  const feats = FEATURES.filter((f) => (d.features || []).includes(f[0])).map((f) => f[1]).concat((d.extraFeatures || []).filter(Boolean));
  const items = (d.items || []).filter((l) => String(l.item || "").trim() || +l.price);
  const total = items.reduce((s, l) => s + (+l.price || 0), 0);
  const blocks = []; let n = 0; const H2 = (t) => blocks.push({ t: "h", n: ++n, text: t });
  const validUntil = addDays(d.date, d.validDays || 14);
  blocks.push({ t: "cover", eyebrow: "Proposal", title: d.title || "Website Design & Development Proposal", client: org, contact: [d.contactName, d.contactRole].filter(Boolean).join(", "),
    facts: [["Proposal no.", d.number || "Draft"], ["Date", longDate(d.date)], ["Valid until", longDate(validUntil)], ["Prepared by", `${brand.name}, ${brand.title}`]] });

  H2("Client details");
  blocks.push({ t: "kv", rows: [["Organization", org], ["Contact person", [d.contactName, d.contactRole].filter(Boolean).join(", ")], ["Type", d.industry], ["Phone / WhatsApp", d.phone], ["Email", d.email]].filter((r) => r[1]) });

  H2("Project overview");
  blocks.push({ t: "p", text: `${org} would like a new ${lc(d.siteType || "website")}${goals.length ? ` that helps them ${joinList(goals.map(lc))}` : ""}. This proposal explains what I will build, how long it will take and what it will cost.` });
  if ((d.goalNote || "").trim()) blocks.push({ t: "note", text: `In the client's words: “${d.goalNote.trim()}”` });
  if (goals.length) { blocks.push({ t: "sub", text: "Project goals" }); blocks.push({ t: "bullets", items: goals }); }

  H2("Proposed solution");
  blocks.push({ t: "p", text: `I will design and build a modern, mobile-friendly ${lc(d.siteType || "website")} for ${org} with ${pages.length} page${pages.length === 1 ? "" : "s"}. The website will be easy to use on phones, tablets and computers, quick to load, and simple for visitors to find what they need.${(d.solutionNote || "").trim() ? " " + d.solutionNote.trim() : ""}` });

  if (pages.length) { H2("Website pages"); blocks.push({ t: "table", cols: [{ h: "Page", w: 30 }, { h: "Purpose", w: 70 }], rows: pages.map((p) => [p.name, fill(p.purpose || "")]), firstBold: true }); }
  if (feats.length) { H2("Features included"); blocks.push({ t: "bullets", items: feats }); blocks.push({ t: "p", text: "Anything not listed in this proposal is not included, and can be quoted separately.", size: 9, c: BRAND.neutral }); }

  if (sec.design !== false) {
    H2("Design direction");
    blocks.push({ t: "p", text: `I will design the website to reflect the identity of ${org}. The look will be ${lc(d.style || DESIGN[0])}, with clean layouts, easy-to-read text and clear buttons that guide visitors.${(d.colors || "").trim() ? ` The colors will be based on ${d.colors.trim()}.` : ""} The design will be shared with the client for review before development starts.` });
    if ((d.references || "").trim()) blocks.push({ t: "kv", rows: [["Design references", d.references.trim()]] });
  }
  if (sec.domain !== false) {
    const rows = [];
    if (DOMAIN[d.domain]) rows.push(["Domain", DOMAIN[d.domain] + ((d.domainName || "").trim() ? ` Preferred domain: ${d.domainName.trim()} (if available).` : "")]);
    if (HOSTING[d.hosting]) rows.push(["Hosting", HOSTING[d.hosting]]);
    if (EMAIL[d.bizEmail]) rows.push(["Business email", EMAIL[d.bizEmail]]);
    if (rows.length) { H2("Domain, hosting and email"); blocks.push({ t: "kv", rows }); }
  }
  if (sec.timeline !== false) {
    H2("Estimated timeline");
    blocks.push({ t: "p", text: `The project will take about ${d.weeks || 4} week${+d.weeks === 1 ? "" : "s"}. ${d.start || START[0]}.` });
    blocks.push({ t: "table", cols: [{ h: "When", w: 22 }, { h: "Stage", w: 30 }, { h: "What happens", w: 48 }], rows: timeline(d), firstBold: true });
    blocks.push({ t: "p", text: `To keep the project on time, the client agrees to send content within the first week and review feedback within ${d.reviewDays || 3} days of each review request. Delays in content or feedback will move the timeline.`, size: 9.5 });
  }
  if (sec.support !== false) {
    H2("Revisions and support");
    const sup = [`${d.revisions || 2} rounds of revisions on the design and ${d.revisions || 2} on the finished website.`, `${d.supportDays || 30} days of free support after launch to fix any bugs or errors in the work delivered.`, "New pages or new features after approval are quoted separately."];
    if (d.maintenance === "offer" && +d.maintenancePrice > 0) sup.push(`Optional monthly maintenance plan: ${money(d.maintenancePrice)} per month for updates, backups, small content changes and technical support.`);
    blocks.push({ t: "bullets", items: sup });
  }

  H2("Investment");
  blocks.push({ t: "table", cols: [{ h: "Item", w: 75 }, { h: "Amount (USD)", w: 25, align: "right" }], rows: items.map((l) => [l.item || "Item", money(l.price)]), foot: [["Total", money(total), true]] });
  if (total > 0) {
    blocks.push({ t: "sub", text: "Payment schedule" });
    blocks.push({ t: "table", cols: [{ h: "Payment", w: 30 }, { h: "When", w: 38 }, { h: "Share", w: 12, align: "right" }, { h: "Amount", w: 20, align: "right" }], rows: schedule(d, total) });
  }
  blocks.push({ t: "p", text: `All prices are in US dollars (USD). Work starts once the first payment is received.${brand.payInfo ? ` Payment methods: ${brand.payInfo}.` : ""}`, size: 9.5 });

  H2("Next steps");
  blocks.push({ t: "bullets", items: ["Review this proposal and tell me if you would like any changes.", "Approve it by replying “Approved” on WhatsApp or email, or by signing below.", "I will send the service agreement and the first invoice.", "Work starts as soon as the first payment is received."] });
  if (validUntil) blocks.push({ t: "p", text: `This proposal is valid until ${longDate(validUntil)}.`, size: 9.5, c: BRAND.neutral });
  blocks.push({ t: "sign", parties: [{ label: "Approved by the client", name: [d.contactName, org !== "the client" ? org : ""].filter(Boolean).join(", ") }, { label: "Prepared by", name: `${brand.name}, ${brand.title}` }] });

  if (sec.about !== false) {
    H2(`About ${brand.name}`);
    blocks.push({ t: "p", text: brand.about || `I'm ${brand.name}, a web developer who designs and builds modern, mobile-friendly websites for businesses, churches and organizations.` });
    blocks.push({ t: "kv", rows: [["Email", brand.email], ["Phone / WhatsApp", brand.phone], ["Portfolio", brand.portfolio]].filter((r) => r[1]) });
  }
  return { meta: { docType: "Proposal", number: d.number, client: org, brand }, blocks, total };
}

export function check(d) {
  const w = [];
  if (!(d.org || "").trim()) w.push("Add the client's organization name.");
  if (!(d.contactName || "").trim()) w.push("Add the contact person's name.");
  if (!(d.pages || []).filter((p) => p.name).length) w.push("Choose at least one page.");
  const items = (d.items || []).filter((l) => +l.price > 0);
  if (!items.length) w.push("Add at least one price item in Investment.");
  if (!(d.goals || []).length) w.push("Pick at least one project goal.");
  return w;
}
