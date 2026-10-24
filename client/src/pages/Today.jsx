import { PHASES, LAST } from "../constants.js";
import { useData } from "../context/Data.jsx";
import { useCopy } from "../context/Pop.jsx";
import { useToast } from "../context/Toast.jsx";
import { useSheet } from "../components/ProjectSheet.jsx";
import { liveProjects, paidOf, waitDays, money, year, stageOf } from "../lib/format.js";
import { followUpText } from "../lib/messages.js";
import { useNavigate } from "react-router-dom";
import { useKit } from "../docs/useKit.js";
import { money as M, r2 } from "../docs/helpers.js";
import { fmtDate, todayStr } from "../lib/format.js";

function GoalCard({ projects, settings }) {
  const earned = projects.filter((p) => p.billing !== "portfolio").reduce((a, p) => a + paidOf(p), 0), g = +settings.goal || 150;
  const days = Math.max(0, Math.ceil((new Date(year(), 11, 31) - new Date()) / 864e5));
  return (
    <section className="goal" aria-label={`${year()} money goal`}>
      <span className="eyebrow">{year()} goal · first paying client</span>
      <div className="goal-row"><div><div className="goal-big num">{money(earned)}</div><small>collected from clients this year</small></div><small>{days} days left in {year()}</small></div>
      <div className="bar"><i style={{ width: `${Math.min(100, earned / g * 100)}%` }} /></div>
      <small>{earned >= g ? "Goal reached. First paid client is in. Keep stacking 💪🏾" : `Target ${money(g)} · ${money(Math.max(0, g - earned))} to go`}</small>
    </section>
  );
}

function StatsRow({ projects }) {
  const L = liveProjects(projects).filter((p) => p.status === "active" && p.phase < LAST);
  const launched = projects.filter((p) => p.phase === LAST && String(p.phaseDates?.[LAST] || "").startsWith(String(year()))).length;
  return (
    <section className="stats" aria-label="Overview">
      <div className="stat"><b className="num">{L.filter((p) => stageOf(p) !== "lead").length}</b><span>Active</span></div>
      <div className="stat"><b className="num">{L.filter((p) => p.waitingOn === "client").length}</b><span>Waiting on client</span></div>
      <div className="stat"><b className="num">{L.filter((p) => stageOf(p) === "lead").length}</b><span>Incoming leads</span></div>
      <div className="stat"><b className="num">{launched}</b><span>Launched in {year()}</span></div>
    </section>
  );
}

// Unpaid invoices (with a payment reminder) and proposals with no answer for 3+ days (with a follow-up).
function MoneyAndReplies() {
  const { docs } = useData();
  const kit = useKit();
  const copy = useCopy();
  const navigate = useNavigate();
  const owed = docs.filter((x) => x.type === "invoice" && x.status === "Sent" && kit.owedOn(x) > 0).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const waiting = docs.filter((x) => x.type === "proposal" && x.status === "Sent").filter((x) => Math.floor((new Date(todayStr()) - new Date(String(x.updatedAt || x.date).slice(0, 10))) / 864e5) >= 3);
  if (!owed.length && !waiting.length) return null;
  const total = r2(owed.reduce((s, x) => s + kit.owedOn(x), 0));
  return (
    <>
      <div className="sec-head"><h2>Money &amp; replies</h2>{total ? <span className="note num">{M(total)} owed</span> : null}</div>
      {owed.map((x) => { const [stx, cls] = kit.invoiceState(x); return (
        <div key={x.id} className={`card ${stx === "Overdue" ? "alert" : ""}`}>
          <div className="card-top"><div><h3>{x.client || "Client"}</h3><div className="client">{x.number} · {M(kit.owedOn(x))} unpaid</div></div><span className={`chip ${cls}`}>{stx}</span></div>
          <div className="row"><button className={`btn sm ${stx === "Overdue" ? "warn" : ""}`} onClick={() => copy(kit.msg.reminder(x), "Reminder")}>Copy payment reminder</button><button className="btn sm ghost" onClick={() => navigate(`/docs/${x.id}`)}>Open invoice</button></div>
        </div>); })}
      {waiting.map((x) => (
        <div key={x.id} className="card">
          <div className="card-top"><div><h3>{x.client || "Client"}</h3><div className="client">{x.number} · proposal sent {fmtDate(x.updatedAt)}, no answer yet</div></div><span className="chip gold">Waiting</span></div>
          <div className="row"><button className="btn sm" onClick={() => copy(kit.msg.proposalFollowUp(x), "Follow-up")}>Copy follow-up</button><button className="btn sm ghost" onClick={() => navigate(`/docs/${x.id}`)}>Open proposal</button></div>
        </div>))}
    </>
  );
}

export default function Today() {
  const { projects, settings, patchProject } = useData();
  const { openSheet } = useSheet();
  const copy = useCopy();
  const toast = useToast();
  const act = liveProjects(projects).filter((p) => p.status === "active" && p.phase < LAST);
  const moves = act.filter((p) => p.waitingOn !== "client").sort((a, b) => (a.updatedAt || "").localeCompare(b.updatedAt || "")).slice(0, 3);
  const waits = act.filter((p) => p.waitingOn === "client").sort((a, b) => waitDays(b) - waitDays(a));
  const d = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const nudged = async (p) => {
    try { await patchProject(p.id, { waitingSince: new Date().toISOString().slice(0, 10) }); toast("Nice. Timer reset to today."); } catch { /* error already shown */ }
  };
  return (
    <div className="list">
      <GoalCard projects={projects} settings={settings} />
      <section className="block">
        <div className="sec-head"><h2>Your next moves</h2><span className="note">{d}</span></div>
        {moves.length ? moves.map((p, i) => (
          <button key={p.id} className="card" onClick={() => openSheet(p)}>
            <div className="move"><span className="n">{i + 1}</span><div>
              <strong>{p.nextStep || "Decide the next step"}</strong>
              <span className="note">{p.name} · {PHASES[p.phase || 0][1]}</span>
            </div></div>
          </button>
        )) : <div className="empty">Nothing waiting on you. Post your work today and line up the next client.</div>}
      </section>
      <section className="block">
        <MoneyAndReplies />
        <div className="sec-head"><h2>Follow-ups</h2><span className="note">Nudge after 3 days of silence</span></div>
        {waits.length ? waits.map((p) => {
          const w = waitDays(p), due = w >= 3;
          return (
            <div key={p.id} className={`card ${due ? "alert" : ""}`}>
              <div className="card-top">
                <div><h3>{p.name}</h3><div className="client">{PHASES[p.phase || 0][1]}</div></div>
                <span className={`chip ${due ? "wait" : "plain"}`}>{w === 0 ? "Since today" : `Waiting ${w} day${w === 1 ? "" : "s"}`}</span>
              </div>
              <div className="row">
                {due ? <button className="btn sm warn" onClick={() => copy(followUpText(p, settings), "Follow-up")}>Copy follow-up</button>
                  : <span className="note">Follow up in {3 - w} day{3 - w === 1 ? "" : "s"} if you hear nothing.</span>}
                <button className="btn sm ghost" onClick={() => nudged(p)}>I followed up</button>
                <button className="btn sm ghost" onClick={() => openSheet(p)}>Open</button>
              </div>
            </div>
          );
        }) : <div className="empty">No one owes you a reply right now.</div>}
      </section>
      <StatsRow projects={projects} />
    </div>
  );
}
