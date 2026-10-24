import { useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { useData } from "../context/Data.jsx";
import { useCopy, usePop } from "../context/Pop.jsx";
import { useKit } from "../docs/useKit.js";
import { DOC_TYPES, TYPE_NAME } from "../docs/kit.js";
import { money as M, r2 } from "../docs/helpers.js";
import { fmtDate } from "../lib/format.js";
import { settingsDialog } from "../components/SettingsDialog.jsx";
import DocEditor from "./DocEditor.jsx";

function DocsHome() {
  const { docs, settings } = useData();
  const kit = useKit();
  const copy = useCopy();
  const { openPop } = usePop();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  const all = docs.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const list = filter === "all" ? all : filter === "other" ? all.filter((d) => !["proposal", "invoice", "receipt"].includes(d.type)) : all.filter((d) => d.type === filter);
  const unpaid = docs.filter((d) => d.type === "invoice" && ["Sent", "Overdue", "Partly paid"].includes(kit.invoiceState(d)[0]));
  const owed = r2(unpaid.reduce((a, d) => a + Math.max(0, (+d.total || 0) - kit.invoicePaid(d)), 0));
  const tab = (k, n) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{n}</button>;

  return (
    <div className="list">
      <div className="sec-head"><h2>Documents</h2><span className="note">USD · A4 · your brand</span></div>
      {owed > 0 && <div className="warnbox"><strong>{M(owed)}</strong> still owed on {unpaid.length} invoice{unpaid.length === 1 ? "" : "s"}. When a client pays, open the invoice and tap “Make receipt”.</div>}
      <section className="block">
        <div className="sec-head"><h2>Your documents</h2><span className="note">{all.length}</span></div>
        {all.length > 0 && <div className="tabs dfilter" role="group" aria-label="Filter documents">{tab("all", "All")}{tab("proposal", "Proposals")}{tab("invoice", "Invoices")}{tab("receipt", "Receipts")}{tab("other", "Other")}</div>}
        {list.length ? list.map((d) => {
          const [stx, cls] = kit.stateOf(d), T = kit.TY[d.type];
          return (
            <button key={d.id} className="drow" onClick={() => navigate(`/docs/${d.id}`)}>
              <strong>{d.number || "Draft"}</strong><span className={`chip ${cls}`}>{stx}</span>
              <span className="sub">{TYPE_NAME[d.type] || "Document"} · {d.client || "No client"}{T && T.money === false ? "" : ` · ${M(d.total || 0)}`} · {fmtDate(d.date || d.updatedAt)}</span>
            </button>
          );
        }) : <div className="empty">{all.length ? "Nothing here yet." : "No documents yet. Start with a proposal for your next client."}</div>}
      </section>
      <section className="block">
        <div className="sec-head"><h2>New document</h2></div>
        <div className="dgrid">
          {DOC_TYPES.map(([k, n, desc]) => (
            <div className="dtype" key={k}><span className="eyebrow">Template</span><h3>{n}</h3><p>{desc}</p>
              <div className="row"><button className="btn sm" onClick={() => navigate(`/docs/new/${k}`)}>New {n.toLowerCase()}</button></div></div>
          ))}
          <div className="dtype"><span className="eyebrow">Google Form</span><h3>Discovery questionnaire</h3>
            <p>{settings.formLink ? "Send your form to new leads." : "Add your Google Form link in Settings to send it from here."}</p>
            <div className="row">{settings.formLink
              ? <button className="btn sm ghost" onClick={() => copy(kit.msg.formMessage(), "Form message")}>Copy form message</button>
              : <button className="btn sm ghost" onClick={() => openPop("Settings", settingsDialog())}>Open Settings</button>}</div></div>
        </div>
      </section>
    </div>
  );
}

export default function Docs() {
  return (
    <Routes>
      <Route index element={<DocsHome />} />
      <Route path=":a/:b?" element={<DocEditor />} />
    </Routes>
  );
}
