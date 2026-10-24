import { useState } from "react";
import { api } from "../api.js";
import { useData } from "../context/Data.jsx";
import { usePop } from "../context/Pop.jsx";
import { useToast } from "../context/Toast.jsx";
import { downloadFile } from "../lib/download.js";
import { projectsToCsv } from "../lib/csv.js";
import { todayStr, fmtDate, year } from "../lib/format.js";

function Backup() {
  const { projects, reload } = useData();
  const toast = useToast();
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    try {
      const data = await api("/api/backup");
      downloadFile(`Parteh HQ backup ${todayStr()}.json`, JSON.stringify(data, null, 2), "application/json");
      setMsg(`Downloaded ${data.projects.length} projects and ${data.docs.length} documents.`);
    } catch (e) { setMsg(e.message); }
  };
  const csv = () => { downloadFile(`Projects ${todayStr()}.csv`, projectsToCsv(projects), "text/csv"); setMsg(`Exported ${projects.length} projects.`); };

  const pick = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (data.app !== "client-pipeline" || !Array.isArray(data.projects)) throw new Error("bad");
        setPending(data); setMsg("");
      } catch { setPending(null); setMsg("That file isn't a Parteh HQ backup."); }
    };
    r.readAsText(f);
    e.target.value = "";
  };
  const restore = async () => {
    setBusy(true); setMsg("Restoring…");
    try {
      const r = await api("/api/backup/import", { method: "POST", body: pending });
      const { projects: np, docs: nd } = r.imported;
      setMsg(`Restored ${np} projects and ${nd} documents.${r.skipped.length ? ` ${r.skipped.length} skipped: ${r.skipped.map((s) => s.reason).slice(0, 3).join(" ")}` : ""}`);
      setPending(null); toast("Backup restored");
      await reload();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ fontSize: 17 }}>Your data</h2>
      <p className="note">Your projects and documents are saved on your own server and database. Download a backup now and then to keep your own copy. Keep the file private: it holds your clients' details.</p>
      <div className="row"><button className="btn sm" onClick={download}>Download backup (.json)</button><button className="btn sm ghost" onClick={csv}>Export projects (.csv)</button></div>
      <div className="row"><label className="btn sm ghost" style={{ flexDirection: "row", cursor: "pointer", color: "var(--ink)" }}>Restore from backup<input type="file" accept=".json,application/json" hidden onChange={pick} aria-label="Restore from backup" /></label></div>
      {pending && (
        <div className="note">
          Backup from {fmtDate(pending.exportedAt) || "an unknown date"}: {pending.projects.length} projects, {(pending.docs || []).length} documents. Items with the same ID are replaced; everything else stays.
          <div className="row" style={{ marginTop: 8 }}><button className="btn sm warn" onClick={restore} disabled={busy}>Restore now</button><button className="btn sm ghost" onClick={() => setPending(null)}>Cancel</button></div>
        </div>
      )}
      <div role="status" className="note">{msg}</div>
    </div>
  );
}

function SettingsForm() {
  const { settings: s, saveSettings } = useData();
  const { closePop } = usePop();
  const [f, setF] = useState({ ...s, autoMove: s.autoMove !== false });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      await saveSettings({
        bizName: f.bizName.trim() || "Stephen Parteh", tagline: f.tagline.trim(), service: f.service.trim(), email: f.email.trim(), about: f.about.trim(), formLink: f.formLink.trim(),
        autoMove: f.autoMove, phone: f.phone.trim(), portfolio: f.portfolio.trim(), goal: +f.goal || 150, depositPct: +f.depositPct || 0, payInfo: f.payInfo.trim(),
      });
      closePop();
    } catch { setSaving(false); }
  };
  return (
    <>
      <p className="note">Used on your invoices, cards and messages.</p>
      <div className="grid2">
        <label>Your name<input value={f.bizName} onChange={set("bizName")} /></label>
        <label>Title<input value={f.tagline} onChange={set("tagline")} /></label>
        <label>What you offer<input value={f.service} onChange={set("service")} /></label>
        <label>Email<input value={f.email} onChange={set("email")} inputMode="email" /></label>
        <label>Phone / WhatsApp<input value={f.phone} onChange={set("phone")} inputMode="tel" placeholder="+231 …" /></label>
        <label>Portfolio link<input value={f.portfolio} onChange={set("portfolio")} placeholder="yoursite.com" /></label>
        <label>Money goal for {year()} (USD)<input type="number" min="1" value={f.goal} onChange={set("goal")} /></label>
        <label>Default deposit (%)<input type="number" min="0" max="100" value={f.depositPct} onChange={set("depositPct")} /></label>
      </div>
      <label>How clients pay you<textarea value={f.payInfo} onChange={set("payInfo")} placeholder="e.g. Orange Money: 0770 000 000 (Stephen Parteh)" /></label>
      <label>About me (shown on proposals)<textarea value={f.about} onChange={set("about")} placeholder="Leave empty to use the standard text" /></label>
      <label>Google Form link (discovery questionnaire)<input value={f.formLink} onChange={set("formLink")} placeholder="https://forms.gle/…" /></label>
      <label className="inline-check"><input type="checkbox" checked={f.autoMove} onChange={set("autoMove")} /> Move projects forward when I send or update documents</label>
      <div className="row"><button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</button></div>
      <Backup />
    </>
  );
}

export const settingsDialog = () => <SettingsForm />;
