import { Section, Txt, Area, Sel, ProjectSelect, RowInput, RowSel, days, weeksOpts } from "./FormKit.jsx";
import * as TL from "../templates/timeline.js";

export default function TimelineForm({ ed }) {
  const { d, kit } = ed, rows = d.rows || [], done = rows.filter((r) => r.status === "Done").length;
  const regen = () => kit.regenRows(d);
  return (
    <>
      <Section id="client" title="Project & dates" ed={ed}>
        <ProjectSelect ed={ed} />
        <div className="grid2">
          <Txt label="Organization / client" k="org" ed={ed} /><Txt label="Contact person" k="contactName" ed={ed} />
          <Txt label="Start date" k="startDate" ed={ed} type="date" />
          <Sel label="Project length" k="weeks" options={weeksOpts} ed={ed} refill={regen} />
          <Sel label="Has a back end (forms, admin…)" k="hasBack" options={[["1", "Yes"], ["", "No"]]} ed={ed} refill={regen} />
          <Sel label="Client review time" k="reviewDays" options={days([2, 3, 5])} ed={ed} refill={regen} />
        </div>
        <div className="row"><button className="btn sm ghost" type="button" onClick={() => { regen(); ed.touch(); ed.toast("Dates recalculated"); }}>Recalculate dates</button><span className="note">Keeps the status of each stage.</span></div>
      </Section>
      <Section id="stages" title={<>Stages <span className="note num">{done}/{rows.length} done</span></>} ed={ed}>
        {rows.map((r, i) => (
          <div className="pg" key={i}>
            <div className="pg-h"><RowInput list="rows" i={i} f="stage" ed={ed} aria-label="Stage name" /><button className="rm" aria-label="Remove stage" onClick={() => { d.rows.splice(i, 1); ed.touch(); }}>×</button></div>
            <div className="grid2">
              <label>From<RowInput list="rows" i={i} f="start" ed={ed} type="date" /></label>
              <label>To<RowInput list="rows" i={i} f="end" ed={ed} type="date" /></label>
            </div>
            <RowInput list="rows" i={i} f="desc" ed={ed} aria-label="What happens" />
            <label>Status<RowSel list="rows" i={i} f="status" options={TL.STATUS} ed={ed} /></label>
          </div>
        ))}
        <div className="row"><button className="btn sm ghost" onClick={() => { d.rows.push(ed.T.newRow()); ed.touch(); }}>+ Add stage</button></div>
      </Section>
      <Section id="note" title="Note (optional)" ed={ed}>
        <Area label="Extra note on the timeline" k="note" ed={ed} />
      </Section>
    </>
  );
}
