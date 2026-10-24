import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useData } from "../context/Data.jsx";
import { useToast } from "../context/Toast.jsx";
import { useCopy } from "../context/Pop.jsx";
import { useKit } from "../docs/useKit.js";
import { ready, preview, toPdf, toDocx } from "../docs/engine.js";
import { computeAutomation, applyUndo } from "../docs/automation.js";
import { sumItems } from "../docs/kit.js";
import * as IN from "../docs/templates/invoice.js";
import { r2 } from "../docs/helpers.js";
import { downloadFile } from "../lib/download.js";
import ProposalForm from "../docs/forms/ProposalForm.jsx";
import InvoiceForm from "../docs/forms/InvoiceForm.jsx";
import ReceiptForm from "../docs/forms/ReceiptForm.jsx";
import AgreementForm, { LegalPanel } from "../docs/forms/AgreementForm.jsx";
import TimelineForm from "../docs/forms/TimelineForm.jsx";
import ContentForm from "../docs/forms/ContentForm.jsx";
import RevisionForm from "../docs/forms/RevisionForm.jsx";
import HandoverForm from "../docs/forms/HandoverForm.jsx";
import TestimonialForm, { TestimonialPreview } from "../docs/forms/TestimonialForm.jsx";

const FORMS = { proposal: ProposalForm, invoice: InvoiceForm, receipt: ReceiptForm, agreement: AgreementForm, timeline: TimelineForm, content: ContentForm, revision: RevisionForm, handover: HandoverForm, testimonial: TestimonialForm };
const clone = (x) => JSON.parse(JSON.stringify(x));

// Everything the editor remembers between redraws. It lives in a ref and is changed in place, like the prototype.
function freshState(doc) {
  return { cur: clone(doc), dirty: !doc.id, mode: "fill", leaveArmed: false, pdfArmed: false, busy: false, msg: "",
    savedStatus: doc.id ? doc.status : null, savedConfirmed: !!(doc.id && doc.data && doc.data.confirmed), openFs: { client: true } };
}

