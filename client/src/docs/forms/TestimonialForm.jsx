import { Section, Txt, Area, Pick, ProjectSelect } from "./FormKit.jsx";
import * as TS from "../templates/testimonial.js";

export default function TestimonialForm({ ed }) {
  const { d } = ed;
  return (
    <>
      <Section id="client" title="Who to ask" ed={ed}>
        <ProjectSelect ed={ed} />
        <div className="grid2"><Txt label="Contact person" k="contactName" ed={ed} /><Txt label="Organization / business" k="org" ed={ed} /><Txt label="Project name" k="projectName" ed={ed} /><Txt label="Date asked" k="date" ed={ed} type="date" /></div>
      </Section>
      <Section id="msg" title="Message" ed={ed}>
        <span className="note">Questions to include (optional)</span>
        <Pick arr="questions" items={TS.QUESTIONS} ed={ed} />
        <Txt label="Link to a feedback form (optional)" k="link" ed={ed} inputMode="url" placeholder="e.g. a Google Form link" />
        <label className="incl"><input type="checkbox" checked={!!d.askPermission} onChange={(e) => { d.askPermission = e.target.checked; ed.touch(); }} /> Ask if I can share their words publicly</label>
      </Section>
      <Section id="reply" title="Their reply" ed={ed}>
        <Area label="Paste their testimonial here when it arrives" k="received" ed={ed} />
        <label className="incl"><input type="checkbox" checked={!!d.permission} onChange={(e) => { d.permission = e.target.checked; ed.touch(); }} /> They said I can share it publicly</label>
        <p className="note">Only use it in your portfolio or posts when this box is ticked.</p>
      </Section>
    </>
  );
}

// The "Preview" step for a testimonial request is the two messages, with copy buttons.
export function TestimonialPreview({ ed }) {
  const { d, kit } = ed, m = TS.messages(d, kit.brand());
  return (
    <>
      <section className="card"><div className="sec-head"><h2>WhatsApp message</h2><button className="btn sm" onClick={() => ed.copy(m.whatsapp, "WhatsApp message")}>Copy</button></div><div className="ref-box" style={{ maxHeight: "none", color: "var(--ink)" }}>{m.whatsapp}</div></section>
      <section className="card"><div className="sec-head"><h2>Email</h2><button className="btn sm" onClick={() => ed.copy(`Subject: ${m.email.subject}\n\n${m.email.body}`, "Email")}>Copy</button></div><p className="note"><strong>Subject:</strong> {m.email.subject}</p><div className="ref-box" style={{ maxHeight: "none", color: "var(--ink)" }}>{m.email.body}</div></section>
      {d.received && <section className="card"><h2>Their testimonial</h2><div className="ref-box" style={{ maxHeight: "none", color: "var(--ink)" }}>{d.received}</div><span className={`chip ${d.permission ? "" : "plain"}`}>{d.permission ? "OK to share publicly" : "Keep private: no permission yet"}</span></section>}
    </>
  );
}
