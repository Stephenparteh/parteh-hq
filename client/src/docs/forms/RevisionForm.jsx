import { Section, Txt, Sel, ProjectSelect, RowInput, RowSel } from "./FormKit.jsx";
import * as RV from "../templates/revision.js";
import { money as M } from "../helpers.js";

export default function RevisionForm({ ed }) {
  const { d, kit } = ed, reqs = d.requests || [], t = RV.totals(d);
  const pages = [...new Set([...(d.pagesList && d.pagesList.length ? d.pagesList : ["Home", "About", "Services / Programs", "Contact"]), "Whole website", "Other"])];
  return (
    <>
      <Section id="client" title="Project" ed={ed}>
        <ProjectSelect ed={ed} />
        <div className="grid2">
          <Txt label="Organization / client" k="org" ed={ed} /><Txt label="Contact person" k="contactName" ed={ed} />
          <Sel label="Revision rounds included" k="rounds" options={[[1, "1 round"], [2, "2 rounds"], [3, "3 rounds"]]} ed={ed} /><Txt label="Last updated" k="date" ed={ed} type="date" />
        </div>
        <div className="sumbox" id="d-sum">
          <span>Revision rounds included</span><span className="num">{d.rounds || 2}</span><span>Rounds used</span><span className="num">{t.rounds}</span>
          <span>Extra requests</span><span className="num">{t.extraCount}</span><span className="tot">Extra work total</span><span className="num tot">{M(t.extraCost)}</span>
        </div>
        <div className="row"><button className="btn sm ghost" onClick={() => ed.copy(kit.msg.howToSend(d), "Message")}>Copy “how to send changes” message</button></div>
      </Section>
      <Section id="reqs" title={<>Requests <span className="note num">{reqs.length}</span></>} ed={ed}>
        {reqs.map((r, i) => (
          <div className="pg" key={i}>
            <div className="pg-h"><span>Request {i + 1}</span><button className="rm" aria-label="Remove request" onClick={() => { d.requests.splice(i, 1); ed.touch(); }}>×</button></div>
            <div className="grid2">
              <label>Date<RowInput list="requests" i={i} f="date" ed={ed} type="date" /></label>
              <label>Page<RowSel list="requests" i={i} f="page" options={pages} ed={ed} /></label>
            </div>
            <label>What they want changed
              <textarea value={r.desc || ""} onChange={(e) => { r.desc = e.target.value; ed.touch(); }} />
            </label>
            <div className="grid2">
              <label>In scope?<RowSel list="requests" i={i} f="scope" options={RV.SCOPE} ed={ed} /></label>
              {r.scope === "in" && <label>Revision round<RowSel list="requests" i={i} f="round" options={[["1", "Round 1"], ["2", "Round 2"], ["3", "Round 3"]]} ed={ed} /></label>}
              {r.scope === "extra" && <label>Extra cost (USD)<RowInput list="requests" i={i} f="cost" ed={ed} type="number" min="0" inputMode="decimal" /></label>}
              <label>Status<RowSel list="requests" i={i} f="status" options={RV.STATUS} ed={ed} /></label>
              <label>Time impact<RowSel list="requests" i={i} f="impact" options={RV.IMPACT} ed={ed} /></label>
            </div>
          </div>
        ))}
        <div className="row">
          <button className="btn sm ghost" onClick={() => { (d.requests = d.requests || []).push({ ...ed.T.newRow(), page: pages[0] }); ed.touch(); }}>+ Add request</button>
          {t.extraCount > 0 && <button className="btn sm ghost" onClick={() => ed.copy(kit.msg.extraApproval(d), "Message")}>Copy extra-cost approval message</button>}
        </div>
      </Section>
    </>
  );
}
