import { Section, Txt, Area, Sel, Incl, Pick, ProjectSelect, days, weeksOpts, planOpts } from "./FormKit.jsx";
import * as PR from "../templates/proposal.js";
import { SITE_TYPES, INDUSTRY, ROLES, sumItems } from "../kit.js";
import { money as M } from "../helpers.js";

export default function ProposalForm({ ed }) {
  const { d, kit, cur } = ed, p = kit.proj(cur.projectId), total = sumItems(d);
  const P = kit.pricesOf();
  const priceList = [];
  Object.entries(P.base || {}).forEach(([k, v]) => priceList.push([`base:${k}`, `${k}: design & build (home page) · $${v}`]));
  priceList.push(["page", `Extra page · $${P.page}`]);
  (P.features || []).forEach((f) => priceList.push([`f:${f.k}`, `${f.n} · $${f.p}`]));
  priceList.push(["disc15", "Church / nonprofit discount (−15%)"], ["custom", "Custom item (type it)"]);

  const addFromList = (v) => {
    if (!v) return;
    const add = (item, price) => d.items.push({ item, price });
    if (v.startsWith("base:")) { const k = v.slice(5); add(`${k}: design & build (home page)`, +P.base[k] || 0); }
    else if (v === "page") add("Extra page", +P.page || 0);
    else if (v.startsWith("f:")) { const f = P.features.find((x) => x.k === v.slice(2)); if (f) add(f.n, +f.p || 0); }
    else if (v === "disc15") { const sub = d.items.filter((l) => +l.price > 0).reduce((s, l) => s + (+l.price), 0); add("Church / nonprofit discount (−15%)", -Math.round(sub * 0.15)); }
    else add("", 0);
    ed.touch();
  };
  const togglePage = (k, on) => {
    const i = d.pages.findIndex((x) => x.key === k);
    if (on && i < 0) { const order = PR.PAGES.map((x) => x[0]); d.pages.push(kit.pagePreset(k)); d.pages.sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99)); }
    if (!on && i >= 0) d.pages.splice(i, 1);
    ed.touch();
  };
  let newPage = "";

  return (
    <>
      <Section id="client" title="Project & client" ed={ed}>
        <ProjectSelect ed={ed} />
        {p && p.brief && <div><span className="eyebrow">Their form answers (from the project)</span><div className="ref-box">{p.brief}</div></div>}
        <div className="grid2">
          <Txt label="Organization / client" k="org" ed={ed} placeholder="e.g. Christ Life" />
          <Sel label="Type of client" k="industry" options={[["", "Choose…"], ...INDUSTRY]} ed={ed} />
          <Txt label="Contact person" k="contactName" ed={ed} />
          <Sel label="Their role" k="contactRole" options={[["", "Not needed"], ...ROLES]} ed={ed} />
          <Txt label="Phone / WhatsApp" k="phone" ed={ed} inputMode="tel" />
          <Txt label="Email (optional)" k="email" ed={ed} inputMode="email" />
          <Sel label="Website type" k="siteType" options={SITE_TYPES} ed={ed} />
          <Txt label="Proposal date" k="date" ed={ed} type="date" />
          <Sel label="Valid for" k="validDays" options={[[7, "7 days"], [14, "14 days"], [30, "30 days"]]} ed={ed} />
        </div>
      </Section>
      <Section id="goals" title="Goals" ed={ed}>
        <span className="note">What should the website help them do?</span>
        <Pick arr="goals" items={PR.GOALS} ed={ed} />
        <Area label="In the client's words (optional)" k="goalNote" ed={ed} placeholder="Copy one sentence from their form, if it helps" />
      </Section>
      <Section id="pages" title={<>Pages <span className="note num">{d.pages.length}</span></>} ed={ed}>
        <span className="note">Tap to add or remove a page. You can edit what each page is for.</span>
        <div className="pick">
          {PR.PAGES.map(([k, n]) => <label key={k}><input type="checkbox" checked={d.pages.some((x) => x.key === k)} onChange={(e) => togglePage(k, e.target.checked)} />{n}</label>)}
        </div>
        {d.pages.map((pg, i) => (
          <div className="pg" key={pg.key}>
            <div className="pg-h"><span>{pg.name}</span>{pg.key.startsWith("custom") && <button className="rm" aria-label="Remove page" onClick={() => { d.pages.splice(i, 1); ed.touch(); }}>×</button>}</div>
            <textarea aria-label={`${pg.name} purpose`} value={pg.purpose} onChange={(e) => { pg.purpose = e.target.value; ed.touch(); }} />
          </div>
        ))}
        <div className="it" style={{ gridTemplateColumns: "1fr auto" }}>
          <input placeholder="Other page name" aria-label="Other page name" defaultValue="" onChange={(e) => { newPage = e.target.value; }} id="d-newpage" />
          <button className="btn sm ghost" onClick={() => {
            const el = document.getElementById("d-newpage"), n = (el.value || newPage || "").trim();
            if (!n) { ed.toast("Type the page name first"); return; }
            d.pages.push({ key: "custom-" + Date.now(), name: n, purpose: "" }); el.value = ""; ed.touch();
          }}>Add page</button>
        </div>
      </Section>
      <Section id="features" title="Features" ed={ed}>
        <Pick arr="features" items={PR.FEATURES} ed={ed} />
        {(d.extraFeatures || []).map((f, i) => (
          <div className="it" style={{ gridTemplateColumns: "1fr 36px" }} key={i}>
            <input aria-label="Extra feature" value={f} onChange={(e) => { d.extraFeatures[i] = e.target.value; ed.touch(); }} />
            <button className="rm" aria-label="Remove" onClick={() => { d.extraFeatures.splice(i, 1); ed.touch(); }}>×</button>
          </div>
        ))}
        <div className="row"><button className="btn sm ghost" onClick={() => { (d.extraFeatures = d.extraFeatures || []).push(""); ed.touch(); }}>+ Other feature</button></div>
      </Section>
      <Section id="design" title="Design direction" ed={ed}>
        <Incl k="design" ed={ed} />
        <div className="grid2"><Sel label="Style" k="style" options={PR.DESIGN} ed={ed} /><Txt label="Colors (optional)" k="colors" ed={ed} placeholder="e.g. blue and gold from their logo" /></div>
        <Txt label="Design references (optional)" k="references" ed={ed} placeholder="Websites they like" />
      </Section>
      <Section id="domain" title="Domain, hosting & email" ed={ed}>
        <Incl k="domain" ed={ed} />
        <div className="grid2">
          <Sel label="Domain" k="domain" options={[["register", "I register it in the client's name"], ["client", "Client already owns one"], ["help", "Client buys it, I guide them"], ["none", "Leave out"]]} ed={ed} />
          <Txt label="Preferred domain (optional)" k="domainName" ed={ed} placeholder="e.g. christlife.org" />
          <Sel label="Hosting" k="hosting" options={[["client", "Client pays the host directly"], ["included", "First year included in price"], ["free", "Free hosting plan"], ["none", "Leave out"]]} ed={ed} />
          <Sel label="Business email" k="bizEmail" options={[["none", "Not included"], ["setup", "I set it up"], ["addon", "Optional add-on"]]} ed={ed} />
        </div>
      </Section>
      <Section id="timeline" title="Timeline" ed={ed}>
        <Incl k="timeline" ed={ed} />
        <div className="grid2">
          <Sel label="Project length" k="weeks" options={weeksOpts} ed={ed} />
          <Sel label="Work starts" k="start" options={PR.START} ed={ed} />
          <Sel label="Client sends feedback within" k="reviewDays" options={days([2, 3, 5])} ed={ed} />
        </div>
        <span className="note">The week-by-week table is created for you from the project length.</span>
      </Section>
      <Section id="support" title="Revisions & support" ed={ed}>
        <Incl k="support" ed={ed} />
        <div className="grid2">
          <Sel label="Revision rounds" k="revisions" options={[[1, "1 round"], [2, "2 rounds"], [3, "3 rounds"]]} ed={ed} />
          <Sel label="Free support after launch" k="supportDays" options={days([14, 30, 60, 90])} ed={ed} />
          <Sel label="Monthly maintenance" k="maintenance" options={[["none", "Don't offer"], ["offer", "Offer a monthly plan"]]} ed={ed} />
          {d.maintenance === "offer" && <Txt label="Monthly price (USD)" k="maintenancePrice" ed={ed} type="number" min="0" inputMode="decimal" />}
        </div>
      </Section>
      <Section id="money" title={<>Investment <span className="note num" id="d-total">{M(total)}</span></>} ed={ed}>
        {(d.items || []).map((l, i) => (
          <div className="it" key={i}>
            <input aria-label="Item" value={l.item} onChange={(e) => { l.item = e.target.value; ed.touch(); }} />
            <input aria-label="Price" type="number" inputMode="decimal" value={l.price} onChange={(e) => { l.price = e.target.value === "" ? 0 : +e.target.value; ed.touch(); }} />
            <button className="rm" aria-label="Remove item" onClick={() => { d.items.splice(i, 1); ed.touch(); }}>×</button>
          </div>
        ))}
        {!(d.items || []).length && <p className="note">No items yet.</p>}
        <div className="grid2">
          <label>Add from your price list
            <select value="" onChange={(e) => addFromList(e.target.value)}><option value="">Choose an item…</option>{priceList.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
          </label>
          {p && <label>&nbsp;<button className="btn sm ghost" type="button" onClick={() => {
            const it = kit.itemsFromProject(p);
            if (!it.length) { ed.toast("That project has no price yet. Add it in the project's Money tab."); return; }
            d.items = it; ed.touch();
          }}>Use the project's price</button></label>}
        </div>
        <div className="tot-line"><span>Total</span><span className="num" id="d-total2">{M(total)}</span></div>
        <div className="grid2">
          <Sel label="Payment plan" k="plan" options={planOpts(d)} ed={ed} />
          {d.plan === "deposit" && <Sel label="Deposit" k="depositPct" options={[10, 20, 25, 30, 40, 50].map((n) => [n, n + "%"])} ed={ed} />}
        </div>
        {!ed.settings.payInfo && <p className="note">Tip: add how clients pay you in Settings and it will show on the proposal.</p>}
      </Section>
      <Section id="about" title="About you" ed={ed}>
        <Incl k="about" ed={ed} />
        <p className="note">Uses the “About me” text from Settings.</p>
      </Section>
    </>
  );
}
