import { Section, Txt, Sel, ProjectSelect, RowInput, RowSel } from "./FormKit.jsx";
import * as CT from "../templates/content.js";

export default function ContentForm({ ed }) {
  const { d, kit } = ed, items = d.items || [], have = new Set(items.map((x) => x.label));
  const missing = CT.PRESETS.filter((p) => !have.has(p[1]));
  const got = items.filter((x) => x.status === "rec" || x.status === "ok").length, need = items.filter((x) => x.status !== "no").length;
  return (
    <>
      <Section id="client" title="Project & deadline" ed={ed}>
        <ProjectSelect ed={ed} />
        <div className="grid2">
          <Txt label="Organization / client" k="org" ed={ed} /><Txt label="Contact person" k="contactName" ed={ed} />
          <Txt label="Send content by" k="dueDate" ed={ed} type="date" /><Sel label="How to send" k="sendVia" options={["WhatsApp", "Email", "Google Drive link", "In person"]} ed={ed} />
        </div>
      </Section>
      <Section id="items" title={<>Items <span className="note num">{got}/{need} received</span></>} ed={ed}>
        {items.map((x, i) => (
          <div className="ctrow" key={i}>
            <RowInput list="items" i={i} f="label" ed={ed} aria-label="Item" />
            <RowSel list="items" i={i} f="status" options={CT.STATUS} ed={ed} aria-label="Status" />
            <button className="rm" aria-label="Remove" onClick={() => { d.items.splice(i, 1); ed.touch(); }}>×</button>
          </div>
        ))}
        {missing.length > 0 && (
          <label>Add from the list
            <select value="" onChange={(e) => { d._add = e.target.value; ed.T.refill(d, "_add"); ed.touch(); }}>
              <option value="">Choose an item…</option>{missing.map((p) => <option key={p[1]} value={p[1]}>{`${p[0]}: ${p[1]}`}</option>)}
            </select>
          </label>
        )}
        <div className="row">
          <button className="btn sm ghost" onClick={() => { d.items.push(ed.T.newRow()); ed.touch(); }}>+ Custom item</button>
          <button className="btn sm ghost" onClick={() => ed.copy(kit.msg.missingContent(d), "Message")}>Copy “still needed” message</button>
        </div>
        <p className="note">Not requested items don't show on the PDF.</p>
      </Section>
    </>
  );
}