export default function DocEditor() {
  const { a, b } = useParams(); // "new" + type, or a document id
  const location = useLocation();
  const navigate = useNavigate();
  const data = useData();
  const toast = useToast();
  const copy = useCopy();
  const kit = useKit();
  const [, bump] = useReducer((x) => x + 1, 0);
  const st = useRef(null);
  const ownNav = useRef(false);
  const previewRef = useRef(null);

  const load = useCallback(() => {
    if (a === "new") {
      const T = kit.TY[b]; if (!T) return null;
      const s = location.state || {};
      return freshState(T.make(s.projectId || "", s.opts || {}));
    }
    const doc = data.docs.find((x) => x.id === a);
    return doc ? freshState(doc) : null;
  }, [a, b, location.state, data.docs, kit]);

  if (st.current === null) st.current = load() || false;
  // Opening a different document (not just our own URL change after the first save) starts fresh.
  useEffect(() => {
    if (ownNav.current) { ownNav.current = false; return; }
    st.current = load() || false; bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const s = st.current;
  const T = s && kit.TY[s.cur.type];
  const touch = useCallback(() => { const x = st.current; x.dirty = true; x.leaveArmed = false; x.pdfArmed = false; bump(); }, []);

  useEffect(() => {
    if (!s || s.mode !== "preview" || T.messageOnly || !previewRef.current) return;
    let live = true;
    (async () => {
      try {
        await ready(false);
        if (live && previewRef.current) preview(T.build(s.cur.data, s.cur), previewRef.current, Math.min(760, previewRef.current.clientWidth || 600));
      } catch {
        if (live && previewRef.current) previewRef.current.innerHTML = `<div class="empty">Couldn't load the document tools. Check your connection, then tap “2. Preview & save” again.</div>`;
      }
    })();
    return () => { live = false; };
  }, [s && s.mode, s && s.cur.number]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) {
    return (
      <div className="list">
        <div className="empty">That document wasn't found.<br /><button className="btn sm" style={{ marginTop: 10 }} onClick={() => navigate("/docs")}>← Documents</button></div>
      </div>
    );
  }
  const { cur } = s, d = cur.data;

  const changeProject = (pid) => { cur.projectId = pid; T.onProject(d, pid); touch(); };
  const ed = { cur, d, kit, T, touch, rerender: bump, openFs: s.openFs, changeProject, toast, copy, settings: data.settings, projects: data.projects, docs: data.docs };

  /* ---- what a saved document does to its project (port of docs3.js hooks) ---- */
  async function runAutomation(doc, prev) {
    if (!doc.projectId) return;
    const p = data.getProject(doc.projectId); if (!p) return;
    const { patch, undo, notes } = computeAutomation({ project: p, doc, prev, autoMove: data.settings.autoMove !== false, today: kit.today() });
    if (!Object.keys(patch).length) return;
    try {
      await data.patchProject(p.id, patch);
    } catch { toast("The document was saved, but the project couldn't be updated."); return; }
    if (notes.length) {
      toast(`${p.name}: ${notes.join(" · ")}`, {
        undo: async () => {
          const now = data.getProject(p.id); if (!now) return;
          try { await data.saveProject(applyUndo(now, undo), p.id); toast("Project change undone"); } catch { toast("Couldn't undo. Change it in the project."); }
        },
      });
    }
  }

  async function saveDoc(quiet) {
    if (cur.type === "receipt") kit.prepReceipt(cur.data, cur.projectId);
    const wasNew = !cur.id;
    let r;
    try {
      r = await data.saveDocument(cur, r2(T.total(cur.data)), T.client(cur.data) || "", cur.data.date || kit.today());
    } catch (e) {
      toast(e.status === 409 || e.status === 400 ? e.message : "Couldn't save. Check your connection and try again.");
      return false;
    }
    cur.id = r.id; cur.number = r.number; cur.data = r.data; cur.createdAt = r.createdAt; cur.updatedAt = r.updatedAt;
    s.dirty = false;
    const prev = { status: s.savedStatus, confirmed: s.savedConfirmed };
    s.savedStatus = cur.status; s.savedConfirmed = !!cur.data.confirmed;
    if (!quiet) toast(`Saved as ${cur.number}`);
    if (wasNew) { ownNav.current = true; navigate(`/docs/${r.id}`, { replace: true }); }
    bump();
    try {
      if (cur.type === "receipt" && cur.data.confirmed) await data.refreshProjects(); // the server updated the project's payments
      await runAutomation({ type: cur.type, status: cur.status || "Draft", projectId: cur.projectId, data: cur.data }, prev);
    } catch { /* the document is saved; the project notice is best effort */ }
    return true;
  }

  const fileBase = () => `${cur.number} ${String(T.client(d) || "Client").replace(/[^\w\- .&]+/g, "").trim()} - ${T.label}`.slice(0, 120);

  async function exportFile(kind) {
    if (s.busy) return;
    const warns = T.check(d, cur), blockers = T.block ? T.block(d) : (T.hard ? warns : []);
    if (blockers.length) { toast("Fix the items in the red box first."); return; }
    if (warns.length && !s.pdfArmed) { s.pdfArmed = true; bump(); toast("Some details are missing. Tap again to save anyway."); return; }
    s.busy = true; s.msg = ""; bump();
    try {
      if (!(await saveDoc(true))) return;
      s.msg = "Creating your file…"; bump();
      await ready(kind === "docx");
      const model = T.build(cur.data, cur);
      if (kind === "pdf") { const { pdf } = toPdf(model); const name = fileBase() + ".pdf"; downloadFile(name, pdf.output("blob")); s.msg = `Created ${name}. Check your Downloads.`; }
      else { const blob = await toDocx(model); const name = fileBase() + ".docx"; downloadFile(name, blob); s.msg = `Created ${name}. Check your Downloads.`; }
      toast("File created");
    } catch { s.msg = "Couldn't create the file. Check your connection and try again."; }
    finally { s.busy = false; s.pdfArmed = false; bump(); }
  }

  const goBack = () => {
    if (s.dirty && !s.leaveArmed) { s.leaveArmed = true; bump(); return; }
    navigate("/docs");
  };
  const toDepositInvoice = async () => {
    if (s.dirty && !(await saveDoc(true))) return;
    const plan = d.plan === "deposit" ? d.depositPct : d.plan === "50-50" ? 50 : d.plan === "30-40-30" ? 30 : 100;
    navigate("/docs/new/invoice", { state: { projectId: cur.projectId, opts: { kind: "deposit", total: sumItems(d), depositPct: plan } } });
  };
  const toReceipt = async () => {
    if (s.dirty && !(await saveDoc(true))) return;
    const due = r2(IN.totals(d).due - kit.invoicePaid({ number: cur.number }));
    navigate("/docs/new/receipt", { state: { projectId: cur.projectId, opts: { invoiceNo: cur.number, amount: due > 0 ? due : "", newPayment: true } } });
  };

  const blockers = T.block ? T.block(d) : (T.hard ? T.check(d, cur) : []);
  const warns = [...new Set([...blockers, ...T.check(d, cur)])];
  const blockHard = blockers.length > 0;
  let extra = null;
  if (cur.type === "proposal" && cur.status === "Accepted" && cur.id) extra = <button className="btn sm" onClick={toDepositInvoice}>Create deposit invoice</button>;
  if (cur.type === "invoice" && cur.id && cur.status !== "Cancelled") { const [stx] = kit.invoiceState({ ...cur, total: T.total(d) }); if (stx !== "Paid") extra = <button className="btn sm" onClick={toReceipt}>Client paid? Make receipt</button>; }
  let chipNow = null;
  if (cur.type === "invoice" && cur.id) { const [stx, cls] = kit.invoiceState({ ...cur, total: T.total(d) }); chipNow = <> <span className={`chip ${cls}`} style={{ verticalAlign: "middle" }}>{stx}</span></>; }
  const Form = FORMS[cur.type];

  return (
    <div className="ed">
      <div className="ed-top">
        <button className="btn sm ghost" onClick={goBack}>{s.leaveArmed ? "Tap again to leave without saving" : "← Documents"}</button>
        {T.statuses && (
          <label className="note">Status{" "}
            <select value={cur.status || T.statuses[0]} onChange={(e) => { cur.status = e.target.value; touch(); }}>{T.statuses.map((x) => <option key={x}>{x}</option>)}</select>
          </label>
        )}
      </div>
      <div>
        <span className="eyebrow">{T.label}</span>
        <h1 style={{ fontSize: 24 }}>{cur.number || "New " + T.label.toLowerCase()}{chipNow}{s.dirty && <> <span className="chip gold" style={{ verticalAlign: "middle" }}>Unsaved</span></>}</h1>
      </div>
      {extra && <div className="ed-actions">{extra}</div>}
      {cur.type === "agreement" && <LegalPanel />}
      <div className="tabs" role="group" aria-label="Mode" style={{ alignSelf: "flex-start" }}>
        <button aria-pressed={s.mode === "fill"} onClick={() => { s.mode = "fill"; bump(); }}>1. Fill in</button>
        <button aria-pressed={s.mode === "preview"} onClick={() => { s.mode = "preview"; s.pdfArmed = false; bump(); window.scrollTo(0, 0); }}>2. Preview & save</button>
      </div>
      {s.mode === "fill" ? <div id="docform" className="list"><Form ed={ed} /></div> : (
        <div className="list">
          {warns.length ? (
            <div className="warnbox"><strong>{blockHard ? "Fix these before saving the file:" : "Check before sending:"}</strong><ul>{warns.map((w) => <li key={w}>{w}</li>)}</ul></div>
          ) : <div className="okbox">Everything needed is filled in.</div>}
          {T.messageOnly ? <TestimonialPreview ed={ed} /> : <div id="docprev" ref={previewRef} className="doc-pages"><div className="empty">Preparing preview…</div></div>}
        </div>
      )}
      <div className="ed-bar">
        {s.mode === "fill" ? (
          <><button className="btn ghost" onClick={() => saveDoc(false)}>Save draft</button><button className="btn" onClick={() => { s.mode = "preview"; s.pdfArmed = false; bump(); window.scrollTo(0, 0); }}>Preview →</button></>
        ) : T.messageOnly ? (
          <><button className="btn ghost" onClick={() => { s.mode = "fill"; bump(); }}>← Edit</button><span className="note" id="d-msg">{s.msg}</span><button className="btn" onClick={() => saveDoc(false)}>Save</button></>
        ) : (
          <>
            <button className="btn ghost" onClick={() => { s.mode = "fill"; bump(); }}>← Edit</button>
            <span className="note" id="d-msg" role="status">{s.msg}</span>
            <div className="row">
              {T.word === false ? null : <button className="btn ghost" onClick={() => exportFile("docx")} disabled={s.busy || blockHard}>Word file</button>}
              <button className="btn" onClick={() => exportFile("pdf")} disabled={s.busy || blockHard}>{s.pdfArmed ? "Save PDF anyway" : "Save PDF"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

