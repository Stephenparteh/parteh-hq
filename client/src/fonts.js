// Poppins and Inter files from /fonts. Used by the thank-you card now and by the PDF engine later.
export const FONT_FILES = {
  "Poppins-SemiBold": "/fonts/Poppins-SemiBold.ttf",
  "Poppins-Medium": "/fonts/Poppins-Medium.ttf",
  "Inter-Regular": "/fonts/Inter-Regular.ttf",
  "Inter-SemiBold": "/fonts/Inter-SemiBold.ttf",
};
let fontData = null;

export async function loadDocFonts() {
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
    } catch { /* the preview falls back to Google Fonts faces */ }
  }
  return out;
}
