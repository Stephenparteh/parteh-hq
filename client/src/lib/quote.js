import { DEFAULT_PRICES } from "../constants.js";

export const pricesOf = (settings) => (settings.prices && settings.prices.features ? settings.prices : DEFAULT_PRICES);

// Port of the prototype's quoteOf(). Rush is +25% of the subtotal, then the nonprofit discount is -15% of that.
export function quoteOf(calc, P) {
  const lines = [];
  const base = +P.base[calc.type] || 0;
  lines.push({ item: calc.type === "Website" || calc.type === "Website + branding" ? `${calc.type}: design & build (home page)` : `${calc.type}`, price: base });
  if (calc.type !== "Graphic design" && calc.pages > 1) lines.push({ item: `${calc.pages - 1} extra page${calc.pages > 2 ? "s" : ""}`, price: (calc.pages - 1) * (+P.page || 0) });
  P.features.forEach((f) => { if (calc.f[f.k]) lines.push({ item: f.n, price: +f.p || 0 }); });
  let sub = lines.reduce((s, l) => s + l.price, 0);
  if (calc.rush) { const r = Math.round(sub * 0.25); lines.push({ item: "Rush delivery (+25%)", price: r }); sub += r; }
  if (calc.nonprofit) { const d = -Math.round(sub * 0.15); lines.push({ item: "Church / nonprofit discount (−15%)", price: d }); sub += d; }
  return { lines, total: sub };
}
export const depositFor = (total, depositPct) => Math.ceil(total * (+depositPct || 0) / 100);
