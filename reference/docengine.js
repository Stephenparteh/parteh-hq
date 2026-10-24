/* Stephen Parteh document engine: one document model -> A4 layout -> PDF (jsPDF), canvas preview, Word (.docx). */
(function (G) {
  "use strict";
  const BRAND = { navy: "#0F172A", light: "#E2E8F0", neutral: "#848484", slate: "#475569", white: "#FFFFFF" };
  const PT = 0.3528; // mm per pt
  const W = 210, H = 297, ML = 20, MR = 20, CW = W - ML - MR, TOP = 30, BOT = 270;
  // font keys -> [jsPDF family, jsPDF style, css family, css weight, word font]
  const FONTS = {
    h: ["Poppins", "semibold", "DocPoppins, Poppins, sans-serif", 600, "Poppins SemiBold"],
    m: ["Poppins", "medium", "DocPoppins, Poppins, sans-serif", 500, "Poppins Medium"],
    r: ["Inter", "regular", "DocInter, Inter, sans-serif", 400, "Inter"],
    b: ["Inter", "semibold", "DocInter, Inter, sans-serif", 600, "Inter SemiBold"],
  };
  const FONT_FILES = { "Poppins-SemiBold": "fonts/Poppins-SemiBold.ttf", "Poppins-Medium": "fonts/Poppins-Medium.ttf", "Inter-Regular": "fonts/Inter-Regular.ttf", "Inter-SemiBold": "fonts/Inter-SemiBold.ttf" };
  let fontData = null;

  async function loadFonts() {
    if (fontData) return fontData;
    const out = {};
    await Promise.all(Object.entries(FONT_FILES).map(async ([k, u]) => {
      const r = await fetch(u);
      if (!r.ok) throw new Error("Could not load font " + k);
      out[k] = await r.arrayBuffer();
    }));
    fontData = out;
    if (typeof FontFace !== "undefined" && typeof document !== "undefined") {
      try {
        const faces = [["DocPoppins", "Poppins-SemiBold", "600"], ["DocPoppins", "Poppins-Medium", "500"], ["DocInter", "Inter-Regular", "400"], ["DocInter", "Inter-SemiBold", "600"]];
        await Promise.all(faces.map(async ([fam, k, wt]) => { const f = new FontFace(fam, out[k].slice(0), { weight: wt }); await f.load(); document.fonts.add(f); }));
      } catch (e) { /* preview falls back to Google Fonts faces */ }
    }
    return out;
  }
  function setFontData(d) { fontData = d; }
  function b64(buf) {
    let s = ""; const b = new Uint8Array(buf);
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function makePdf() {
    const { jsPDF } = G.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    for (const [k, buf] of Object.entries(fontData)) {
      const [fam, st] = k.split("-");
      pdf.addFileToVFS(k + ".ttf", b64(buf));
      pdf.addFont(k + ".ttf", fam, st.toLowerCase());
    }
    return pdf;
  }

  // the PDF fonts have no emoji: drop them so the preview matches the PDF
  const clean = (s) => String(s ?? "").replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu, "").replace(/ {2,}/g, " ");
  /* ---------------- layout ---------------- */
  function layout(model, pdf) {
    const pages = []; let ops, y;
    const setF = (f, size) => { pdf.setFont(FONTS[f][0], FONTS[f][1]); pdf.setFontSize(size); };
    const tw = (s, f, size, cs = 0) => { setF(f, size); return pdf.getTextWidth(String(s)) + (cs ? cs * Math.max(0, String(s).length - 1) : 0); };
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
        ensure(b.keep || 46);
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
        const totH = b.rows.reduce((h, [k, v]) => h + wrap(v || "—", "r", 10, CW - lw - 2).length * lineH(10, 1.45) + 4, 0);
        if (totH < 60) ensure(totH);
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
        const ws = cols.map(c => c.w / total * CW), xs = ws.map((_, i) => ML + ws.slice(0, i).reduce((a, v) => a + v, 0));
        const pad = 2.5, Lh = lineH(9.5, 1.45);
        const head = () => {
          ensure(9 + Lh); R(ML, y, CW, 8.5, BRAND.light);
          cols.forEach((c, i) => T(c.align === "right" ? xs[i] + ws[i] - pad : xs[i] + pad, y + 5.6, c.h.toUpperCase(), "b", 7.5, BRAND.navy, c.align, 0.4));
          y += 8.5;
        };
        head();
        for (const row of b.rows) {
          const cells = row.map((v, i) => wrap(v ?? "", i === 0 && b.firstBold ? "b" : "r", 9.5, ws[i] - pad * 2));
          const h = Math.max(...cells.map(c => c.length)) * Lh + 4;
          if (y + h > BOT) { newPage(false); head(); }
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
        b.left.lines.forEach((ln, i) => { const f = i === 0 ? "m" : "r", sz = i === 0 ? 12 : 9.5; wrap(ln, f, sz, colW).forEach(w => { T(ML, ly, w, f, sz, i === 0 ? BRAND.navy : BRAND.slate); ly += i === 0 ? 6 : 4.8; }); if (i === 0) ly += 0.5; });
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
  function hex(c) { const v = c.replace("#", ""); return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]; }
  function toPdf(model) {
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
  function preview(model, container, cssWidth) {
    const pdf = makePdf(), pages = layout(model, pdf);
    container.innerHTML = "";
    const dpr = Math.min(2, (G.devicePixelRatio || 1)), cw = Math.max(260, cssWidth || container.clientWidth || 600), scale = cw / W * dpr;
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

  async function toDocx(model) {
    const D = G.docx;
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
          rows.push(new TableRow({ children: [0, 1].map(j => { const f = facts[i + j]; return cell(f ? [P(run(f[0].toUpperCase(), "b", 7.5, BRAND.neutral, { characterSpacing: 12 }), { after: 40 }), P(run(f[1], "r", 10.5, BRAND.navy), { after: 120 })] : [P(run(""))], { w: CWT / 2, padL: 0 }); }) }));
        }
        if (rows.length) target.push(new Table({ rows, width: { size: CWT, type: WidthType.DXA }, columnWidths: [CWT / 2, CWT / 2], borders: { ...noBorders, top: thin } }));
        target = body; continue;
      }
      if (b.t === "h") body.push(P([...(b.n != null ? [run(String(b.n).padStart(2, "0") + "   ", "m", 11, BRAND.neutral)] : []), run(b.text, "h", 13.5, BRAND.navy)], { before: 360, after: 140, keepNext: true, extra: { border: { top: { style: BorderStyle.SINGLE, size: 4, color: col(BRAND.light), space: 10 } } } }));
      else if (b.t === "sub") body.push(P(run(b.text, "b", 10, BRAND.navy), { before: 120, after: 60, keepNext: true }));
      else if (b.t === "p") String(b.text).split("\n").forEach(t => body.push(P(run(t, b.f || "r", b.size || 10, b.c))));
      else if (b.t === "bullets") b.items.forEach(it => body.push(new Paragraph({ children: [run(it)], bullet: { level: 0 }, spacing: { after: 60, line: 290 } })));
      else if (b.t === "kv") body.push(new Table({ width: { size: CWT, type: WidthType.DXA }, columnWidths: [2600, CWT - 2600], borders: noBorders, rows: b.rows.map(([k, v]) => new TableRow({ children: [cell([P(run(k, "b", 9, BRAND.neutral), { after: 0 })], { w: 2600, bottom: true, padL: 0 }), cell(String(v || "—").split("\n").map(t => P(run(t, "r", 10, BRAND.navy), { after: 0 })), { w: CWT - 2600, bottom: true })] })) }), spacer());
      else if (b.t === "table") {
        const tot = b.cols.reduce((s, c) => s + c.w, 0), ws = b.cols.map(c => Math.round(c.w / tot * CWT));
        const al = (c) => c.align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT;
        const rows = [new TableRow({ tableHeader: true, children: b.cols.map((c, i) => cell([P(run(c.h.toUpperCase(), "b", 7.5, BRAND.navy, { characterSpacing: 8 }), { after: 0, align: al(c) })], { w: ws[i], fill: BRAND.light })) })];
        b.rows.forEach(r => rows.push(new TableRow({ cantSplit: true, children: r.map((v, i) => cell([P(run(v, i === 0 && b.firstBold ? "b" : "r", 9.5, i === 0 ? BRAND.navy : BRAND.slate), { after: 0, align: al(b.cols[i]) })], { w: ws[i], bottom: true })) })));
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
              P(run("______________________________", "r", 10, BRAND.slate), { after: 0 }), P(run("Date", "r", 8, BRAND.neutral), { after: 0 })], { w: i ? CWT - half : half, padL: 0 }))
          })]
        }));
      }
      else if (b.t === "dochead") {
        const half = Math.round(CWT / 2), R_ = AlignmentType.RIGHT;
        const left = [P(run(m.brand.name, "h", 18, BRAND.navy), { after: 20 }), P(run([m.brand.title, m.brand.tagline].filter(Boolean).join("  ·  "), "r", 9, BRAND.neutral), { after: 80 }),
          ...[m.brand.email, m.brand.phone, m.brand.portfolio].filter(Boolean).map(s => P(run(s, "r", 8.5), { after: 0, line: 260 }))];
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
    const spacerTail = () => { const last = body[body.length - 1]; if (last && last.__spacer) body.pop(); };
    spacerTail();
    const header = new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWT }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: col(BRAND.light), space: 6 } }, children: [run(m.brand.name, "h", 10, BRAND.navy), run(`\t${m.docType}  ·  ${m.number || "DRAFT"}`, "r", 8.5, BRAND.neutral)] })] });
    const mkFooter = () => new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWT }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: col(BRAND.light), space: 6 } }, children: [run([m.brand.email, m.brand.phone, m.brand.portfolio].filter(Boolean).join("   ·   "), "r", 7.5, BRAND.neutral), new TextRun({ children: ["\tPage ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: "Inter", size: 15, color: col(BRAND.neutral) })] })] });
    const pageProps = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1500, bottom: 1300, left: 1134, right: 1134, header: 700, footer: 560 } } };
    const sections = [];
    if (coverChildren.length) sections.push({ properties: pageProps, footers: { default: mkFooter() }, children: coverChildren });
    if (m.noFirstHeader) sections.push({ properties: { ...pageProps, titlePage: true }, headers: { default: header, first: new Header({ children: [new Paragraph({ children: [] })] }) }, footers: { default: mkFooter(), first: mkFooter() }, children: body.length ? body : [P(run(""))] });
    else sections.push({ properties: pageProps, headers: { default: header }, footers: { default: mkFooter() }, children: body.length ? body : [P(run(""))] });
    const opts = { creator: m.brand.name, title: `${m.docType} ${m.number || ""}`.trim(), styles: { default: { document: { run: { font: "Inter", size: 20, color: col(BRAND.slate) } } } }, sections };
    if (typeof Buffer !== "undefined" && fontData) {
      opts.fonts = [["Poppins SemiBold", "Poppins-SemiBold"], ["Poppins Medium", "Poppins-Medium"], ["Inter", "Inter-Regular"], ["Inter SemiBold", "Inter-SemiBold"]].map(([name, k]) => ({ name, data: Buffer.from(fontData[k]), characterSet: "00" }));
    }
    const doc = new Document(opts);
    return Packer.toBlob ? (typeof Blob !== "undefined" ? Packer.toBlob(doc) : Packer.toBuffer(doc)) : Packer.toBuffer(doc);
  }

  /* ---------------- helpers shared by templates ---------------- */
  const money = (n) => ((+n || 0) < 0 ? "−$" : "$") + (Math.abs(Math.round((+n || 0) * 100) / 100)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const longDate = (s) => { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T00:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); };
  const addDays = (s, n) => { const d = new Date(String(s || "").slice(0, 10) + "T00:00:00"); if (isNaN(d)) return ""; d.setDate(d.getDate() + (+n || 0)); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const lc = (s) => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  const joinList = (a) => a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

  /* ---------------- PROPOSAL template ---------------- */
  const P_GOALS = [
    ["credibility", "Build trust and credibility online"], ["info", "Share clear information about who they are and what they do"],
    ["contact", "Make it easy for people to get in touch"], ["leads", "Get more inquiries and new customers"],
    ["donations", "Accept donations and support online"], ["events", "Promote events and keep people updated"],
    ["media", "Share sermons, music or videos"], ["portfolio", "Showcase their work and past projects"],
    ["sell", "Sell products or services online"], ["members", "Keep members and the community connected"]];
  const P_PAGES = [
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
  const P_FEATURES = [
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
  const P_DESIGN = ["Modern and minimal", "Bold and vibrant", "Elegant and classic", "Warm and welcoming", "Based on the client's existing brand"];
  const P_DOMAIN = {
    register: "I will register the domain name in the client's name. The client owns the domain.",
    client: "The client already owns a domain. I will connect it to the new website.",
    help: "The client will buy the domain. I will guide them through the purchase and connect it to the website.",
    none: "" };
  const P_HOSTING = {
    included: "Hosting for the first year is included in this project. From the second year, renewal fees are paid by the client.",
    client: "The client will pay the hosting provider directly. I will set up the hosting account and put the website online.",
    free: "The website will run on a free hosting plan, which suits a small website. A paid plan may be needed later as the website grows.",
    none: "" };
  const P_EMAIL = {
    none: "Business email is not included in this proposal.",
    setup: "I will set up a business email address (for example info@yourdomain). Email service fees, if any, are paid by the client.",
    addon: "Business email setup is available as an optional add-on and can be quoted separately." };
  const P_PLANS = {
    "50-50": [["Deposit to start", "Before work begins", 50], ["Final payment", "On launch, before handover", 50]],
    "30-40-30": [["Deposit to start", "Before work begins", 30], ["Design approval", "When the design is approved", 40], ["Final payment", "On launch, before handover", 30]],
    "deposit": null, // uses depositPct
    "full": [["Full payment", "Before work begins", 100]] };
  const P_START = ["Within 2 days after the deposit is received", "Within 1 week after the deposit is received", "On a date agreed with the client"];

  function proposalTimeline(d) {
    const weeks = Math.max(1, +d.weeks || 4), days = weeks * 7, hasBack = (d.features || []).some(k => ["admin", "blog", "events", "giving", "contact", "newsletter"].includes(k));
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
  function proposalSchedule(d, total) {
    let plan = P_PLANS[d.plan];
    if (!plan) { const dp = Math.min(100, Math.max(0, +d.depositPct || 0)); plan = dp >= 100 ? [["Full payment", "Before work begins", 100]] : [["Deposit to start", "Before work begins", dp], ["Final payment", "On launch, before handover", 100 - dp]]; }
    let used = 0;
    return plan.filter(p => p[2] > 0).map((p, i, arr) => { const amt = i === arr.length - 1 ? Math.round((total - used) * 100) / 100 : Math.round(total * p[2]) / 100; used += amt; return [p[0], p[1], `${p[2]}%`, money(amt)]; });
  }
  function buildProposal(d, brand) {
    const org = (d.org || "").trim() || "the client", sec = d.sections || {};
    const fill = (s) => String(s).replaceAll("{org}", org);
    const goals = P_GOALS.filter(g => (d.goals || []).includes(g[0])).map(g => g[1]);
    const pages = (d.pages || []).filter(p => p.name);
    const feats = P_FEATURES.filter(f => (d.features || []).includes(f[0])).map(f => f[1]).concat((d.extraFeatures || []).filter(Boolean));
    const items = (d.items || []).filter(l => String(l.item || "").trim() || +l.price);
    const total = items.reduce((s, l) => s + (+l.price || 0), 0);
    const blocks = []; let n = 0; const H2 = (t) => blocks.push({ t: "h", n: ++n, text: t });
    const validUntil = addDays(d.date, d.validDays || 14);
    blocks.push({ t: "cover", eyebrow: "Proposal", title: d.title || "Website Design & Development Proposal", client: org, contact: [d.contactName, d.contactRole].filter(Boolean).join(", "),
      facts: [["Proposal no.", d.number || "Draft"], ["Date", longDate(d.date)], ["Valid until", longDate(validUntil)], ["Prepared by", `${brand.name}, ${brand.title}`]] });

    H2("Client details");
    blocks.push({ t: "kv", rows: [["Organization", org], ["Contact person", [d.contactName, d.contactRole].filter(Boolean).join(", ")], ["Type", d.industry], ["Phone / WhatsApp", d.phone], ["Email", d.email]].filter(r => r[1]) });

    H2("Project overview");
    blocks.push({ t: "p", text: `${org} would like a new ${lc(d.siteType || "website")}${goals.length ? ` that helps them ${joinList(goals.map(lc))}` : ""}. This proposal explains what I will build, how long it will take and what it will cost.` });
    if ((d.goalNote || "").trim()) blocks.push({ t: "note", text: `In the client's words: “${d.goalNote.trim()}”` });
    if (goals.length) { blocks.push({ t: "sub", text: "Project goals" }); blocks.push({ t: "bullets", items: goals }); }

    H2("Proposed solution");
    blocks.push({ t: "p", text: `I will design and build a modern, mobile-friendly ${lc(d.siteType || "website")} for ${org} with ${pages.length} page${pages.length === 1 ? "" : "s"}. The website will be easy to use on phones, tablets and computers, quick to load, and simple for visitors to find what they need.${(d.solutionNote || "").trim() ? " " + d.solutionNote.trim() : ""}` });

    if (pages.length) { H2("Website pages"); blocks.push({ t: "table", cols: [{ h: "Page", w: 30 }, { h: "Purpose", w: 70 }], rows: pages.map(p => [p.name, fill(p.purpose || "")]), firstBold: true }); }
    if (feats.length) { H2("Features included"); blocks.push({ t: "bullets", items: feats }); blocks.push({ t: "p", text: "Anything not listed in this proposal is not included, and can be quoted separately.", size: 9, c: BRAND.neutral }); }

    if (sec.design !== false) {
      H2("Design direction");
      blocks.push({ t: "p", text: `I will design the website to reflect the identity of ${org}. The look will be ${lc(d.style || P_DESIGN[0])}, with clean layouts, easy-to-read text and clear buttons that guide visitors.${(d.colors || "").trim() ? ` The colors will be based on ${d.colors.trim()}.` : ""} The design will be shared with the client for review before development starts.` });
      if ((d.references || "").trim()) blocks.push({ t: "kv", rows: [["Design references", d.references.trim()]] });
    }
    if (sec.domain !== false) {
      const rows = [];
      if (P_DOMAIN[d.domain]) rows.push(["Domain", P_DOMAIN[d.domain] + ((d.domainName || "").trim() ? ` Preferred domain: ${d.domainName.trim()} (if available).` : "")]);
      if (P_HOSTING[d.hosting]) rows.push(["Hosting", P_HOSTING[d.hosting]]);
      if (P_EMAIL[d.bizEmail]) rows.push(["Business email", P_EMAIL[d.bizEmail]]);
      if (rows.length) { H2("Domain, hosting and email"); blocks.push({ t: "kv", rows }); }
    }
    if (sec.timeline !== false) {
      H2("Estimated timeline");
      blocks.push({ t: "p", text: `The project will take about ${d.weeks || 4} week${+d.weeks === 1 ? "" : "s"}. ${d.start || P_START[0]}.` });
      blocks.push({ t: "table", cols: [{ h: "When", w: 22 }, { h: "Stage", w: 30 }, { h: "What happens", w: 48 }], rows: proposalTimeline(d), firstBold: true });
      blocks.push({ t: "p", text: `To keep the project on time, the client agrees to send content within the first week and review feedback within ${d.reviewDays || 3} days of each review request. Delays in content or feedback will move the timeline.`, size: 9.5 });
    }
    if (sec.support !== false) {
      H2("Revisions and support");
      const sup = [`${d.revisions || 2} rounds of revisions on the design and ${d.revisions || 2} on the finished website.`, `${d.supportDays || 30} days of free support after launch to fix any bugs or errors in the work delivered.`, "New pages or new features after approval are quoted separately."];
      if (d.maintenance === "offer" && +d.maintenancePrice > 0) sup.push(`Optional monthly maintenance plan: ${money(d.maintenancePrice)} per month for updates, backups, small content changes and technical support.`);
      blocks.push({ t: "bullets", items: sup });
    }

    H2("Investment");
    blocks.push({ t: "table", cols: [{ h: "Item", w: 75 }, { h: "Amount (USD)", w: 25, align: "right" }], rows: items.map(l => [l.item || "Item", money(l.price)]), foot: [["Total", money(total), true]] });
    if (total > 0) {
      blocks.push({ t: "sub", text: "Payment schedule" });
      blocks.push({ t: "table", cols: [{ h: "Payment", w: 30 }, { h: "When", w: 38 }, { h: "Share", w: 12, align: "right" }, { h: "Amount", w: 20, align: "right" }], rows: proposalSchedule(d, total) });
    }
    blocks.push({ t: "p", text: `All prices are in US dollars (USD). Work starts once the first payment is received.${brand.payInfo ? ` Payment methods: ${brand.payInfo}.` : ""}`, size: 9.5 });

    H2("Next steps");
    blocks.push({ t: "bullets", items: ["Review this proposal and tell me if you would like any changes.", "Approve it by replying “Approved” on WhatsApp or email, or by signing below.", "I will send the service agreement and the first invoice.", "Work starts as soon as the first payment is received."] });
    blocks.push({ t: "p", text: `This proposal is valid until ${longDate(validUntil)}.`, size: 9.5, c: BRAND.neutral });
    blocks.push({ t: "sign", parties: [{ label: "Approved by the client", name: [d.contactName, org !== "the client" ? org : ""].filter(Boolean).join(", ") }, { label: "Prepared by", name: `${brand.name}, ${brand.title}` }] });

    if (sec.about !== false) {
      H2(`About ${brand.name}`);
      blocks.push({ t: "p", text: brand.about || `I'm ${brand.name}, a web developer who designs and builds modern, mobile-friendly websites for businesses, churches and organizations.` });
      blocks.push({ t: "kv", rows: [["Email", brand.email], ["Phone / WhatsApp", brand.phone], ["Portfolio", brand.portfolio]].filter(r => r[1]) });
    }
    return { meta: { docType: "Proposal", number: d.number, client: org, brand }, blocks, total };
  }
  function checkProposal(d) {
    const w = [];
    if (!(d.org || "").trim()) w.push("Add the client's organization name.");
    if (!(d.contactName || "").trim()) w.push("Add the contact person's name.");
    if (!(d.pages || []).filter(p => p.name).length) w.push("Choose at least one page.");
    const items = (d.items || []).filter(l => +l.price > 0);
    if (!items.length) w.push("Add at least one price item in Investment.");
    if (!(d.goals || []).length) w.push("Pick at least one project goal.");
    return w;
  }

  /* ---------------- INVOICE template ---------------- */
  const r2 = (x) => Math.round((+x || 0) * 100) / 100;
  const qtyFmt = (q) => { const n = +q || 0; return Number.isInteger(n) ? String(n) : n.toFixed(2); };
  const INV_KINDS = { deposit: "Deposit invoice", milestone: "Milestone invoice", final: "Final invoice", additional: "Additional work", maintenance: "Maintenance invoice" };
  const INV_NOTES = [
    ["ref", "Please use the invoice number as your payment reference."],
    ["start", "Work starts once the deposit is received."],
    ["next", "The next stage of work continues once this payment is received."],
    ["handover", "The website will be handed over once this invoice is paid in full."],
    ["thanks", "Thank you for your business!"]];
  function invoiceTotals(d) {
    const lines = (d.items || []).filter(l => String(l.desc || "").trim() || +l.rate);
    const sub = r2(lines.reduce((s, l) => s + r2((+l.qty || 0) * (+l.rate || 0)), 0));
    const disc = d.discType === "percent" ? r2(sub * (+d.discValue || 0) / 100) : d.discType === "amount" ? r2(Math.min(sub, +d.discValue || 0)) : 0;
    const taxable = r2(sub - disc), tax = d.taxOn ? r2(taxable * (+d.taxPct || 0) / 100) : 0;
    const total = r2(taxable + tax), paid = r2(Math.max(0, +d.paidBefore || 0));
    return { lines, sub, disc, tax, total, paid, due: r2(total - paid) };
  }
  function buildInvoice(d, brand) {
    const t = invoiceTotals(d), org = (d.org || "").trim() || "Client";
    const dueDate = +d.dueDays ? longDate(addDays(d.date, d.dueDays)) : "Due on receipt";
    const blocks = [];
    blocks.push({ t: "dochead", title: "Invoice", number: d.number || "Draft", sub: INV_KINDS[d.kind] || "" });
    blocks.push({ t: "parties", left: { label: "Bill to", lines: [org, d.contactName, d.phone, d.email, d.address].filter(Boolean) },
      right: { label: "Invoice details", rows: [["Invoice no.", d.number || "Draft"], ["Issue date", longDate(d.date)], ["Due date", dueDate], ["Project", d.projectName]].filter(r => r[1]) } });
    const foot = [["Subtotal", money(t.sub)]];
    if (t.disc) foot.push([d.discType === "percent" ? `Discount (${+d.discValue}%)` : "Discount", money(-t.disc)]);
    if (t.tax) foot.push([`${(d.taxLabel || "Tax").trim()} (${+d.taxPct}%)`, money(t.tax)]);
    if (t.paid) { foot.push(["Total", money(t.total)]); foot.push(["Already paid", money(-t.paid)]); }
    foot.push(["Amount due (USD)", money(t.due), true]);
    blocks.push({ t: "table", cols: [{ h: "Description", w: 52 }, { h: "Qty", w: 9, align: "right" }, { h: "Rate", w: 19, align: "right" }, { h: "Amount", w: 20, align: "right" }],
      rows: t.lines.map(l => [l.desc || "Item", qtyFmt(l.qty), money(l.rate), money(r2((+l.qty || 0) * (+l.rate || 0)))]), foot });
    if (d.showSummary && +d.projectTotal > 0) {
      const before = r2(+d.projectPaid || 0), after = r2(+d.projectTotal - before - t.due);
      blocks.push({ t: "sub", text: "Project summary" });
      blocks.push({ t: "kv", rows: [["Project total", money(d.projectTotal)], ["Paid before this invoice", money(before)], ["This invoice", money(t.due)], ["Balance after this invoice", money(Math.max(0, after))]] });
    }
    if (brand.payInfo) { blocks.push({ t: "sub", text: "How to pay" }); blocks.push({ t: "note", text: brand.payInfo }); }
    const notes = INV_NOTES.filter(n => (d.notes || []).includes(n[0])).map(n => n[1]);
    if ((d.customNote || "").trim()) notes.push(d.customNote.trim());
    if (notes.length) { blocks.push({ t: "sub", text: "Notes" }); blocks.push({ t: "bullets", items: notes }); }
    blocks.push({ t: "p", text: "All amounts are in US dollars (USD).", size: 8.5, c: BRAND.neutral });
    return { meta: { docType: "Invoice", number: d.number, client: org, brand, noFirstHeader: true }, blocks, total: t.due };
  }
  function checkInvoice(d, brand) {
    const w = [], t = invoiceTotals(d);
    if (!(d.org || "").trim()) w.push("Add who the invoice is for (Bill to).");
    if (!t.lines.length || t.sub <= 0) w.push("Add at least one item with a price.");
    if (t.lines.some(l => !(String(l.desc || "").trim()))) w.push("One of the items has no description.");
    if (t.due < 0) w.push("“Already paid” is more than the total.");
    if (t.sub > 0 && t.disc >= t.sub) w.push("The discount covers the whole amount. Check the discount.");
    else if (t.lines.length && t.due === 0 && t.paid === 0) w.push("The amount due is $0.00.");
    if (d.taxOn && !(+d.taxPct > 0)) w.push("Tax is on but has no percentage. Turn it off or add the rate.");
    if (!(brand && brand.payInfo)) w.push("Add how clients pay you in Settings, so the invoice shows payment instructions.");
    return w;
  }

  /* ---------------- RECEIPT template ---------------- */
  const RC_TYPES = { deposit: "Deposit payment", partial: "Partial payment", full: "Full payment" };
  function buildReceipt(d, brand) {
    const org = (d.org || "").trim() || "Client", amt = r2(d.amount);
    const blocks = [];
    blocks.push({ t: "dochead", title: "Receipt", number: d.number || "Draft", sub: "Payment received" });
    blocks.push({ t: "parties", left: { label: "Received from", lines: [org, d.contactName, d.phone].filter(Boolean) },
      right: { label: "Receipt details", rows: [["Receipt no.", d.number || "Draft"], ["Payment date", longDate(d.date)], ["Payment method", d.method], ["Reference", d.txRef], ["For invoice", d.invoiceNo], ["Project", d.projectName]].filter(r => r[1]) } });
    blocks.push({ t: "amountbox", label: "Amount received", sub: RC_TYPES[d.payType] || "", amount: money(amt) });
    blocks.push({ t: "table", cols: [{ h: "Description", w: 75 }, { h: "Amount", w: 25, align: "right" }], rows: [[d.description || "Payment", money(amt)]] });
    if (+d.projectTotal > 0) {
      const paid = r2(d.paidToDate), bal = r2(Math.max(0, +d.projectTotal - paid));
      blocks.push({ t: "sub", text: "Project balance" });
      blocks.push({ t: "kv", rows: [["Project total", money(d.projectTotal)], ["Total paid to date", money(paid)], ["Balance remaining", bal > 0 ? money(bal) : "Paid in full"]] });
    }
    blocks.push({ t: "p", text: `This receipt confirms that ${brand.name} received ${money(amt)} from ${org} on ${longDate(d.date)}${d.method ? ` by ${d.method}` : ""}. Thank you for your payment.` });
    blocks.push({ t: "kv", rows: [["Received by", `${brand.name}, ${brand.title}`]] });
    blocks.push({ t: "p", text: "All amounts are in US dollars (USD).", size: 8.5, c: BRAND.neutral });
    return { meta: { docType: "Receipt", number: d.number, client: org, brand, noFirstHeader: true }, blocks, total: amt };
  }
  function checkReceipt(d) {
    const w = [];
    if (!d.confirmed) w.push("Tick “I confirm I have received this money” before creating the receipt.");
    if (!(+d.amount > 0)) w.push("Add the amount received.");
    if (!(d.org || "").trim()) w.push("Add who paid (Received from).");
    if (!d.method) w.push("Choose the payment method.");
    if (!d.date) w.push("Add the payment date.");
    return w;
  }

  G.DocEngine = { BRAND, loadFonts, setFontData, layout, makePdf, toPdf, preview, toDocx, money, longDate, addDays, r2,
    invoice: { KINDS: INV_KINDS, NOTES: INV_NOTES, totals: invoiceTotals, build: buildInvoice, check: checkInvoice },
    receipt: { TYPES: RC_TYPES, build: buildReceipt, check: checkReceipt },
    proposal: { GOALS: P_GOALS, PAGES: P_PAGES, FEATURES: P_FEATURES, DESIGN: P_DESIGN, DOMAIN: P_DOMAIN, HOSTING: P_HOSTING, EMAIL: P_EMAIL, PLANS: P_PLANS, START: P_START, build: buildProposal, check: checkProposal, schedule: proposalSchedule } };
})(typeof window !== "undefined" ? window : globalThis);
