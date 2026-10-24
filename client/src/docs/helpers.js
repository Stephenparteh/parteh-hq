// Shared by the engine and every template. No browser APIs here, so the sample script can run it in Node.
export const BRAND = { navy: "#0F172A", light: "#E2E8F0", neutral: "#848484", slate: "#475569", white: "#FFFFFF" };

export const money = (n) => ((+n || 0) < 0 ? "−$" : "$") + (Math.abs(Math.round((+n || 0) * 100) / 100)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// An empty or broken date gives "" and never throws.
export const longDate = (s) => { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T00:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); };
export const shortDate = (s) => { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T00:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
export const addDays = (s, n) => { const d = new Date(String(s || "").slice(0, 10) + "T00:00:00"); if (isNaN(d)) return ""; d.setDate(d.getDate() + (+n || 0)); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
export const r2 = (x) => Math.round((+x || 0) * 100) / 100;
export const lc = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export const joinList = (a) => (a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

// A document's top block: name and number on the left, doc name on the right.
export const head = (title, d, sub) => ({ t: "dochead", title, number: d.number || "Draft", sub: sub || d.projectName || "" });
export const meta = (docType, d, brand) => ({ docType, number: d.number, client: (d.org || "").trim() || "Client", brand, noFirstHeader: true });
