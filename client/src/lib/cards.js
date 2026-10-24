// Canvas images: progress card, thank-you card and year-in-review card. Ported from the prototype.
import { PHASES, STAGES, LAST } from "../constants.js";
import { fmtDate, todayStr, pctOf, stageOf, paidOf, money, year } from "./format.js";
import { loadDocFonts } from "../fonts.js";

const BR = { ink: "#0f1d17", green: "#0f6b4a", mint: "#dcefe5", gold: "#e6b04a", paper: "#ffffff", soft: "#f3f5f2", muted: "#5d6b64", line: "#dde3de" };
const FD = '"Bricolage Grotesque", system-ui, sans-serif', FB = '"Instrument Sans", system-ui, sans-serif';

export async function fontsReady() {
  try { await Promise.all(['800 60px "Bricolage Grotesque"', '700 40px "Bricolage Grotesque"', '400 30px "Instrument Sans"', '600 30px "Instrument Sans"', '500 30px "JetBrains Mono"'].map((f) => document.fonts.load(f))); } catch { /* fall back to system fonts */ }
}

export function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}

function brandFooter(ctx, s, y, dark) {
  ctx.fillStyle = dark ? BR.paper : BR.ink; ctx.font = `700 34px ${FD}`; ctx.fillText(s.bizName, 72, y);
  ctx.font = `400 26px ${FB}`; ctx.fillStyle = dark ? "rgba(255,255,255,.7)" : BR.muted;
  ctx.fillText([s.tagline, s.phone && ("WhatsApp " + s.phone)].filter(Boolean).join("  ·  "), 72, y + 40);
  if (s.portfolio) ctx.fillText(s.portfolio, 72, y + 76);
}

const newCanvas = (W, H) => { const c = document.createElement("canvas"); c.width = W; c.height = H; return [c, c.getContext("2d")]; };

export async function makeUpdateCard(d, s) {
  await fontsReady();
  const W = 1080, H = 1350, [c, x] = newCanvas(W, H);
  x.fillStyle = BR.ink; x.fillRect(0, 0, W, H);
  x.fillStyle = BR.gold; x.font = `600 26px ${FB}`; x.fillText("PROJECT UPDATE  ·  " + fmtDate(todayStr()).toUpperCase(), 72, 120);
  x.fillStyle = BR.paper; x.font = `800 80px ${FD}`; let y = wrapText(x, d.name || "Your project", 72, 220, W - 144, 88);
  x.fillStyle = "rgba(255,255,255,.7)"; x.font = `400 32px ${FB}`; x.fillText(d.client || "", 72, y + 4);
  y += 110; x.fillStyle = BR.gold; x.font = `800 180px ${FD}`; x.fillText(pctOf(d) + "%", 66, y + 130); x.fillStyle = "rgba(255,255,255,.7)"; x.font = `400 30px ${FB}`; x.fillText("complete", 72, y + 180);
  y += 250;
  const sw = (W - 144 - 3 * 14) / 4, si = STAGES.findIndex((st) => st[0] === stageOf(d));
  STAGES.forEach(([k, n], i) => {
    const sx = 72 + i * (sw + 14);
    x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(sx, y, sw, 14);
    const idx = PHASES.map((p, j) => (p[0] === k ? j : -1)).filter((j) => j >= 0);
    const pct = d.phase === LAST ? 1 : i < si ? 1 : i > si ? 0 : (idx.filter((j) => j < d.phase).length + 0.5) / idx.length;
    x.fillStyle = BR.gold; x.fillRect(sx, y, sw * pct, 14);
    x.fillStyle = i === si ? BR.paper : "rgba(255,255,255,.55)"; x.font = `600 24px ${FB}`; x.fillText(n.toUpperCase(), sx, y + 52);
  });
  y += 120;
  const item = (label, val) => { x.fillStyle = BR.gold; x.font = `600 24px ${FB}`; x.fillText(label, 72, y); x.fillStyle = BR.paper; x.font = `500 34px ${FB}`; y = wrapText(x, val, 72, y + 46, W - 144, 42) + 26; };
  if (d.phase > 0) item("DONE", PHASES[d.phase - 1][1]);
  item("NOW", PHASES[d.phase][1]);
  if (d.nextStep) item("NEXT", d.nextStep);
  x.fillStyle = "rgba(255,255,255,.15)"; x.fillRect(72, H - 200, W - 144, 2); brandFooter(x, s, H - 136, true);
  return c;
}

const TITLES = /^(pastor|rev\.?|reverend|dr\.?|mr\.?|mrs\.?|ms\.?|miss|bishop|apostle|elder|deacon|deaconess|prophet|evangelist|sis\.?|sister|bro\.?|brother|hon\.?|chief|madam|old ma|pa)$/i;
export const thanksFirstName = (name) => { const parts = String(name).trim().split(/\s+/); return (TITLES.test(parts[0]) && parts[1] ? parts[0] + " " + parts[1] : parts[0]) || name; };

