// Small building blocks shared by the nine document forms.
// Every form gets `ed`, the editor: { cur, d, kit, touch, rerender, openFs, changeProject, settings, projects, docs, copy, toast }.
// Like the prototype, the document data is edited in place and the form redraws after each change.

const NUMERIC = ["validDays", "weeks", "reviewDays", "revisions", "supportDays", "depositPct", "dueDays", "milestonePct", "contentDays", "lateDays", "pauseDays", "closeDays", "noticeDays", "rounds"];
export const inputValue = (e) => (e.target.type === "number" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value);

export function Section({ id, title, ed, children }) {
  return (
    <details className="fs" open={!!ed.openFs[id]} onToggle={(e) => { ed.openFs[id] = e.currentTarget.open; }}>
      <summary>{title}</summary>
      <div className="fs-body">{children}</div>
    </details>
  );
}

// A text/number/date input bound to d[k]. refill: run this after every change (the invoice re-fills its items).
export function Txt({ label, k, ed, refill, ...attrs }) {
  const d = ed.d;
  return (
    <label>{label}
      <input value={d[k] ?? ""} {...attrs} onChange={(e) => { d[k] = inputValue(e); if (refill) refill(); ed.touch(); }} />
    </label>
  );
}

export function Area({ label, k, ed, ...attrs }) {
  return <label>{label}<textarea value={ed.d[k] ?? ""} {...attrs} onChange={(e) => { ed.d[k] = e.target.value; ed.touch(); }} /></label>;
}

export function Sel({ label, k, options, ed, refill }) {
  const d = ed.d;
  return (
    <label>{label}
      <select value={String(d[k] ?? "")} onChange={(e) => { const v = e.target.value; d[k] = NUMERIC.includes(k) ? +v : v; if (refill) refill(k); ed.touch(); }}>
        {options.map((o) => { const [v, n] = Array.isArray(o) ? o : [o, o]; return <option key={String(v)} value={String(v)}>{n}</option>; })}
      </select>
    </label>
  );
}

export function Check({ label, k, ed, className = "incl", rerender }) {
  return (
    <label className={className}>
      <input type="checkbox" checked={!!ed.d[k]} onChange={(e) => { ed.d[k] = e.target.checked; ed.touch(); }} /> {label}
    </label>
  );
}

// "Include this section" tick boxes on the proposal.
export function Incl({ k, ed }) {
  const d = ed.d;
  return (
    <label className="incl">
      <input type="checkbox" checked={d.sections?.[k] !== false} onChange={(e) => { d.sections = d.sections || {}; d.sections[k] = e.target.checked; ed.touch(); }} /> Include this section
    </label>
  );
}

// Round pick-boxes bound to an array in the data (goals, features, notes...).
export function Pick({ arr, items, ed }) {
  const d = ed.d;
  return (
    <div className="pick">
      {items.map(([v, n]) => (
        <label key={v}>
          <input type="checkbox" checked={(d[arr] || []).includes(v)} onChange={(e) => {
            const a = d[arr] = d[arr] || [], i = a.indexOf(v);
            if (e.target.checked && i < 0) a.push(v); if (!e.target.checked && i >= 0) a.splice(i, 1);
            ed.touch();
          }} />{n}
        </label>
      ))}
    </div>
  );
}

export function ProjectSelect({ ed }) {
  const opts = [["", "No project (fill in by hand)"], ...ed.projects.filter((x) => x.status !== "lost").map((x) => [x.id, x.name])];
  return (
    <label>Project
      <select value={ed.cur.projectId || ""} onChange={(e) => ed.changeProject(e.target.value)}>
        {opts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
    </label>
  );
}

// Inputs inside a list of rows (timeline stages, checklist items, revision requests).
export function RowInput({ list, i, f, ed, ...attrs }) {
  const row = ed.d[list][i];
  return <input value={row[f] ?? ""} {...attrs} onChange={(e) => { row[f] = inputValue(e); ed.touch(); }} />;
}
export function RowSel({ list, i, f, options, ed, ...attrs }) {
  const row = ed.d[list][i];
  return (
    <select value={String(row[f] ?? "")} {...attrs} onChange={(e) => { row[f] = e.target.value; ed.touch(); const T = ed.T; if (T.onRowChange) T.onRowChange(ed.d, list, i, f); }}>
      {options.map((o) => { const [v, n] = Array.isArray(o) ? o : [o, o]; return <option key={String(v)} value={String(v)}>{n}</option>; })}
    </select>
  );
}

export const days = (arr, unit = "days") => arr.map((n) => [n, `${n} ${unit}`]);
export const weeksOpts = [1, 2, 3, 4, 5, 6, 8].map((n) => [n, `${n} week${n > 1 ? "s" : ""}`]);
export const planOpts = (d) => [["deposit", `Deposit (${d.depositPct}%) to start, balance on launch`], ["50-50", "50% to start, 50% on launch"], ["30-40-30", "30% start, 40% design, 30% launch"], ["full", "100% before work starts"]];
