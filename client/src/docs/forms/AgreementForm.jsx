import { Section, Txt, Area, Sel, Pick, ProjectSelect, days, weeksOpts, planOpts } from "./FormKit.jsx";
import * as PR from "../templates/proposal.js";
import * as AG from "../templates/agreement.js";
import { ROLES } from "../kit.js";
import { money as M } from "../helpers.js";

// Always visible on an agreement.
export function LegalPanel() {
  return (
    <div className="warnbox" style={{ background: "var(--gold-soft)" }}>
      <strong>Template, not legal advice.</strong> I'm not a lawyer. Before you use this with clients, ask a lawyer in Liberia to check these parts:
      <ul>{AG.LEGAL_FLAGS.map((f) => <li key={f}>{f}</li>)}</ul>
    </div>
  );
}

export default function AgreementForm({ ed }) {
  const { d, kit, cur } = ed;
  const props = ed.docs.filter((x) => x.type === "proposal" && (!cur.projectId || x.projectId === cur.projectId));
  const pageNames = [...new Set([...PR.PAGES.map((p) => p[1]), ...(d.pages || [])])].map((n) => [n, n]);
  const featNames = [...new Set([...PR.FEATURES.map((f) => f[1]), ...(d.features || [])])].map((n) => [n, n]);
  const linked = (props.find((x) => x.number === d.proposalNo) || {}).id || "";
  return (
    <>
      <Section id="client" title="Client & proposal" ed={ed}>
        <ProjectSelect ed={ed} />
        <label>Based on proposal
          <select value={linked} onChange={(e) => { ed.T.fromSource(d, e.target.value); ed.touch(); }}>
            {[["", "None (fill in by hand)"], ...props.map((x) => [x.id, `${x.number} · ${x.status || "Draft"} · ${M(x.total)}`])].map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </label>
        <div className="grid2">
          <Txt label="Organization / client" k="org" ed={ed} /><Txt label="Who signs for the client" k="contactName" ed={ed} />
          <Sel label="Their role" k="contactRole" options={[["", "Not needed"], ...ROLES.map((r) => [r, r])]} ed={ed} /><Txt label="Phone / WhatsApp" k="phone" ed={ed} inputMode="tel" />
          <Txt label="Client address (optional)" k="address" ed={ed} /><Txt label="Agreement date" k="date" ed={ed} type="date" />
        </div>
      </Section>
      <Section id="scope" title="Scope of work" ed={ed}>
        <span className="note">Pages</span><Pick arr="pages" items={pageNames} ed={ed} />
        <span className="note">Features</span><Pick arr="features" items={featNames} ed={ed} />
        <Area label="Other deliverables (one per line, optional)" k="extraDeliverables" ed={ed} />
      </Section>
      <Section id="money" title={<>Fees & payment <span className="note num">{M(d.total)}</span></>} ed={ed}>
        <div className="grid2">
          <Txt label="Total fee (USD)" k="total" ed={ed} type="number" min="0" inputMode="decimal" />
          <Sel label="Payment plan" k="plan" options={planOpts(d)} ed={ed} />
          {d.plan === "deposit" && <Sel label="Deposit" k="depositPct" options={[10, 20, 25, 30, 40, 50].map((n) => [n, n + "%"])} ed={ed} />}
          <Sel label="Deposit refund" k="depositTerms" options={[["nonrefundable", "Not refundable once work starts"], ["refundable_before", "Refundable only before work starts"]]} ed={ed} />
          <Sel label="Late payments" k="lateTerms" options={[["pause", "I may pause work"], ["none", "Say nothing"]]} ed={ed} />
          {d.lateTerms === "pause" && <Sel label="Pause after" k="lateDays" options={days([7, 14, 30])} ed={ed} />}
        </div>
      </Section>
      <Section id="time" title="Timeline & client duties" ed={ed}>
        <div className="grid2">
          <Sel label="Project length" k="weeks" options={weeksOpts} ed={ed} /><Sel label="Work starts" k="start" options={PR.START} ed={ed} />
          <Sel label="Client sends content within" k="contentDays" options={days([3, 7, 14])} ed={ed} /><Sel label="Client gives feedback within" k="reviewDays" options={days([2, 3, 5])} ed={ed} />
          <Sel label="Pause project after no reply for" k="pauseDays" options={days([7, 14, 30])} ed={ed} /><Sel label="Either side can end it after a pause of" k="closeDays" options={days([30, 60, 90])} ed={ed} />
        </div>
      </Section>
      <Section id="terms" title="Revisions, ownership & other terms" ed={ed}>
        <div className="grid2">
          <Sel label="Revision rounds" k="revisions" options={[[1, "1 round"], [2, "2 rounds"], [3, "3 rounds"]]} ed={ed} />
          <Txt label="Extra work hourly rate (optional, USD)" k="extraRate" ed={ed} type="number" min="0" inputMode="decimal" placeholder="Leave empty to quote each time" />
          <Sel label="Client owns the work" k="ipTransfer" options={[["full", "Once fully paid"], ["launch", "At launch, once fully paid"]]} ed={ed} />
          <Sel label="Show it in my portfolio" k="portfolio" options={[["yes", "Yes, unless they say no"], ["no", "Don't mention it"]]} ed={ed} />
          <Sel label="Hosting" k="hosting" options={[["client", "Client pays the host"], ["included", "First year included"], ["free", "Free hosting plan"]]} ed={ed} />
          <Sel label="Notice to cancel" k="noticeDays" options={days([7, 14, 30])} ed={ed} />
          <Sel label="Free support after launch" k="supportDays" options={days([14, 30, 60, 90])} ed={ed} />
          <Txt label="Laws of" k="jurisdiction" ed={ed} />
        </div>
      </Section>
    </>
  );
}
