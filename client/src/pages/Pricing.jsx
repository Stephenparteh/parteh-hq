import { useEffect, useRef, useState } from "react";
import { LAST } from "../constants.js";
import { useData } from "../context/Data.jsx";
import { useCopy } from "../context/Pop.jsx";
import { useToast } from "../context/Toast.jsx";
import { useSheet } from "../components/ProjectSheet.jsx";
import { liveProjects, money } from "../lib/format.js";
import { pricesOf, quoteOf, depositFor } from "../lib/quote.js";
import { quoteText } from "../lib/messages.js";

export default function Pricing() {
  const { projects, settings, saveSettings } = useData();
  const { openSheet } = useSheet();
  const copy = useCopy();
  const toast = useToast();
  const [calc, setCalc] = useState({ type: "Website", pages: 5, f: { contact: true, whatsapp: true, gallery: true, seo: true }, nonprofit: false, rush: false, target: "" });
  const [P, setP] = useState(() => JSON.parse(JSON.stringify(pricesOf(settings))));
  const saveTimer = useRef();
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // Edited prices show at once and are saved to settings a moment later.
  const editPrices = (fn) => {
    const next = JSON.parse(JSON.stringify(P)); fn(next); setP(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSettings({ prices: next }, true).catch(() => {}), 800);
  };

  const q = quoteOf(calc, P), dep = depositFor(q.total, settings.depositPct);
  const targets = liveProjects(projects).filter((p) => p.phase < LAST);
  const apply = () => {
    const p = projects.find((x) => x.id === calc.target);
    if (!p) { toast("Choose a project first"); return; }
    openSheet(p, "money", { scope: q.lines.map((l) => ({ item: l.item, price: l.price })), price: q.total });
    toast("Quote applied. Tap Save to keep it.");
  };

  return (
    <div className="list">
      <div className="calc">
        <div className="sec-head"><h2>Price calculator</h2><span className="note">Prices in USD · tap a price to change it</span></div>
        <div className="grid2">
          <label>Project type
            <select value={calc.type} onChange={(e) => setCalc({ ...calc, type: e.target.value })}>{Object.keys(P.base).map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label>Starting price for this type
            <input type="number" min="0" inputMode="decimal" value={P.base[calc.type] ?? 0} onChange={(e) => editPrices((n) => { n.base[calc.type] = e.target.value === "" ? "" : +e.target.value; })} />
          </label>
        </div>
        {calc.type !== "Graphic design" && (
          <div className="grid2">
            <label>Number of pages
              <div className="stepper">
                <button type="button" aria-label="Fewer pages" onClick={() => setCalc({ ...calc, pages: Math.max(1, calc.pages - 1) })}>−</button>
                <b className="num" style={{ fontSize: 20 }}>{calc.pages}</b>
                <button type="button" aria-label="More pages" onClick={() => setCalc({ ...calc, pages: Math.min(30, calc.pages + 1) })}>+</button>
              </div>
            </label>
            <label>Each extra page
              <input type="number" min="0" inputMode="decimal" value={P.page ?? 0} onChange={(e) => editPrices((n) => { n.page = e.target.value === "" ? "" : +e.target.value; })} />
            </label>
          </div>
        )}
        <div>
          {P.features.map((f) => (
            <div className="feat" key={f.k}>
              <input type="checkbox" id={`cf-${f.k}`} checked={!!calc.f[f.k]} onChange={(e) => setCalc({ ...calc, f: { ...calc.f, [f.k]: e.target.checked } })} />
              <label htmlFor={`cf-${f.k}`} style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{f.n}</label>
              <input type="number" min="0" inputMode="decimal" value={f.p ?? 0} aria-label={`${f.n} price`} onChange={(e) => editPrices((n) => { n.features.find((x) => x.k === f.k).p = e.target.value === "" ? "" : +e.target.value; })} />
            </div>
          ))}
        </div>
        <div className="row">
          <label className="inline-check"><input type="checkbox" checked={calc.nonprofit} onChange={(e) => setCalc({ ...calc, nonprofit: e.target.checked })} /> Church / nonprofit discount</label>
          <label className="inline-check"><input type="checkbox" checked={calc.rush} onChange={(e) => setCalc({ ...calc, rush: e.target.checked })} /> Rush job</label>
        </div>
      </div>
      <div className="quote" aria-label="Quote">
        <span className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>Suggested price</span>
        <div className="big num" data-testid="quote-total">{money(q.total)}</div>
        <small style={{ opacity: 0.8 }}>Deposit to start ({settings.depositPct}%): <span className="num" data-testid="quote-deposit">{money(dep)}</span></small>
        <ul>{q.lines.map((l, i) => <li key={i}>{l.item} · {money(l.price)}</li>)}</ul>
      </div>
      <div className="calc">
        <h2>Use this quote</h2>
        <div className="row"><button className="btn ghost" onClick={() => copy(quoteText(q, settings), "Quote")}>Copy quote for WhatsApp</button></div>
        {targets.length ? (
          <>
            <label>Apply to a project
              <select value={calc.target} onChange={(e) => setCalc({ ...calc, target: e.target.value })}>
                <option value="">Choose a project…</option>{targets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="row"><button className="btn" onClick={apply}>Apply price &amp; scope</button></div>
          </>
        ) : <p className="note">Add a project first to apply this quote to it.</p>}
      </div>
    </div>
  );
}
