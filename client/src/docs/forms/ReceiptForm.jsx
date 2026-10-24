import { Section, Txt, Sel, ProjectSelect } from "./FormKit.jsx";
import * as RC from "../templates/receipt.js";
import { METHODS } from "../kit.js";
import { money as M, r2 } from "../helpers.js";
import { fmtDate } from "../../lib/format.js";

export default function ReceiptForm({ ed }) {
  const { d, kit, cur } = ed, p = kit.proj(cur.projectId), pays = kit.projPays(p);
  const payOpts = [...pays.map((x, i) => [kit.payKey(x, i), `${x.date ? fmtDate(x.date) + " · " : ""}${M(x.amount)} · ${x.note || "Payment"}${x.receiptNo ? ` (receipt ${x.receiptNo})` : ""}`]), ["new", "Record a new payment"]];
  const invs = ed.docs.filter((x) => x.type === "invoice" && x.status !== "Cancelled" && (!cur.projectId || x.projectId === cur.projectId));
  kit.prepReceipt(d, cur.projectId);
  const bal = r2(Math.max(0, d.projectTotal - d.paidToDate));

  return (
    <>
      <Section id="client" title="Payment" ed={ed}>
        <ProjectSelect ed={ed} />
        {p && (
          <>
            <label>Which payment?
              <select value={d.payRef} onChange={(e) => { kit.fillReceiptFromPayment(d, cur.projectId, e.target.value); ed.touch(); }}>
                {payOpts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            {d.payRef === "new" && <p className="note">Saving this receipt adds the payment to the project, so your money total updates too.</p>}
          </>
        )}
        <div className="grid2">
          <Txt label="Amount received (USD)" k="amount" ed={ed} type="number" min="0" inputMode="decimal" />
          <Txt label="Payment date" k="date" ed={ed} type="date" />
          <Sel label="Payment method" k="method" options={[["", "Choose…"], ...METHODS]} ed={ed} />
          <Txt label="Transaction ID (optional)" k="txRef" ed={ed} placeholder="From the SMS or bank slip" />
          <Sel label="For invoice" k="invoiceNo" options={[["", "No invoice"], ...invs.map((x) => [x.number, `${x.number} · ${M(x.total)}`])]} ed={ed} />
        </div>
        <div className="sumbox" id="d-sum">
          {!(+d.projectTotal > 0)
            ? <><span>Amount received</span><span className="num tot">{M(d.amount)}</span></>
            : <><span>Project total</span><span className="num">{M(d.projectTotal)}</span><span>Paid to date (with this payment)</span><span className="num">{M(d.paidToDate)}</span><span className="tot">Balance remaining</span><span className="num tot">{bal > 0 ? M(bal) : "Paid in full"}</span></>}
        </div>
      </Section>
      <Section id="from" title="Received from" ed={ed}>
        <div className="grid2"><Txt label="Organization / client" k="org" ed={ed} /><Txt label="Contact person" k="contactName" ed={ed} /><Txt label="Phone / WhatsApp" k="phone" ed={ed} inputMode="tel" /></div>
      </Section>
      <Section id="details" title="Receipt details" ed={ed}>
        <div className="grid2"><Sel label="Type of payment" k="payType" options={Object.entries(RC.TYPES)} ed={ed} /></div>
        <Txt label="Description" k="description" ed={ed} />
        <div className="row"><button className="btn sm ghost" type="button" onClick={() => { kit.guessReceipt(d, cur.projectId); ed.touch(); }}>Suggest type and description</button></div>
      </Section>
      <label className="confirm">
        <input type="checkbox" checked={!!d.confirmed} onChange={(e) => { d.confirmed = e.target.checked; ed.touch(); }} />
        <span>I confirm I have received this money.<br /><span className="note" style={{ fontWeight: 400 }}>A receipt is proof of payment. Only create one after the money is in your hand or account.</span></span>
      </label>
    </>
  );
}
