import { longDate as LD, shortDate, addDays, head, meta } from "../helpers.js";

export const STATUS = ["Not started", "In progress", "Done"];

export function rows(start, weeks, hasBack, reviewDays) {
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
  let cursor = 0; const out = [];
  work.forEach((x, i) => {
    const len = x[3] === "review" ? rv : (i === work.length - 1 ? Math.max(1, days - cursor) : Math.max(1, Math.round(x[2] / wsum * workDays)));
    const a = addDays(start, cursor), b = addDays(start, cursor + len - 1); cursor += len;
    out.push({ stage: x[0], desc: x[1], start: a, end: b, status: "Not started" });
  });
  return out;
}

export function build(d, brand) {
  const rs = d.rows || [], done = rs.filter((r) => r.status === "Done").length, prog = rs.length ? Math.round(done / rs.length * 100) : 0;
  const end = rs.length ? rs[rs.length - 1].end : "";
  const content = rs.find((r) => /content/i.test(r.stage));
  const blocks = [head("Timeline", d)];
  blocks.push({ t: "parties", left: { label: "Prepared for", lines: [(d.org || "").trim() || "Client", d.contactName].filter(Boolean) },
    right: { label: "Project dates", rows: [["Timeline no.", d.number || "Draft"], ["Start", LD(d.startDate)], ["Content due", content ? LD(content.end) : ""], ["Estimated launch", LD(end)], ["Progress", `${prog}% (${done} of ${rs.length} stages done)`]].filter((r) => r[1]) } });
  blocks.push({ t: "table", cols: [{ h: "Stage", w: 26 }, { h: "Dates", w: 22 }, { h: "What happens", w: 36 }, { h: "Status", w: 16 }], firstBold: true,
    rows: rs.map((r) => [r.stage, r.start === r.end ? shortDate(r.start) : `${shortDate(r.start)} – ${shortDate(r.end)}`, r.desc, r.status]) });
  blocks.push({ t: "p", text: `Dates are estimates. They move if content or feedback arrives late. Please send feedback within ${d.reviewDays || 3} days of each review request.`, size: 9.5 });
  if ((d.note || "").trim()) blocks.push({ t: "note", text: d.note.trim() });
  return { meta: meta("Timeline", d, brand), blocks, total: 0 };
}

export function check(d) { const w = []; if (!d.startDate) w.push("Choose the start date."); if (!(d.rows || []).length) w.push("Create the timeline stages."); return w; }
