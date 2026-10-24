/* Document engine: one document model -> A4 layout -> PDF (jsPDF), canvas preview, Word (.docx).
   Ported from reference/docengine.js. The layout maths is unchanged. */
import { Buffer } from "buffer";
import { BRAND } from "./helpers.js";
import { loadDocFonts } from "../fonts.js";

const PT = 0.3528; // mm per pt
const W = 210, H = 297, ML = 20, MR = 20, CW = W - ML - MR, TOP = 30, BOT = 270;
// font keys -> [jsPDF family, jsPDF style, css family, css weight, word font]
const FONTS = {
  h: ["Poppins", "semibold", "DocPoppins, Poppins, sans-serif", 600, "Poppins SemiBold"],
  m: ["Poppins", "medium", "DocPoppins, Poppins, sans-serif", 500, "Poppins Medium"],
  r: ["Inter", "regular", "DocInter, Inter, sans-serif", 400, "Inter"],
  b: ["Inter", "semibold", "DocInter, Inter, sans-serif", 600, "Inter SemiBold"],
};
let fontData = null, jsPDFLib = null, docxLib = null;

export function setFontData(d) { fontData = d; }
export async function loadFonts() { fontData = await loadDocFonts(); return fontData; }
// Loads jsPDF (and docx for Word files) on first use, so the app itself stays small.
export async function ensureLibs(word) {
  if (!jsPDFLib) jsPDFLib = (await import("jspdf")).jsPDF;
  if (word && !docxLib) docxLib = await import("docx");
}
export const ready = async (word) => { await Promise.all([ensureLibs(word), fontData ? null : loadFonts()]); };

