import { longDate as LD, head, meta } from "../helpers.js";

export const STATUS = [["no", "Not requested"], ["req", "Requested"], ["rec", "Received"], ["ok", "Approved"]];
export const PRESETS = [
  ["Brand", "Logo (clear PNG or SVG file)"], ["Brand", "Brand colors and fonts (if you have them)"],
  ["About", "Business description and background"], ["About", "Mission and vision"],
  ["Services", "List of services or products, with short descriptions"], ["Services", "Prices (only if they should show on the site)"],
  ["Contact", "Phone, email, address and opening hours"], ["Contact", "Social media links"],
  ["Media", "Photos (team, place, events, work)"], ["Media", "Videos (links)"],
  ["Team", "Team or leaders: names, roles and photos"], ["Trust", "Testimonials or reviews"],
  ["Pages", "Text for each page"], ["Legal", "Privacy policy or terms (if needed)"],
  ["Payments", "Booking or payment details (if needed)"], ["Domain", "Preferred domain name"]];
const ctLabel = (k) => (STATUS.find((x) => x[0] === k) || STATUS[0])[1];

export function build(d, brand) {
  // items marked "Not requested" stay off the document
  const items = (d.items || []).filter((x) => x.status !== "no" && String(x.label || "").trim());
  const got = items.filter((x) => x.status === "rec" || x.status === "ok").length;
  const blocks = [head("Checklist", d, "Website content")];
  blocks.push({ t: "parties", left: { label: "Prepared for", lines: [(d.org || "").trim() || "Client", d.contactName].filter(Boolean) },
    right: { label: "Details", rows: [["Checklist no.", d.number || "Draft"], ["Date", LD(d.date)], ["Please send by", LD(d.dueDate)], ["How to send", d.sendVia], ["Received", `${got} of ${items.length}`]].filter((r) => r[1]) } });
  blocks.push({ t: "p", text: "To build your website, I need the items below. Items marked “Requested” are still missing. Send what you have now. We can add the rest later." });
  blocks.push({ t: "table", cols: [{ h: "Item", w: 56 }, { h: "Section", w: 20 }, { h: "Status", w: 24 }], rows: items.map((x) => [x.label + (x.note ? ` (${x.note})` : ""), x.cat || "", ctLabel(x.status)]) });
  blocks.push({ t: "note", text: "Please do not send passwords by WhatsApp or email. If I need access to an account, we will set up a safe way to share it." });
  return { meta: meta("Checklist", d, brand), blocks, total: 0 };
}

export function check(d) { const w = []; if (!(d.items || []).some((x) => x.status !== "no")) w.push("Mark at least one item as Requested."); if (!d.dueDate) w.push("Choose the date the client should send content by."); return w; }
