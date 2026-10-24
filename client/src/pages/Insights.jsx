import { LAST, MONTHS } from "../constants.js";
import { useData } from "../context/Data.jsx";
import { useCopy } from "../context/Pop.jsx";
import { useToast } from "../context/Toast.jsx";
import { useShowImage } from "../components/ImageView.jsx";
import { paidOf, money, year, safeName } from "../lib/format.js";
import { thanksText } from "../lib/messages.js";
import { makeThanksCard, makeYearCard } from "../lib/cards.js";

export default function Insights() {
  const { projects: all, settings } = useData();
  const copy = useCopy();
  const toast = useToast();
  const showImage = useShowImage();
  const Y = String(year());
  const paidClients = all.filter((p) => p.billing !== "portfolio" && paidOf(p) > 0).length;
  const leads = all.filter((p) => p.billing !== "portfolio").length;
  const earned = all.reduce((a, p) => a + (p.billing !== "portfolio" ? paidOf(p) : 0), 0);
  const months = Array(12).fill(0);
  all.forEach((p) => (p.payments || []).forEach((x) => { if (String(x.date).startsWith(Y)) months[+String(x.date).slice(5, 7) - 1] += +x.amount || 0; }));
  const mmax = Math.max(1, ...months);
  const src = {}; all.forEach((p) => { const k = p.source || "Not set"; src[k] = (src[k] || 0) + 1; });
  const srcRows = Object.entries(src).sort((a, b) => b[1] - a[1]); const smax = Math.max(1, ...srcRows.map((r) => r[1]));
  const refs = {}; all.forEach((p) => { const r = (p.referredBy || "").trim(); if (!r) return; refs[r] = refs[r] || { n: 0, paid: 0 }; refs[r].n++; refs[r].paid += paidOf(p); });
  const refRows = Object.entries(refs).sort((a, b) => b[1].n - a[1].n);

  const thankCard = async (name) => {
    try {
      const { canvas, first } = await makeThanksCard(name, all, settings);
      showImage(canvas, `Thank you ${safeName(first)}.png`, `Thank-you card for ${first}`, "Send it on WhatsApp with a short message, or post it on your status to thank them in public.");
    } catch { toast("Couldn't create the image."); }
  };
  const yearCard = async () => {
    try { showImage(await makeYearCard(all, settings), `${safeName(settings.bizName)} ${Y} in review.png`, `${Y} in review`, "Post it on your WhatsApp status, TikTok and Facebook. Add your number in Settings first so people can reach you."); }
    catch { toast("Couldn't create the image."); }
  };

  return (
    <div className="list">
      <section className="stats">
        <div className="stat"><b className="num">{money(earned)}</b><span>Collected</span></div>
        <div className="stat"><b className="num">{paidClients}</b><span>Paying clients</span></div>
        <div className="stat"><b className="num">{leads ? Math.round(paidClients / leads * 100) : 0}%</b><span>Leads that paid</span></div>
        <div className="stat"><b className="num">{all.filter((p) => p.phase === LAST).length}</b><span>Sites launched</span></div>
      </section>
      <section className="card">
        <div className="sec-head"><h2>Money in by month</h2><span className="note">{Y}</span></div>
        <div className="months">{months.map((m, i) => <div key={i}>{m ? <b>{Math.round(m)}</b> : null}<i style={{ height: `${m ? Math.max(4, m / mmax * 80) : 2}%` }} /><span>{MONTHS[i]}</span></div>)}</div>
        {!earned && <p className="note">Log payments in each project's Money tab and they show up here.</p>}
      </section>
      <section className="card">
        <h2>Where clients come from</h2>
        <div className="hbars">{srcRows.map(([k, n]) => <div className="hbar" key={k}><span>{k}</span><div className="t"><i style={{ width: `${n / smax * 100}%` }} /></div><span className="num">{n}</span></div>)}</div>
        <p className="note">Set the source in each project's Details tab. Post more where the leads come from.</p>
      </section>
      <section className="card">
        <h2>Your promoters</h2>
        {refRows.length ? refRows.map(([name, r]) => (
          <div className="ref" key={name}>
            <div><strong>{name}</strong><div className="note">{r.n} lead{r.n === 1 ? "" : "s"}{r.paid ? ` · ${money(r.paid)} paid` : ""}</div></div>
            <div className="row"><button className="btn sm" onClick={() => thankCard(name)}>Thank-you card</button><button className="btn sm ghost" onClick={() => copy(thanksText(name, settings), "Thank-you")}>Copy message</button></div>
          </div>
        )) : <p className="note">When someone sends you a lead, add their name under “Referred by”. They'll show up here so you can thank them.</p>}
      </section>
      <section className="card">
        <h2>{Y} year in review</h2>
        <p className="note">A shareable card for your WhatsApp status showing everything you built this year.</p>
        <div className="row"><button className="btn" onClick={yearCard}>Create my {Y} card</button></div>
      </section>
    </div>
  );
}