function b64(buf) {
  let s = ""; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function makePdf() {
  const pdf = new jsPDFLib({ unit: "mm", format: "a4", compress: true });
  for (const [k, buf] of Object.entries(fontData)) {
    const [fam, st] = k.split("-");
    pdf.addFileToVFS(k + ".ttf", b64(buf));
    pdf.addFont(k + ".ttf", fam, st.toLowerCase());
  }
  return pdf;
}

// the PDF fonts have no emoji: drop them so the preview matches the PDF
const EMOJI = /[\p{Extended_Pictographic}🏻-🏿️‍]/gu;
export const clean = (s) => {
  const t = String(s ?? "");
  if (!new RegExp(EMOJI.source, "u").test(t)) return t.replace(/ {2,}/g, " ");
  // after dropping emoji, also close the gap they leave before punctuation
  return t.replace(EMOJI, "").replace(/ {2,}/g, " ").replace(/ +([.,;:!?])/g, "$1").trim();
};

/* ---------------- layout ---------------- */
export function layout(model, pdf) {
  const pages = []; let ops, y;
  const setF = (f, size) => { pdf.setFont(FONTS[f][0], FONTS[f][1]); pdf.setFontSize(size); };
  function wrap(s, f, size, w) {
    setF(f, size); const out = [];
    for (const para of String(s ?? "").split("\n")) {
      const words = para.split(/\s+/).filter(Boolean); let line = "";
      if (!words.length) { out.push(""); continue; }
      for (let wd of words) {
        while (pdf.getTextWidth(wd) > w && wd.length > 1) { // break very long words (URLs)
          let i = wd.length; while (i > 1 && pdf.getTextWidth(wd.slice(0, i)) > w) i--;
          if (line) { out.push(line); line = ""; }
          out.push(wd.slice(0, i)); wd = wd.slice(i);
        }
        const t = line ? line + " " + wd : wd;
        if (pdf.getTextWidth(t) > w && line) { out.push(line); line = wd; } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  const newPage = (cover) => { ops = []; pages.push({ ops, cover: !!cover }); y = cover ? 0 : TOP; };
  const ensure = (h) => { if (y + h > BOT) newPage(false); };
  const T = (x, yy, s, f, size, c, align, cs) => ops.push({ k: "t", x, y: yy, s: clean(s), f, size, c: c || BRAND.slate, align: align || "left", cs: cs || 0 });
  const L = (x1, y1, x2, y2, c, w) => ops.push({ k: "l", x1, y1, x2, y2, c: c || BRAND.light, w: w || 0.3 });
  const R = (x, yy, w, h, c) => ops.push({ k: "r", x, y: yy, w, h, c: c || BRAND.light });
  const lineH = (size, lh) => size * PT * lh;
  function para(s, o = {}) {
    const f = o.f || "r", size = o.size || 10, lh = o.lh || 1.55, x = o.x ?? ML, w = o.w ?? CW, c = o.c || BRAND.slate;
    const lines = wrap(s, f, size, w), Lh = lineH(size, lh);
    for (const ln of lines) { ensure(Lh); T(x, y + Lh * 0.72, ln, f, size, c); y += Lh; }
    y += o.after ?? 3;
  }

  const B = {
    cover(b) {
      newPage(true);
      T(ML, 30, model.meta.brand.name, "h", 16, BRAND.navy);
      T(ML, 36.5, [model.meta.brand.title, model.meta.brand.tagline].filter(Boolean).join("  ·  "), "r", 9.5, BRAND.neutral);
      y = 92;
      R(ML, y, 18, 1.1, BRAND.navy); y += 10;
      T(ML, y, b.eyebrow.toUpperCase(), "b", 9, BRAND.neutral, "left", 0.9); y += 6;
      for (const ln of wrap(b.title, "h", 30, 150)) { y += lineH(30, 1.12); T(ML, y - 3, ln, "h", 30, BRAND.navy); }
      y += 12;
      T(ML, y, "Prepared for", "r", 10, BRAND.neutral); y += 8;
      for (const ln of wrap(b.client, "m", 17, 150)) { T(ML, y, ln, "m", 17, BRAND.navy); y += 8; }
      if (b.contact) { T(ML, y, b.contact, "r", 10.5, BRAND.slate); y += 6; }
      const gy = 222, colW = CW / 2;
      L(ML, gy, W - MR, gy, BRAND.light, 0.3);
      (b.facts || []).forEach((f, i) => {
        const cx = ML + (i % 2) * colW, cy = gy + 9 + Math.floor(i / 2) * 17;
        T(cx, cy, f[0].toUpperCase(), "b", 7.5, BRAND.neutral, "left", 0.6);
        T(cx, cy + 6, f[1], "r", 10.5, BRAND.navy);
      });
      newPage(false);
    },
    h(b) {
      ensure(b.keep || 46); // a heading never sits alone at the bottom of a page
      if (y > TOP + 1) { y += 5; L(ML, y, W - MR, y, BRAND.light, 0.3); y += 9; } else y += 4;
      if (b.n != null) { const nx = String(b.n).padStart(2, "0"); T(ML, y, nx, "m", 11, BRAND.neutral); T(ML + 10, y, b.text, "h", 13.5, BRAND.navy); }
      else T(ML, y, b.text, "h", 13.5, BRAND.navy);
      y += 6;
    },
    sub(b) { ensure(14); y += 2; T(ML, y + 4, b.text, "b", 10, BRAND.navy); y += 7.5; },
    p(b) { para(b.text, b); },
    bullets(b) {
      for (const it of b.items) {
        const lines = wrap(it, "r", 10, CW - 6), Lh = lineH(10, 1.5);
        ensure(Lh); R(ML + 1, y + Lh * 0.72 - 1.6, 1.3, 1.3, BRAND.navy);
        for (const ln of lines) { ensure(Lh); T(ML + 6, y + Lh * 0.72, ln, "r", 10, BRAND.slate); y += Lh; }
        y += 1.2;
      }
      y += 2;
    },
    kv(b) {
      const lw = b.labelW || 46;
      const totH = b.rows.reduce((h, [, v]) => h + wrap(v || "—", "r", 10, CW - lw - 2).length * lineH(10, 1.45) + 4, 0);
      if (totH < 60) ensure(totH); // small tables stay on one page
      for (const [k, v] of b.rows) {
        const lines = wrap(v || "—", "r", 10, CW - lw - 2), Lh = lineH(10, 1.45), h = lines.length * Lh + 4;
        ensure(h);
        T(ML, y + 2 + Lh * 0.72, k, "b", 9, BRAND.neutral);
        lines.forEach((ln, i) => T(ML + lw, y + 2 + Lh * 0.72 + i * Lh, ln, "r", 10, BRAND.navy));
        y += h; L(ML, y, W - MR, y);
      }
      y += 4;
    },
    table(b) {
      const cols = b.cols, total = cols.reduce((s, c) => s + c.w, 0);
      const ws = cols.map((c) => c.w / total * CW), xs = ws.map((_, i) => ML + ws.slice(0, i).reduce((a, v) => a + v, 0));
      const pad = 2.5, Lh = lineH(9.5, 1.45);
      const head = () => {
        ensure(9 + Lh); R(ML, y, CW, 8.5, BRAND.light);
        cols.forEach((c, i) => T(c.align === "right" ? xs[i] + ws[i] - pad : xs[i] + pad, y + 5.6, c.h.toUpperCase(), "b", 7.5, BRAND.navy, c.align, 0.4));
        y += 8.5;
      };
      head();
      for (const row of b.rows) {
        const cells = row.map((v, i) => wrap(v ?? "", i === 0 && b.firstBold ? "b" : "r", 9.5, ws[i] - pad * 2));
        const h = Math.max(...cells.map((c) => c.length)) * Lh + 4;
        if (y + h > BOT) { newPage(false); head(); } // the header row repeats on the next page
        cells.forEach((lines, i) => lines.forEach((ln, j) => T(cols[i].align === "right" ? xs[i] + ws[i] - pad : xs[i] + pad, y + 2 + Lh * 0.72 + j * Lh, ln, i === 0 && b.firstBold ? "b" : "r", 9.5, i === 0 ? BRAND.navy : BRAND.slate, cols[i].align)));
        y += h; L(ML, y, W - MR, y);
      }
      if (b.foot && b.foot.length) {
        y += 2;
        for (const [k, v, strong] of b.foot) {
          const h = strong ? 10 : 7; ensure(h + 2);
          if (strong) { L(ML + CW * 0.5, y + 1, W - MR, y + 1, BRAND.navy, 0.5); }
          T(W - MR - 42, y + (strong ? 7.5 : 5), k, strong ? "h" : "r", strong ? 11 : 9.5, strong ? BRAND.navy : BRAND.slate, "right");
          T(W - MR - pad, y + (strong ? 7.5 : 5), v, strong ? "h" : "b", strong ? 11 : 9.5, BRAND.navy, "right");
          y += h;
        }
      }
      y += 5;
    },
    note(b) {
      const lines = wrap(b.text, "r", 9.5, CW - 10), Lh = lineH(9.5, 1.5), h = lines.length * Lh + 8;
      ensure(h); R(ML, y, CW, h, BRAND.light);
      lines.forEach((ln, i) => T(ML + 5, y + 4 + Lh * 0.72 + i * Lh, ln, "r", 9.5, BRAND.navy));
      y += h + 5;
    },
    sign(b) {
      ensure(52); y += 4; const colW = (CW - 12) / 2;
      b.parties.forEach((p, i) => {
        const x = ML + i * (colW + 12);
        T(x, y + 4, p.label.toUpperCase(), "b", 7.5, BRAND.neutral, "left", 0.6);
        wrap(p.name || "", "m", 10.5, colW).slice(0, 2).forEach((ln, j) => T(x, y + 10 + j * 5, ln, "m", 10.5, BRAND.navy));
        L(x, y + 28, x + colW, y + 28, BRAND.slate, 0.3); T(x, y + 32.5, "Signature", "r", 8, BRAND.neutral);
        L(x, y + 40, x + colW, y + 40, BRAND.slate, 0.3); T(x, y + 44.5, "Date", "r", 8, BRAND.neutral);
      });
      y += 50;
    },
    space(b) { y += b.h || 4; },
    pagebreak() { newPage(false); },
    dochead(b) {
      const br = model.meta.brand; y = 18;
      T(ML, y + 6, br.name, "h", 18, BRAND.navy);
      T(ML, y + 12, [br.title, br.tagline].filter(Boolean).join("  ·  "), "r", 9, BRAND.neutral);
      [br.email, br.phone, br.portfolio].filter(Boolean).forEach((s, i) => T(ML, y + 18.5 + i * 4.6, s, "r", 8.5, BRAND.slate));
      T(W - MR, y + 8, b.title, "h", 26, BRAND.navy, "right");
      T(W - MR, y + 15.5, b.number, "b", 10, BRAND.slate, "right");
      if (b.sub) T(W - MR, y + 21, b.sub, "r", 9, BRAND.neutral, "right");
      y += 36; L(ML, y, W - MR, y, BRAND.navy, 0.6); y += 9;
    },
    parties(b) {
      const colW = (CW - 14) / 2, x2 = ML + colW + 14; let ly = y + 9, ry = y + 9;
      T(ML, y + 3, b.left.label.toUpperCase(), "b", 7.5, BRAND.neutral, "left", 0.6);
      b.left.lines.forEach((ln, i) => { const f = i === 0 ? "m" : "r", sz = i === 0 ? 12 : 9.5; wrap(ln, f, sz, colW).forEach((w) => { T(ML, ly, w, f, sz, i === 0 ? BRAND.navy : BRAND.slate); ly += i === 0 ? 6 : 4.8; }); if (i === 0) ly += 0.5; });
      T(x2, y + 3, b.right.label.toUpperCase(), "b", 7.5, BRAND.neutral, "left", 0.6);
      b.right.rows.forEach(([k, v]) => { T(x2, ry, k, "r", 9, BRAND.neutral); const lines = wrap(v, "b", 9.5, colW - 30); lines.forEach((w, j) => T(W - MR, ry + j * 4.6, w, "b", 9.5, BRAND.navy, "right")); ry += 6 + (lines.length - 1) * 4.6; });
      y = Math.max(ly, ry) + 5;
    },
    amountbox(b) {
      ensure(28); R(ML, y, CW, 22, BRAND.light);
      T(ML + 6, y + 8.5, b.label.toUpperCase(), "b", 7.5, BRAND.neutral, "left", 0.6);
      if (b.sub) T(ML + 6, y + 16, b.sub, "m", 11.5, BRAND.navy);
      T(W - MR - 6, y + 15, b.amount, "h", 22, BRAND.navy, "right");
      y += 29;
    },
  };
  if (!model.blocks.length || model.blocks[0].t !== "cover") newPage(false);
  for (const b of model.blocks) (B[b.t] || (() => { }))(b);
  // drop a trailing empty page
  if (pages.length > 1 && !pages[pages.length - 1].ops.length) pages.pop();
  const n = pages.length, m = model.meta;
  pages.forEach((pg, i) => {
    const o = pg.ops;
    if (!pg.cover && !(i === 0 && m.noFirstHeader)) {
      o.push({ k: "t", x: ML, y: 15.5, s: m.brand.name, f: "h", size: 10, c: BRAND.navy, align: "left", cs: 0 });
      o.push({ k: "t", x: W - MR, y: 15.5, s: `${m.docType}  ·  ${m.number || "DRAFT"}`, f: "r", size: 8.5, c: BRAND.neutral, align: "right", cs: 0 });
      o.push({ k: "l", x1: ML, y1: 19.5, x2: W - MR, y2: 19.5, c: BRAND.light, w: 0.3 });
    }
    o.push({ k: "l", x1: ML, y1: 279, x2: W - MR, y2: 279, c: BRAND.light, w: 0.3 });
    o.push({ k: "t", x: ML, y: 285, s: [m.brand.email, m.brand.phone, m.brand.portfolio].filter(Boolean).join("   ·   "), f: "r", size: 7.5, c: BRAND.neutral, align: "left", cs: 0 });
    o.push({ k: "t", x: W - MR, y: 285, s: `Page ${i + 1} of ${n}`, f: "r", size: 7.5, c: BRAND.neutral, align: "right", cs: 0 });
  });
  return pages;
}

/* ---------------- renderers ---------------- */
const hex = (c) => { const v = c.replace("#", ""); return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]; };

export function toPdf(model) {
  const pdf = makePdf(), pages = layout(model, pdf);
  pdf.setProperties({ title: `${model.meta.docType} ${model.meta.number || ""} ${model.meta.client || ""}`.trim(), author: model.meta.brand.name, creator: model.meta.brand.name });
  pages.forEach((pg, i) => {
    if (i > 0) pdf.addPage("a4");
    for (const o of pg.ops) {
      if (o.k === "r") { pdf.setFillColor(...hex(o.c)); pdf.rect(o.x, o.y, o.w, o.h, "F"); }
      else if (o.k === "l") { pdf.setDrawColor(...hex(o.c)); pdf.setLineWidth(o.w); pdf.line(o.x1, o.y1, o.x2, o.y2); }
      else { pdf.setFont(FONTS[o.f][0], FONTS[o.f][1]); pdf.setFontSize(o.size); pdf.setTextColor(...hex(o.c)); const opt = { align: o.align }; if (o.cs) opt.charSpace = o.cs; pdf.text(o.s, o.x, o.y, opt); }
    }
  });
  return { pdf, pageCount: pages.length };
}

// Draws the same layout on canvases, one per page. Needs the browser.
export function preview(model, container, cssWidth) {
  const pdf = makePdf(), pages = layout(model, pdf);
  container.innerHTML = "";
  const dpr = Math.min(2, (window.devicePixelRatio || 1)), cw = Math.max(260, cssWidth || container.clientWidth || 600), scale = cw / W * dpr;
  pages.forEach((pg, i) => {
    const cv = document.createElement("canvas"); cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    cv.style.width = "100%"; cv.style.aspectRatio = `${W} / ${H}`; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", `Page ${i + 1} of ${pages.length}`);
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cv.width, cv.height);
    for (const o of pg.ops) {
      if (o.k === "r") { ctx.fillStyle = o.c; ctx.fillRect(o.x * scale, o.y * scale, o.w * scale, o.h * scale); }
      else if (o.k === "l") { ctx.strokeStyle = o.c; ctx.lineWidth = Math.max(1, o.w * scale); ctx.beginPath(); ctx.moveTo(o.x1 * scale, o.y1 * scale); ctx.lineTo(o.x2 * scale, o.y2 * scale); ctx.stroke(); }
      else {
        const F = FONTS[o.f]; ctx.font = `${F[3]} ${o.size * PT * scale}px ${F[2]}`; ctx.fillStyle = o.c; ctx.textAlign = o.align; ctx.textBaseline = "alphabetic";
        if ("letterSpacing" in ctx) ctx.letterSpacing = o.cs ? `${o.cs * scale}px` : "0px";
        ctx.fillText(o.s, o.x * scale, o.y * scale);
      }
    }
    const wrapEl = document.createElement("div"); wrapEl.className = "doc-page"; wrapEl.appendChild(cv); container.appendChild(wrapEl);
  });
  return pages.length;
}

export async function toDocx(model, { embedFonts = true } = {}) {
  const D = docxLib;
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, Header, Footer, PageNumber, ShadingType, TabStopType, PageBreak } = D;
  const m = model.meta, col = (c) => (c || BRAND.slate).replace("#", "");
  const run = (text, f = "r", size = 10, color, extra = {}) => new TextRun({ text: String(text ?? ""), font: FONTS[f][4], size: Math.round(size * 2), color: col(color), ...extra });
  const P = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { after: o.after ?? 120, before: o.before ?? 0, line: o.line ?? 300 }, alignment: o.align, keepNext: o.keepNext, ...(o.extra || {}) });
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const thin = { style: BorderStyle.SINGLE, size: 4, color: col(BRAND.light) };
  const CWT = 9638; // content width in twips (170mm)
  const cell = (paras, o = {}) => new TableCell({ children: paras, width: { size: o.w, type: WidthType.DXA }, shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: col(o.fill) } : undefined, borders: o.borders || { top: none, left: none, right: none, bottom: o.bottom ? thin : none }, margins: { top: 80, bottom: 80, left: o.padL ?? 100, right: 100 }, columnSpan: o.span });
  const spacer = () => { const p = P(run(""), { after: 120 }); p.__spacer = true; return p; };
  const coverChildren = [], body = [];
  let target = body;
  for (const b of model.blocks) {
    if (b.t === "cover") {
      target = coverChildren;
      target.push(P(run(m.brand.name, "h", 16, BRAND.navy), { after: 40 }));
      target.push(P(run([m.brand.title, m.brand.tagline].filter(Boolean).join("  ·  "), "r", 9.5, BRAND.neutral), { after: 2600 }));
      target.push(P(run(b.eyebrow.toUpperCase(), "b", 9, BRAND.neutral, { characterSpacing: 18 }), { after: 120 }));
      target.push(P(run(b.title, "h", 30, BRAND.navy), { after: 360, line: 240 }));
      target.push(P(run("Prepared for", "r", 10, BRAND.neutral), { after: 60 }));
      target.push(P(run(b.client, "m", 17, BRAND.navy), { after: 60 }));
      if (b.contact) target.push(P(run(b.contact, "r", 10.5), { after: 1800 }));
      const facts = b.facts || [], rows = [];
      for (let i = 0; i < facts.length; i += 2) {
        rows.push(new TableRow({ children: [0, 1].map((j) => { const f = facts[i + j]; return cell(f ? [P(run(f[0].toUpperCase(), "b", 7.5, BRAND.neutral, { characterSpacing: 12 }), { after: 40 }), P(run(f[1], "r", 10.5, BRAND.navy), { after: 120 })] : [P(run(""))], { w: CWT / 2, padL: 0 }); }) }));
      }
      if (rows.length) target.push(new Table({ rows, width: { size: CWT, type: WidthType.DXA }, columnWidths: [CWT / 2, CWT / 2], borders: { ...noBorders, top: thin } }));
      target = body; continue;
    }
    if (b.t === "h") body.push(P([...(b.n != null ? [run(String(b.n).padStart(2, "0") + "   ", "m", 11, BRAND.neutral)] : []), run(b.text, "h", 13.5, BRAND.navy)], { before: 360, after: 140, keepNext: true, extra: { border: { top: { style: BorderStyle.SINGLE, size: 4, color: col(BRAND.light), space: 10 } } } }));
    else if (b.t === "sub") body.push(P(run(b.text, "b", 10, BRAND.navy), { before: 120, after: 60, keepNext: true }));
    else if (b.t === "p") String(b.text).split("\n").forEach((t) => body.push(P(run(t, b.f || "r", b.size || 10, b.c))));
    else if (b.t === "bullets") b.items.forEach((it) => body.push(new Paragraph({ children: [run(it)], bullet: { level: 0 }, spacing: { after: 60, line: 290 } })));
    else if (b.t === "kv") body.push(new Table({ width: { size: CWT, type: WidthType.DXA }, columnWidths: [2600, CWT - 2600], borders: noBorders, rows: b.rows.map(([k, v]) => new TableRow({ children: [cell([P(run(k, "b", 9, BRAND.neutral), { after: 0 })], { w: 2600, bottom: true, padL: 0 }), cell(String(v || "—").split("\n").map((t) => P(run(t, "r", 10, BRAND.navy), { after: 0 })), { w: CWT - 2600, bottom: true })] })) }), spacer());
    else if (b.t === "table") {
      const tot = b.cols.reduce((s, c) => s + c.w, 0), ws = b.cols.map((c) => Math.round(c.w / tot * CWT));
      const al = (c) => (c.align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT);
      const rows = [new TableRow({ tableHeader: true, children: b.cols.map((c, i) => cell([P(run(c.h.toUpperCase(), "b", 7.5, BRAND.navy, { characterSpacing: 8 }), { after: 0, align: al(c) })], { w: ws[i], fill: BRAND.light })) })];
      b.rows.forEach((r) => rows.push(new TableRow({ cantSplit: true, children: r.map((v, i) => cell([P(run(v, i === 0 && b.firstBold ? "b" : "r", 9.5, i === 0 ? BRAND.navy : BRAND.slate), { after: 0, align: al(b.cols[i]) })], { w: ws[i], bottom: true })) })));
      (b.foot || []).forEach(([k, v, strong]) => rows.push(new TableRow({ children: [cell([P(run(k, strong ? "h" : "r", strong ? 11 : 9.5, strong ? BRAND.navy : BRAND.slate), { after: 0, align: AlignmentType.RIGHT })], { w: ws.slice(0, -1).reduce((a, x) => a + x, 0), span: b.cols.length - 1 }), cell([P(run(v, strong ? "h" : "b", strong ? 11 : 9.5, BRAND.navy), { after: 0, align: AlignmentType.RIGHT })], { w: ws[ws.length - 1] })] })));
      body.push(new Table({ rows, width: { size: CWT, type: WidthType.DXA }, columnWidths: ws, borders: noBorders }), spacer());
    }
    else if (b.t === "note") body.push(new Table({ width: { size: CWT, type: WidthType.DXA }, columnWidths: [CWT], borders: noBorders, rows: [new TableRow({ children: [cell([P(run(b.text, "r", 9.5, BRAND.navy), { after: 0 })], { w: CWT, fill: BRAND.light, padL: 200 })] })] }), spacer());
    else if (b.t === "sign") {
      const half = Math.round(CWT / 2);
      body.push(new Table({
        width: { size: CWT, type: WidthType.DXA }, columnWidths: [half, CWT - half], borders: noBorders, rows: [new TableRow({
          cantSplit: true, children: b.parties.map((p, i) => cell([
            P(run(p.label.toUpperCase(), "b", 7.5, BRAND.neutral, { characterSpacing: 12 }), { after: 40 }), P(run(p.name || "", "m", 10.5, BRAND.navy), { after: 600 }),
            P(run("______________________________", "r", 10, BRAND.slate), { after: 0 }), P(run("Signature", "r", 8, BRAND.neutral), { after: 360 }),
            P(run("______________________________", "r", 10, BRAND.slate), { after: 0 }), P(run("Date", "r", 8, BRAND.neutral), { after: 0 })], { w: i ? CWT - half : half, padL: 0 })),
        })],
      }));
    }
    else if (b.t === "dochead") {
      const half = Math.round(CWT / 2), R_ = AlignmentType.RIGHT;
      const left = [P(run(m.brand.name, "h", 18, BRAND.navy), { after: 20 }), P(run([m.brand.title, m.brand.tagline].filter(Boolean).join("  ·  "), "r", 9, BRAND.neutral), { after: 80 }),
        ...[m.brand.email, m.brand.phone, m.brand.portfolio].filter(Boolean).map((s) => P(run(s, "r", 8.5), { after: 0, line: 260 }))];
      const right = [P(run(b.title, "h", 26, BRAND.navy), { after: 20, align: R_ }), P(run(b.number, "b", 10), { after: 20, align: R_ }), ...(b.sub ? [P(run(b.sub, "r", 9, BRAND.neutral), { after: 0, align: R_ })] : [])];
      const navyLine = { style: BorderStyle.SINGLE, size: 10, color: col(BRAND.navy) };
      body.push(new Table({ width: { size: CWT, type: WidthType.DXA }, columnWidths: [half, CWT - half], borders: noBorders, rows: [new TableRow({ children: [cell(left, { w: half, padL: 0, borders: { top: none, left: none, right: none, bottom: navyLine } }), cell(right, { w: CWT - half, borders: { top: none, left: none, right: none, bottom: navyLine } })] })] }), spacer());
    }
    else if (b.t === "parties") {
      const half = Math.round(CWT / 2), lab = (t) => P(run(t.toUpperCase(), "b", 7.5, BRAND.neutral, { characterSpacing: 12 }), { after: 80 });
      const left = [lab(b.left.label), ...b.left.lines.map((ln, i) => P(run(ln, i === 0 ? "m" : "r", i === 0 ? 12 : 9.5, i === 0 ? BRAND.navy : BRAND.slate), { after: i === 0 ? 60 : 0, line: 270 }))];
      const right = [lab(b.right.label), ...b.right.rows.map(([k, v]) => new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWT - half - 220 }], spacing: { after: 60 }, children: [run(k, "r", 9, BRAND.neutral), run("\t" + v, "b", 9.5, BRAND.navy)] }))];
      body.push(new Table({ width: { size: CWT, type: WidthType.DXA }, columnWidths: [half, CWT - half], borders: noBorders, rows: [new TableRow({ children: [cell(left, { w: half, padL: 0 }), cell(right, { w: CWT - half, padL: 200 })] })] }), spacer());
    }
    else if (b.t === "amountbox") {
      const half = Math.round(CWT * 0.55);
      body.push(new Table({ width: { size: CWT, type: WidthType.DXA }, columnWidths: [half, CWT - half], borders: noBorders, rows: [new TableRow({ children: [
        cell([P(run(b.label.toUpperCase(), "b", 7.5, BRAND.neutral, { characterSpacing: 12 }), { after: 60 }), ...(b.sub ? [P(run(b.sub, "m", 11.5, BRAND.navy), { after: 0 })] : [])], { w: half, fill: BRAND.light, padL: 240 }),
        cell([P(run(b.amount, "h", 22, BRAND.navy), { after: 0, align: AlignmentType.RIGHT })], { w: CWT - half, fill: BRAND.light })] })] }), spacer());
    }
    else if (b.t === "space") body.push(P(run(""), { after: Math.round((b.h || 4) * 40) }));
    else if (b.t === "pagebreak") body.push(new Paragraph({ children: [new PageBreak()] }));
  }
  const last = body[body.length - 1]; if (last && last.__spacer) body.pop();
  const header = new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWT }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: col(BRAND.light), space: 6 } }, children: [run(m.brand.name, "h", 10, BRAND.navy), run(`\t${m.docType}  ·  ${m.number || "DRAFT"}`, "r", 8.5, BRAND.neutral)] })] });
  const mkFooter = () => new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWT }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: col(BRAND.light), space: 6 } }, children: [run([m.brand.email, m.brand.phone, m.brand.portfolio].filter(Boolean).join("   ·   "), "r", 7.5, BRAND.neutral), new TextRun({ children: ["\tPage ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: "Inter", size: 15, color: col(BRAND.neutral) })] })] });
  const pageProps = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1500, bottom: 1300, left: 1134, right: 1134, header: 700, footer: 560 } } };
  const sections = [];
  if (coverChildren.length) sections.push({ properties: pageProps, footers: { default: mkFooter() }, children: coverChildren });
  if (m.noFirstHeader) sections.push({ properties: { ...pageProps, titlePage: true }, headers: { default: header, first: new Header({ children: [new Paragraph({ children: [] })] }) }, footers: { default: mkFooter(), first: mkFooter() }, children: body.length ? body : [P(run(""))] });
  else sections.push({ properties: pageProps, headers: { default: header }, footers: { default: mkFooter() }, children: body.length ? body : [P(run(""))] });
  const opts = { creator: m.brand.name, title: `${m.docType} ${m.number || ""}`.trim(), styles: { default: { document: { run: { font: "Inter", size: 20, color: col(BRAND.slate) } } } }, sections };
  if (embedFonts && fontData) {
    // docx needs Buffer to embed fonts. The browser gets it from the "buffer" package.
    if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;
    opts.fonts = [["Poppins SemiBold", "Poppins-SemiBold"], ["Poppins Medium", "Poppins-Medium"], ["Inter", "Inter-Regular"], ["Inter SemiBold", "Inter-SemiBold"]].map(([name, k]) => ({ name, data: Buffer.from(fontData[k]), characterSet: "00" }));
  }
  const doc = new Document(opts);
  return typeof Blob !== "undefined" ? Packer.toBlob(doc) : Packer.toBuffer(doc);
}
