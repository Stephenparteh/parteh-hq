import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PHASES, STAGES, GATE, SOURCES, DEFAULT_CONTENT, NEXT_STEPS, ALL_NEXT } from "../constants.js";
import { useData } from "../context/Data.jsx";
import { useToast } from "../context/Toast.jsx";
import { useCopy } from "../context/Pop.jsx";
import { useShowImage } from "./ImageView.jsx";
import { toDraft, movePhase, pickNextStep, prepareForSave } from "../lib/projectLogic.js";
import { totalOf, paidOf, depositOf, fmtDate, money, todayStr, safeName } from "../lib/format.js";
import { contentText, updateText, invoiceText } from "../lib/messages.js";
import { makeUpdateCard } from "../lib/cards.js";
import { useNavigate } from "react-router-dom";
import { useKit } from "../docs/useKit.js";
import { TYPE_NAME } from "../docs/kit.js";

const SheetCtx = createContext(null);
export const useSheet = () => useContext(SheetCtx);

const TABS = [["details", "Details"], ["workflow", "Workflow"], ["money", "Money"], ["content", "Content"], ["docs", "Docs"], ["update", "Client update"]];

// openSheet(project) edits a project. openSheet(null) starts a new one.
// openSheet(project, "money", { scope, price }) opens a tab and fills in some fields (used by the price calculator).
export function SheetProvider({ children }) {
  const [sheet, setSheet] = useState(null);
  const openSheet = useCallback((project, tab = "details", patch) => setSheet({ project, tab, patch, key: Math.random() }), []);
  const close = useCallback(() => setSheet(null), []);
  const value = useMemo(() => ({ openSheet }), [openSheet]);
  return (
    <SheetCtx.Provider value={value}>
      {children}
      {sheet && <ProjectSheet key={sheet.key} project={sheet.project} tab={sheet.tab} patch={sheet.patch} onClose={close} />}
    </SheetCtx.Provider>
  );
}

