import { PHASES } from "../constants.js";
import { firstName, totalOf, paidOf, depositOf, pctOf, money, fmtDate, todayStr } from "./format.js";

export function followUpText(p, s) {
  const who = p.contactName || firstName(p.client), nm = p.name, me = s.bizName;
  const map = {
    1: `Hi ${who}, just checking in on the website form I sent for ${nm}. Once you fill it, I'll review your answers and we can move to the next step. Let me know if you need the link again 🙏🏾`,
    3: `Hi ${who}, thanks again for the call! I'm putting your proposal together for ${nm}. Is there anything else you'd like me to include?`,
    4: `Hi ${who}, did you get a chance to look at the proposal for ${nm}? Happy to adjust anything or jump on a quick call to go through it.`,
    5: `Hi ${who}, glad the proposal works for you! I'll send the contract next so we can lock in the scope.`,
    6: `Hi ${who}, just following up on the contract for ${nm}. Once it's signed I'll send the invoice so we can get started.`,
    7: `Hi ${who}, quick reminder about the deposit invoice for ${nm}. As soon as the deposit comes in I'll start on the design 🚀`,
    9: `Hi ${who}, checking in on the content for ${nm} (logo, photos, text). The sooner I get them, the sooner your site goes live!`,
    10: `Hi ${who}, have you had a chance to review the design for ${nm}? Any feedback at all helps me move to the build.`,
    12: `Hi ${who}, have you been able to test the ${nm} site? Send me any changes you'd like and I'll handle them.`,
    13: `Hi ${who}, we're almost live with ${nm}! I just need your go-ahead on the domain and hosting.`,
  };
  return (map[p.phase] || `Hi ${who}, just following up on ${nm}. Let me know when you have a moment to continue.`) + `\n\n— ${me}`;
}

export function updateText(p, s) {
  const done = (p.phase || 0) > 0 ? PHASES[p.phase - 1][1] : "Project started";
  return `Hi ${p.contactName || firstName(p.client)}! Quick update on ${p.name} 👇🏾\n\n✅ Done: ${done}\n🔨 Now: ${PHASES[p.phase || 0][1]}\n⏭️ Next: ${p.nextStep || "I'll keep you posted"}\n📊 Progress: ${pctOf(p)}%\n\n— ${s.bizName}`;
}

export function contentText(p, s) {
  const miss = (p.content || []).filter((c) => !c.done).map((c) => "• " + c.label);
  return `Hi ${p.contactName || firstName(p.client)}! To build ${p.name}, I still need these from you:\n\n${miss.join("\n") || "• Nothing, you're all set 🎉"}\n\nYou can send them here on WhatsApp. Thank you! 🙏🏾\n— ${s.bizName}`;
}

export const thanksText = (name, s) => `Hi ${name}! Thank you so much for sending clients my way 🙏🏾 It really means a lot. If you hear anybody else needing a website or design, please keep calling my name!\n\n— ${s.bizName}`;

export function invoiceText(d, s) {
  const tot = totalOf(d), paid = paidOf(d), dep = depositOf(d, s.depositPct);
  const lines = d.scope.length ? d.scope : [{ item: `${d.type}: ${d.name}`, price: tot }];
  return `INVOICE ${d.invoiceNo || ""}\nFrom: ${s.bizName}${s.phone ? " · " + s.phone : ""}\nTo: ${d.client || d.name}\nDate: ${fmtDate(todayStr())}\n\n${lines.map((l) => `• ${l.item}: ${money(l.price)}`).join("\n")}\n\nTotal: ${money(tot)}\nPaid: ${money(paid)}\n${paid < dep ? `Deposit due now (${d.depositPct}%): ${money(dep - paid)}\n` : ""}Balance: ${money(Math.max(0, tot - paid))}\n${s.payInfo ? `\nHow to pay: ${s.payInfo}\n` : ""}\nWork starts once the deposit is received. Thank you! 🙏🏾`;
}

export function quoteText(q, s) {
  return `Website quote from ${s.bizName} 💻\n\n${q.lines.map((l) => `• ${l.item}: ${money(l.price)}`).join("\n")}\n\nTotal: ${money(q.total)}\nDeposit to start (${s.depositPct}%): ${money(Math.ceil(q.total * s.depositPct / 100))}\n\nReady when you are!`;
}
