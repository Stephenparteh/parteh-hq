import { Section, Txt, Area, Sel, Pick, ProjectSelect } from "./FormKit.jsx";
import * as IN from "../templates/invoice.js";
import { KIND_OPTS, MILESTONES } from "../kit.js";
import { money as M } from "../helpers.js";

export function InvoiceTotals({ d }) {
  const t = IN.totals(d);
  return (
    <>
      <span>Subtotal</span><span className="num">{M(t.sub)}</span>
      {t.disc ? <><span>Discount</span><span className="num">{M(-t.disc)}</span></> : null}
      {t.tax ? <><span>{d.taxLabel || "Tax"}</span><span className="num">{M(t.tax)}</span></> : null}
      {t.paid ? <><span>Total</span><span className="num">{M(t.total)}</span><span>Already paid</span><span className="num">{M(-t.paid)}</span></> : null}
      <span className="tot">Amount due</span><span className="num tot">{M(t.due)}</span>
    </>
  );
}

export default function InvoiceForm({ ed }) {
  const { d, kit, cur } = ed, p = kit.proj(cur.projectId), t = IN.totals(d);
  const refill = () => kit.fillInvoice(d, cur.projectId);
  const months = [-1, 0, 1, 2, 3].map((o) => kit.monthLabel(o));
  const P = kit.pricesOf();
  const priceList = [];
  Object.entries(P.base || {}).forEach(([k, v]) => priceList.push([`base:${k}`, `${k}: design & build (home page) · $${v}`]));
  priceList.push(["page", `Extra page · $${P.page}`]);
  (P.features || []).forEach((f) => priceList.push([`f:${f.k}`, `${f.n} · $${f.p}`]));
  priceList.push(["custom", "Custom item (type it)"]);
  const addFromList = (v) => {
    if (!v) return;
    const add = (desc, price) => d.items.push({ desc, qty: 1, rate: price });
    if (v.startsWith("base:")) { const k = v.slice(5); add(`${k}: design & build (home page)`, +P.base[k] || 0); }
    else if (v === "page") add("Extra page", +P.page || 0);
    else if (v.startsWith("f:")) { const f = P.features.find((x) => x.k === v.slice(2)); if (f) add(f.n, +f.p || 0); }
    else add("", 0);
    ed.touch();
  };
  const num = (e) => (e.target.value === "" ? "" : +e.target.value);

  return (
    <>
      <Section id="client" title="Invoice type & project" ed={ed}>
        <label>What is this invoice for?
          <select value={d.kind} onChange={(e) => { d.kind = e.target.value; kit.fillInvoice(d, cur.projectId); ed.touch(); ed.toast("Items filled in for this type of invoice"); }}>
            {KIND_OPTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </label>
        <ProjectSelect ed={ed} />
        {p && <p className="note">Project total {M(kit.projTotal(p))} · Paid so far {M(kit.projPaid(p))}{kit.projTotal(p) ? "" : " · Add the price in the project's Money tab to fill amounts for you."}</p>}
        {d.kind === "milestone" && <div className="grid2"><Sel label="Milestone" k="milestone" options={MILESTONES} ed={ed} refill={refill} /><Sel label="Share of project" k="milestonePct" options={[20, 25, 30, 40, 50, 60].map((n) => [n, n + "%"])} ed={ed} refill={refill} /></div>}
        {d.kind === "maintenance" && <div className="grid2"><Sel label="Month" k="month" options={months} ed={ed} refill={refill} /><Txt label="Monthly price (USD)" k="monthlyPrice" ed={ed} type="number" min="0" inputMode="decimal" refill={refill} /></div>}
        <div className="grid2">
          <Txt label="Issue date" k="date" ed={ed} type="date" />
          <Sel label="Payment due" k="dueDays" options={[[0, "Due on receipt"], [3, "In 3 days"], [7, "In 7 days"], [14, "In 14 days"], [30, "In 30 days"]]} ed={ed} />
        </div>
      </Section>
      <Section id="billto" title="Bill to" ed={ed}>
        <div className="grid2">
          <Txt label="Organization / client" k="org" ed={ed} /><Txt label="Contact person" k="contactName" ed={ed} />
          <Txt label="Phone / WhatsApp" k="phone" ed={ed} inputMode="tel" /><Txt label="Email (optional)" k="email" ed={ed} inputMode="email" />
        </div>
        <Txt label="Address (optional)" k="address" ed={ed} />
      </Section>
      <Section id="items" title={<>Items <span className="note num" id="d-total">{M(t.due)}</span></>} ed={ed}>
        <div className="it3"><span className="it3-h">Description</span><span className="it3-h">Qty</span><span className="it3-h">Rate $</span><span /></div>
        {(d.items || []).map((l, i) => (
          <div className="it3" key={i}>
            <input aria-label="Description" placeholder="What it's for" value={l.desc} onChange={(e) => { l.desc = e.target.value; ed.touch(); }} />
            <input aria-label="Quantity" type="number" min="0" inputMode="decimal" value={l.qty} onChange={(e) => { l.qty = num(e); ed.touch(); }} />
            <input aria-label="Rate" type="number" inputMode="decimal" value={l.rate} onChange={(e) => { l.rate = num(e); ed.touch(); }} />
            <button className="rm" aria-label="Remove item" onClick={() => { d.items.splice(i, 1); ed.touch(); }}>×</button>
          </div>
        ))}
        {!(d.items || []).length && <p className="note">No items yet.</p>}
        <label>Add from your price list
          <select value="" onChange={(e) => addFromList(e.target.value)}><option value="">Choose an item…</option>{priceList.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
        </label>
        <div className="sumbox" id="d-sum"><InvoiceTotals d={d} /></div>
      </Section>
      <Section id="disc" title="Discount & tax" ed={ed}>
        <div className="grid2">
          <Sel label="Discount" k="discType" options={[["none", "No discount"], ["percent", "Percent (%)"], ["amount", "Amount ($)"]]} ed={ed} />
          {d.discType !== "none" && <Txt label={d.discType === "percent" ? "Discount %" : "Discount $"} k="discValue" ed={ed} type="number" min="0" inputMode="decimal" />}
          <Sel label="Tax" k="taxOn" options={[["", "No tax"], ["1", "Add tax"]]} ed={ed} />
          {d.taxOn && <><Txt label="Tax name" k="taxLabel" ed={ed} /><Txt label="Tax %" k="taxPct" ed={ed} type="number" min="0" inputMode="decimal" /></>}
        </div>
        <p className="note">Only add tax if you are registered to charge it.</p>
      </Section>
      <Section id="paid" title="Payments" ed={ed}>
        <Txt label="Already paid toward this invoice (USD)" k="paidBefore" ed={ed} type="number" min="0" inputMode="decimal" />
        <p className="note">{d.kind === "final" ? "Filled from the payments logged on the project. Check it matches what you've received." : "Leave at 0 unless the client already paid part of this invoice."}</p>
        <label className="incl"><input type="checkbox" checked={!!d.showSummary} onChange={(e) => { d.showSummary = e.target.checked; ed.touch(); }} /> Show project total and balance on the invoice</label>
      </Section>
      <Section id="notes" title="Notes" ed={ed}>
        <Pick arr="notes" items={IN.NOTES} ed={ed} />
        <Area label="Extra note (optional)" k="customNote" ed={ed} />
        {ed.settings.payInfo ? <p className="note">Payment instructions come from Settings: {ed.settings.payInfo}</p> : <p className="note">Add how clients pay you in Settings. It will show on every invoice.</p>}
      </Section>
    </>
  );
}