export async function makeThanksCard(name, projects, s) {
  const N = { navy: "#0F172A", light: "#E2E8F0", slate: "#94A3B8", white: "#FFFFFF" };
  const HF = "DocPoppins, Poppins, sans-serif", BF = "DocInter, Inter, sans-serif";
  try { await loadDocFonts(); } catch { /* falls back to Google Fonts faces */ }
  const refs = projects.filter((p) => (p.referredBy || "").trim() === name);
  const first = thanksFirstName(name);
  const W = 1080, H = 1350, [c, x] = newCanvas(W, H);
  x.fillStyle = N.navy; x.fillRect(0, 0, W, H);
  // two overlapping rings: you and me, connected
  x.lineWidth = 3; x.strokeStyle = "rgba(226,232,240,.14)";
  const cy = 170, r = 190, ax = W - 210, bx = W - 60;
  x.beginPath(); x.arc(ax, cy, r, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(bx, cy, r, 0, Math.PI * 2); x.stroke();
  const ang = Math.acos((bx - ax) / 2 / r); x.fillStyle = "rgba(226,232,240,.07)"; x.beginPath(); x.arc(ax, cy, r, -ang, ang); x.arc(bx, cy, r, Math.PI - ang, Math.PI + ang); x.fill();
  const ls = (px) => { if ("letterSpacing" in x) x.letterSpacing = px; };
  ls("6px"); x.fillStyle = N.slate; x.font = `600 24px ${BF}`; x.fillText("A NOTE OF THANKS", 80, 130); ls("0px");
  x.fillStyle = N.slate; x.font = `600 104px ${HF}`; x.fillText("Thank you,", 74, 330);
  const fsz = first.length > 14 ? 84 : first.length > 9 ? 104 : 132;
  x.fillStyle = N.white; x.font = `600 ${fsz}px ${HF}`; x.fillText(first + ".", 74, 330 + fsz + 14);
  let y = 560; x.fillStyle = N.light; x.font = `400 42px ${BF}`;
  y = wrapText(x, `For sending ${refs.length === 1 ? "a client" : refs.length + " clients"} my way. It means more than you know.`, 80, y, W - 160, 58);
  if (refs.length) {
    y += 40; ls("4px"); x.fillStyle = N.slate; x.font = `600 22px ${BF}`; x.fillText("YOU CONNECTED ME WITH", 80, y); ls("0px"); y += 58;
    refs.slice(0, 4).forEach((p) => { x.fillStyle = N.light; x.fillRect(80, y - 14, 26, 3); x.fillStyle = N.white; x.font = `500 38px ${HF}`; x.fillText(String(p.client || p.name).slice(0, 34), 126, y); y += 62; });
    if (refs.length > 4) { x.fillStyle = N.slate; x.font = `400 30px ${BF}`; x.fillText(`+ ${refs.length - 4} more`, 126, y); y += 50; }
  }
  x.fillStyle = N.slate; x.font = `400 32px ${BF}`; wrapText(x, "If you hear of anyone who needs a website or design, please keep calling my name.", 80, Math.max(y + 30, 1010), W - 160, 46);
  x.fillStyle = "rgba(226,232,240,.25)"; x.fillRect(80, H - 200, W - 160, 2);
  x.fillStyle = N.white; x.font = `600 38px ${HF}`; x.fillText(s.bizName, 80, H - 130);
  x.fillStyle = N.slate; x.font = `400 26px ${BF}`; x.fillText([s.tagline, s.phone && ("WhatsApp " + s.phone)].filter(Boolean).join("  ·  "), 80, H - 88);
  if (s.portfolio) x.fillText(s.portfolio, 80, H - 52);
  return { canvas: c, first };
}

export async function makeYearCard(projects, s) {
  const Y = String(year()); await fontsReady();
  const ps = projects.filter((p) => p.status !== "lost" && (String(p.createdAt || "").startsWith(Y) || String(p.startDate || "").startsWith(Y) || Object.values(p.phaseDates || {}).some((v) => String(v).startsWith(Y))));
  const launched = ps.filter((p) => p.phase === LAST).length, clients = new Set(ps.map((p) => (p.client || p.name).toLowerCase())).size;
  const earned = ps.reduce((a, p) => a + (p.billing !== "portfolio" ? paidOf(p) : 0), 0);
  const W = 1080, H = 1920, [c, x] = newCanvas(W, H);
  x.fillStyle = BR.green; x.fillRect(0, 0, W, H); x.fillStyle = BR.ink; x.fillRect(0, H * 0.62, W, H * 0.38);
  x.fillStyle = BR.gold; x.font = `600 30px ${FB}`; x.fillText("WHAT I BUILT IN " + Y, 72, 180);
  x.fillStyle = BR.paper; x.font = `800 120px ${FD}`; x.fillText("My " + Y, 72, 320); x.fillText("in websites", 72, 440);
  const stat = (n, l, sx, sy) => { x.fillStyle = BR.paper; x.font = `800 130px ${FD}`; x.fillText(n, sx, sy); x.font = `500 30px ${FB}`; x.fillStyle = "rgba(255,255,255,.8)"; x.fillText(l, sx + 4, sy + 48); };
  stat(String(ps.length), "projects", 72, 680); stat(String(launched), "launched", 560, 680); stat(String(clients), "clients & orgs", 72, 920);
  if (earned > 0) stat(money(earned), "earned", 560, 920);
  let y = H * 0.62 + 100; x.fillStyle = BR.gold; x.font = `600 26px ${FB}`; x.fillText("PROJECTS", 72, y); y += 60;
  x.font = `700 40px ${FD}`; ps.slice(0, 7).forEach((p) => { x.fillStyle = BR.paper; x.fillText("→  " + String(p.name).slice(0, 34), 72, y); y += 60; });
  if (ps.length > 7) { x.fillStyle = "rgba(255,255,255,.6)"; x.font = `400 30px ${FB}`; x.fillText(`+ ${ps.length - 7} more`, 72, y); y += 50; }
  x.fillStyle = BR.gold; x.fillRect(72, H - 290, W - 144, 4);
  x.fillStyle = BR.paper; x.font = `800 46px ${FD}`; x.fillText("Need a website or design?", 72, H - 220);
  x.font = `400 30px ${FB}`; x.fillStyle = "rgba(255,255,255,.8)"; x.fillText([s.phone && ("WhatsApp " + s.phone), s.bizName].filter(Boolean).join("  ·  "), 72, H - 165);
  if (s.portfolio) x.fillText(s.portfolio, 72, H - 120);
  return c;
}
