import { PHASES, STAGES, LAST } from "../constants.js";
import { stageOf, waitDays, paidOf, totalOf, money, fmtDate } from "../lib/format.js";
import { useData } from "../context/Data.jsx";
import { useKit } from "../docs/useKit.js";

// Badges for this project's documents: proposal status, agreement status, and money still owed.
function DocBadges({ pid }) {
  const { docs } = useData();
  const kit = useKit();
  const ds = docs.filter((x) => x.projectId === pid).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  if (!ds.length) return null;
  const out = [];
  const prop = ds.find((x) => x.type === "proposal"); if (prop) { const [s, c] = kit.stateOf(prop); out.push(<span key="p" className={`chip ${c}`}>Proposal: {s}</span>); }
  const ag = ds.find((x) => x.type === "agreement"); if (ag) out.push(<span key="a" className={`chip ${ag.status === "Signed" ? "" : "plain"}`}>Agreement: {ag.status || "Draft"}</span>);
  const owed = ds.filter((x) => x.type === "invoice" && x.status === "Sent").reduce((s, x) => s + kit.owedOn(x), 0);
  if (owed > 0) { const late = ds.some((x) => x.type === "invoice" && kit.invoiceState(x)[0] === "Overdue"); out.push(<span key="o" className={`chip ${late ? "wait" : "gold"}`}>{money(owed)} {late ? "overdue" : "owed"}</span>); }
  return out.length ? <div className="dbadges">{out}</div> : null;
}

export default function ProjectCard({ p, onOpen }) {
  const ph = p.phase || 0, st = stageOf(p), si = STAGES.findIndex((s) => s[0] === st), w = waitDays(p);
  const segs = STAGES.map(([k, n], i) => {
    const idx = PHASES.map((x, j) => (x[0] === k ? j : -1)).filter((j) => j >= 0);
    const pct = ph === LAST ? 100 : i < si ? 100 : i > si ? 0 : Math.round((idx.filter((j) => j < ph).length + 0.5) / idx.length * 100);
    return <div key={k} className={`seg ${i === si ? "on" : ""}`}><div className="track"><i style={{ width: `${pct}%` }} /></div><span>{n}</span></div>;
  });
  const chips = [];
  if (p.status === "lost") chips.push(<span key="s" className="chip plain">Lost</span>);
  else if (p.status === "paused") chips.push(<span key="s" className="chip plain">Paused</span>);
  else if (ph === LAST) chips.push(<span key="s" className="chip">Launched</span>);
  else if (w >= 3) chips.push(<span key="s" className="chip wait">Follow up · {w}d</span>);
  else if (p.waitingOn === "client") chips.push(<span key="s" className="chip plain">Waiting on client</span>);
  else chips.push(<span key="s" className="chip">Your move</span>);
  if (p.billing === "portfolio") chips.push(<span key="b" className="chip plain">Portfolio</span>);
  else if (totalOf(p)) chips.push(<span key="b" className="chip gold num">{money(paidOf(p))} / {money(totalOf(p))}</span>);
  return (
    <button className="card" onClick={() => onOpen(p)}>
      <div className="card-top">
        <div><h3>{p.name}</h3><div className="client">{p.client || ""}{p.type ? " · " + p.type : ""}</div></div>
        <div className="chips">{chips}</div>
      </div>
      <div className="rail">{segs}</div>
      <div className="phase-line"><span>Phase {ph + 1}/{PHASES.length}: <strong>{PHASES[ph][1]}</strong></span><span className="note">{p.startDate ? "Started " + fmtDate(p.startDate) : ""}</span></div>
      {p.nextStep && <div className="next"><em>Next</em><span>{p.nextStep}</span></div>}
      <DocBadges pid={p.id} />
    </button>
  );
}
