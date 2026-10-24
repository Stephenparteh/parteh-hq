import { Section, Txt, Area, Sel, Pick, ProjectSelect, days } from "./FormKit.jsx";
import * as HO from "../templates/handover.js";
import { ACCESS, REGISTRARS, HOSTS } from "../kit.js";

export default function HandoverForm({ ed }) {
  const { d } = ed;
  return (
    <>
      <Section id="client" title="Client & dates" ed={ed}>
        <ProjectSelect ed={ed} />
        <div className="grid2">
          <Txt label="Organization / client" k="org" ed={ed} /><Txt label="Contact person" k="contactName" ed={ed} />
          <Txt label="Phone / WhatsApp" k="phone" ed={ed} inputMode="tel" /><Txt label="Launch date" k="launchDate" ed={ed} type="date" /><Txt label="Handover date" k="date" ed={ed} type="date" />
        </div>
      </Section>
      <Section id="site" title="Website & deliverables" ed={ed}>
        <div className="grid2"><Txt label="Live website address" k="siteUrl" ed={ed} inputMode="url" placeholder="https://" /><Txt label="Admin area address (optional)" k="adminUrl" ed={ed} inputMode="url" /></div>
        <Area label="What was delivered (one per line)" k="deliverables" ed={ed} />
      </Section>
      <Section id="access" title="Access & logins" ed={ed}>
        <p className="note">Never type a password here. The app blocks the PDF if it finds one.</p>
        <Sel label="How logins are shared" k="accessMethod" options={ACCESS} ed={ed} />
        <span className="note">Accounts handed over</span>
        <Pick arr="accounts" items={HO.ACCOUNTS.map((a) => [a, a])} ed={ed} />
      </Section>
      <Section id="domain" title="Domain & hosting" ed={ed}>
        <div className="grid2">
          <Txt label="Domain" k="domain" ed={ed} placeholder="e.g. christlife.org" /><Sel label="Registrar" k="registrar" options={REGISTRARS.map((r) => [r, r || "Choose…"])} ed={ed} />
          <Txt label="Domain renews on" k="domainRenew" ed={ed} type="date" /><Sel label="Hosting" k="host" options={HOSTS.map((r) => [r, r || "Choose…"])} ed={ed} />
          <Txt label="Hosting renews on (optional)" k="hostRenew" ed={ed} type="date" /><Sel label="Renewals paid by" k="paidBy" options={["Client", "Stephen (included for now)", "Shared"]} ed={ed} />
        </div>
      </Section>
      <Section id="own" title="Ownership & care" ed={ed}>
        <Sel label="Ownership" k="ownership" options={[["done", "Everything transferred to the client"], ["progress", "Transfer in progress"], ["managed", "I manage some accounts for them"]]} ed={ed} />
        <span className="note">Tips for looking after the site</span>
        <Pick arr="manage" items={HO.MANAGE} ed={ed} />
        <Area label="Known limitations or open items (one per line)" k="limitations" ed={ed} placeholder="Leave empty if there are none" />
      </Section>
      <Section id="support" title="Support & payment" ed={ed}>
        <div className="grid2">
          <Sel label="Free support after launch" k="supportDays" options={days([14, 30, 60, 90])} ed={ed} />
          <Sel label="Maintenance" k="maintenance" options={[["none", "No plan"], ["monthly", "Monthly plan"]]} ed={ed} />
          {d.maintenance === "monthly" && <Txt label="Monthly price (USD)" k="maintenancePrice" ed={ed} type="number" min="0" inputMode="decimal" />}
          <Txt label="Project total (USD)" k="projectTotal" ed={ed} type="number" min="0" inputMode="decimal" />
          <Txt label="Paid so far (USD)" k="paidTotal" ed={ed} type="number" min="0" inputMode="decimal" />
        </div>
        <p className="note">Filled from the project's payments. Check it before sending.</p>
      </Section>
    </>
  );
}