function Field({ label, k, draft, set, ...attrs }) {
  return <label>{label}<input value={draft[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...attrs} /></label>;
}
function Select({ label, k, draft, set, options }) {
  return (
    <label>{label}
      <select value={String(draft[k] ?? "")} onChange={(e) => set(k, e.target.value)}>
        {options.map((o) => { const [v, n] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{n}</option>; })}
      </select>
    </label>
  );
}

function NextField({ draft, setDraft }) {
  const v = draft.nextStep || "";
  const custom = draft._customNext || (v !== "" && !ALL_NEXT.includes(v));
  return (
    <>
      <label>Next step
        <select value={custom ? "__custom" : v} onChange={(e) => setDraft((d) => pickNextStep(d, e.target.value))}>
          <option value="">Choose the next step…</option>
          {NEXT_STEPS.map(([g, items]) => <optgroup key={g} label={g}>{items.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>)}
          <option value="__custom">Other (type my own)</option>
        </select>
      </label>
      {custom && <input value={v} onChange={(e) => setDraft((d) => ({ ...d, nextStep: e.target.value }))} placeholder="Type the next step" aria-label="Your own next step" />}
      <p className="note" style={{ marginTop: -6 }}>Picking a step also sets who it's waiting on.</p>
    </>
  );
}

function DetailsTab({ draft, set, setDraft }) {
  return (
    <>
      <div className="grid2">
        <Field label="Project name" k="name" draft={draft} set={set} placeholder="e.g. Christ Life website" />
        <Field label="Organization / client" k="client" draft={draft} set={set} placeholder="Organization or person" />
        <Field label="Contact person" k="contactName" draft={draft} set={set} placeholder="First name for messages" />
        <Field label="Phone / WhatsApp" k="contact" draft={draft} set={set} inputMode="tel" />
        <Select label="Type" k="type" draft={draft} set={set} options={["Website", "Graphic design", "Website + branding", "Other"]} />
        <Select label="Billing" k="billing" draft={draft} set={set} options={[["paid", "Paid project"], ["portfolio", "Volunteer / portfolio"]]} />
        <Select label="Where they found you" k="source" draft={draft} set={set} options={[["", "Not set"], ...SOURCES]} />
        <Field label="Referred by" k="referredBy" draft={draft} set={set} placeholder="Who sent them to you?" />
        <Field label="Started" k="startDate" draft={draft} set={set} type="date" />
        <Select label="Status" k="status" draft={draft} set={set} options={[["active", "Active"], ["paused", "Paused"], ["lost", "Lost / declined"]]} />
        <Select label="Waiting on" k="waitingOn" draft={draft} set={set} options={[["me", "Me"], ["client", "Client"]]} />
      </div>
      <NextField draft={draft} setDraft={setDraft} />
      <label>Notes<textarea value={draft.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Scope, features, anything to remember" /></label>
    </>
  );
}

function WorkflowTab({ draft, setDraft }) {
  const toast = useToast();
  const tap = (i) => {
    const n = movePhase(draft, i);
    if (!n) { toast("Log the deposit in the Money tab before starting work"); return; }
    setDraft(n);
  };
  let last = "";
  return (
    <>
      <span className="eyebrow">Tap the phase you're on</span>
      <div className="steps">
        {PHASES.map(([k, n], i) => {
          const head = k !== last ? <div className="stage-h">{STAGES.find((s) => s[0] === k)[1]}</div> : null;
          last = k;
          return (<Fragment key={i}>{head}
            <button type="button" className={`step ${i < draft.phase ? "done" : i === draft.phase ? "cur" : ""} ${i === GATE ? "gate" : ""}`} onClick={() => tap(i)} aria-current={i === draft.phase ? "step" : undefined}>
              <span className="dot">{i < draft.phase ? "✓" : ""}</span><span className="lbl">{n}</span><span className="d">{fmtDate(draft.phaseDates?.[i])}</span>
            </button></Fragment>);
        })}
      </div>
      <NextField draft={draft} setDraft={setDraft} />
    </>
  );
}

function MoneyTab({ draft, set, setDraft, settings, openBuilder }) {
  const copy = useCopy();
  const d = draft, tot = totalOf(d), paid = paidOf(d), dep = depositOf(d, settings.depositPct), depOk = paid >= dep && dep > 0;
  const upScope = (i, f, v) => setDraft((x) => ({ ...x, scope: x.scope.map((l, j) => (j === i ? { ...l, [f]: v } : l)) }));
  const upPay = (i, f, v) => setDraft((x) => ({ ...x, payments: x.payments.map((l, j) => (j === i ? { ...l, [f]: v } : l)) }));
  return (
    <>
      <div className="grid2">
        <Select label="Billing" k="billing" draft={d} set={set} options={[["paid", "Paid project"], ["portfolio", "Volunteer / portfolio"]]} />
        <Field label="Deposit to start (%)" k="depositPct" draft={d} set={set} type="number" min="0" max="100" inputMode="decimal" />
      </div>
      <div>
        <div className="sec-head"><span className="eyebrow">What they're paying for</span><span className="note">or use the Pricing tab</span></div>
        <div className="lines">
          {d.scope.map((l, i) => (
            <div className="line" key={i}>
              <input value={l.item} onChange={(e) => upScope(i, "item", e.target.value)} aria-label="Item" />
              <input type="number" min="0" inputMode="decimal" value={l.price} onChange={(e) => upScope(i, "price", e.target.value)} aria-label="Price" />
              <button className="rm" aria-label="Remove item" onClick={() => setDraft((x) => ({ ...x, scope: x.scope.filter((_, j) => j !== i) }))}>×</button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}><button className="btn sm ghost" onClick={() => setDraft((x) => ({ ...x, scope: [...x.scope, { item: "", price: 0 }] }))}>+ Add item</button></div>
        {!d.scope.length && <div style={{ marginTop: 8 }}><Field label="Or one total price (USD)" k="price" draft={d} set={set} type="number" min="0" inputMode="decimal" /></div>}
      </div>
      <div>
        <span className="eyebrow">Payments received</span>
        <div className="lines">
          {d.payments.map((x, i) => (
            <div className="line pay" key={i}>
              <input type="date" value={x.date || ""} onChange={(e) => upPay(i, "date", e.target.value)} aria-label="Date" />
              <input type="number" inputMode="decimal" value={x.amount} onChange={(e) => upPay(i, "amount", e.target.value)} aria-label="Amount" />
              <input className="pn" value={x.note || ""} onChange={(e) => upPay(i, "note", e.target.value)} placeholder="Note" aria-label="Note" />
              <button className="rm" aria-label="Remove payment" onClick={() => setDraft((y) => ({ ...y, payments: y.payments.filter((_, j) => j !== i) }))}>×</button>
            </div>
          ))}
          {!d.payments.length && <p className="note">No payments yet.</p>}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn sm ghost" onClick={() => setDraft((x) => ({ ...x, payments: [...x.payments, { date: todayStr(), amount: paid ? Math.max(0, tot - paid) : dep, note: paid ? "Payment" : "Deposit" }] }))}>+ Log a payment</button>
        </div>
      </div>
      <div className="sum">
        <span>Total</span><span className="num">{money(tot)}</span>
        <span>Deposit needed ({+d.depositPct || 0}%)</span><span className="num">{money(dep)} {tot ? (depOk ? "✓" : "· pending") : ""}</span>
        <span>Paid so far</span><span className="num">{money(paid)}</span>
        <span className="tot">Balance due</span><span className="num tot">{money(Math.max(0, tot - paid))}</span>
      </div>
      <div className="row">
        <button className="btn" disabled={!tot} onClick={() => openBuilder("invoice")}>Create invoice</button>
        <button className="btn ghost" disabled={!paid} onClick={() => openBuilder("receipt")}>Make a receipt</button>
        <button className="btn ghost" disabled={!tot} onClick={() => copy(invoiceText(d, settings), "Invoice")}>Copy invoice text</button>
      </div>
      {!tot && <p className="note">Add what they're paying for to create an invoice.</p>}
    </>
  );
}

function ContentTab({ draft, setDraft, settings }) {
  const copy = useCopy();
  const [newItem, setNewItem] = useState("");
  const d = draft, got = d.content.filter((c) => c.done).length;
  useEffect(() => { if (!d.content.length) setDraft((x) => (x.content.length ? x : { ...x, content: DEFAULT_CONTENT.map((label) => ({ label, done: false })) })); }, [d.content.length, setDraft]);
  const add = () => { const v = newItem.trim(); if (v) { setDraft((x) => ({ ...x, content: [...x.content, { label: v, done: false }] })); setNewItem(""); } };
  return (
    <>
      <div className="sec-head"><span className="eyebrow">Content from the client</span><span className="note num">{got}/{d.content.length} received</span></div>
      <div>
        {d.content.map((c, i) => (
          <div className={`check ${c.done ? "done" : ""}`} key={i}>
            <input type="checkbox" id={`ct-${i}`} checked={!!c.done} onChange={(e) => setDraft((x) => ({ ...x, content: x.content.map((y, j) => (j === i ? { ...y, done: e.target.checked } : y)) }))} />
            <span><label htmlFor={`ct-${i}`} style={{ fontSize: 15, color: "inherit", fontWeight: 400 }}>{c.label}</label></span>
            <button className="rm" aria-label="Remove" onClick={() => setDraft((x) => ({ ...x, content: x.content.filter((_, j) => j !== i) }))}>×</button>
          </div>
        ))}
      </div>
      <div className="line" style={{ gridTemplateColumns: "1fr auto" }}>
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add something else you need" aria-label="New content item" />
        <button className="btn sm ghost" onClick={add}>Add</button>
      </div>
      <div className="row"><button className="btn" onClick={() => copy(contentText(d, settings), "Checklist")}>Copy what's still missing</button></div>
    </>
  );
}

const NEW_DOCS = [["proposal", "Proposal"], ["agreement", "Agreement"], ["invoice", "Invoice"], ["receipt", "Receipt"], ["content", "Content checklist"], ["timeline", "Timeline"], ["revision", "Revision log"], ["handover", "Handover"], ["testimonial", "Testimonial request"]];

function DocsTab({ draft, set, projectId, openBuilder }) {
  const { docs } = useData();
  const kit = useKit();
  const mine = projectId ? docs.filter((x) => x.projectId === projectId).sort((x, y) => (y.updatedAt || "").localeCompare(x.updatedAt || "")) : [];
  return (
    <>
      {!projectId ? <p className="note">Save the project first. Then you can create its documents here.</p> : (
        <>
          <div>
            <div className="sec-head"><span className="eyebrow">This project's documents</span><span className="note">{mine.length}</span></div>
            {mine.length ? mine.map((x) => { const [st, cls] = kit.stateOf(x); return (
              <div className="pdoc" key={x.id}>
                <div><strong>{x.number}</strong><div className="note">{TYPE_NAME[x.type] || "Document"}{["proposal", "invoice", "receipt", "agreement"].includes(x.type) ? ` · ${money(x.total)}` : ""}</div></div>
                <div className="row"><span className={`chip ${cls}`}>{st}</span><button className="btn sm ghost" onClick={() => openBuilder(null, x.id)}>Open</button></div>
              </div>); }) : <p className="note">No documents yet.</p>}
          </div>
          <div>
            <span className="eyebrow">Create</span>
            <div className="newdocs" style={{ marginTop: 6 }}>{NEW_DOCS.map(([k, n]) => <button key={k} className="btn sm ghost" onClick={() => openBuilder(k)}>+ {n}</button>)}</div>
            <p className="note" style={{ marginTop: 6 }}>Details from this project fill in for you. Your changes here are saved first.</p>
          </div>
        </>
      )}
      <label>Their Google Form answers + brief call notes
        <textarea value={draft.brief || ""} onChange={(e) => set("brief", e.target.value)} placeholder="Paste what they filled in the form, plus anything from your call" />
      </label>
    </>
  );
}

function UpdateTab({ draft, settings }) {
  const copy = useCopy();
  const showImage = useShowImage();
  const toast = useToast();
  const card = async () => {
    try { showImage(await makeUpdateCard(draft, settings), `${safeName(draft.name)} update.png`, "Progress card", "Send this to your client, or post it on your status to show what you're working on."); }
    catch { toast("Couldn't create the image."); }
  };
  return (
    <>
      <p className="note">Send clients a quick picture of where their project stands, so they never have to ask “how far?”</p>
      <div className="next"><em>Preview</em><span style={{ whiteSpace: "pre-wrap" }}>{updateText(draft, settings)}</span></div>
      <div className="row"><button className="btn" onClick={card}>Create progress card</button><button className="btn ghost" onClick={() => copy(updateText(draft, settings), "Update")}>Copy update message</button></div>
    </>
  );
}

function ProjectSheet({ project, tab: firstTab, patch, onClose }) {
  const { settings, saveProject, deleteProject, docs } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState(() => ({ ...toDraft(project, settings), ...(patch || {}) }));
  const [tab, setTab] = useState(firstTab);
  const [saving, setSaving] = useState(false);
  const [armed, setArmed] = useState(false);
  const armTimer = useRef();
  const set = useCallback((k, v) => setDraft((d) => ({ ...d, [k]: v })), []);
  useEffect(() => () => clearTimeout(armTimer.current), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Saves without closing. Returns the saved project, or null.
  const persist = async () => {
    if (!String(draft.name || "").trim()) { setTab("details"); toast("Give the project a name first"); return null; }
    setSaving(true);
    try { return await saveProject(prepareForSave(draft, project), project?.id); }
    catch { setSaving(false); return null; } // the data layer already rolled back and showed the error
  };
  const save = async () => { if (await persist()) { onClose(); toast("Saved"); } };
  // Opens a document for this project. Unsaved project changes are saved first.
  const openBuilder = async (type, docId) => {
    if (!project) { toast(`Save the project first, then create the ${type ? TYPE_NAME[type].toLowerCase() : "document"}.`); return; }
    if (!(await persist())) return;
    onClose();
    if (docId) { navigate(`/docs/${docId}`); return; }
    if (type === "proposal") { // reuse the latest proposal for this project, like the prototype
      const ex = docs.filter((x) => x.type === "proposal" && x.projectId === project.id).sort((x, y) => (y.updatedAt || "").localeCompare(x.updatedAt || ""))[0];
      if (ex) { navigate(`/docs/${ex.id}`); return; }
    }
    navigate(`/docs/new/${type}`, { state: { projectId: project.id, opts: { kind: paidOf(draft) > 0 ? "final" : "deposit" } } });
  };
  const del = async () => {
    if (!armed) { setArmed(true); armTimer.current = setTimeout(() => setArmed(false), 3000); return; }
    setSaving(true);
    try { await deleteProject(project.id); onClose(); toast("Deleted"); } catch { setSaving(false); setArmed(false); }
  };

  const props = { draft, set, setDraft, settings, projectId: project?.id, openBuilder };
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
        <div className="sheet-head"><h2 id="sheetTitle">{project ? project.name : "New project"}</h2><button className="x" aria-label="Close" onClick={onClose}>×</button></div>
        <div className="stabs" role="tablist">
          {TABS.map(([k, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{n}</button>)}
        </div>
        <div className="sbody">
          {tab === "details" && <DetailsTab {...props} />}
          {tab === "workflow" && <WorkflowTab {...props} />}
          {tab === "money" && <MoneyTab {...props} />}
          {tab === "content" && <ContentTab {...props} />}
          {tab === "docs" && <DocsTab {...props} />}
          {tab === "update" && <UpdateTab {...props} />}
        </div>
        <div className="sheet-foot">
          {project ? <button className="btn danger" onClick={del} disabled={saving}>{armed ? "Tap again to delete" : "Delete"}</button> : <span />}
          <div className="row"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
        </div>
      </div>
    </div>
  );
}
