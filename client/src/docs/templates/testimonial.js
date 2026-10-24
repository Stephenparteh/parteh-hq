// Message only: no PDF or Word file.
export const QUESTIONS = [["before", "What made you decide to get a website?"], ["liked", "What did you like most about working with me?"], ["result", "What has changed since the website went live?"], ["recommend", "Would you recommend me to others? Why?"]];

export function messages(d, brand) {
  const first = String(d.contactName || "").trim().split(/\s+/)[0] || "there", me = String(brand.name || "").split(/\s+/)[0] || brand.name;
  const qs = QUESTIONS.filter((q) => (d.questions || []).includes(q[0])).map((q) => q[1]);
  const proj = d.projectName || "your website", biz = (d.org || "").trim();
  const how = (d.link || "").trim() ? `You can reply here, or use this short form: ${d.link.trim()}` : "You can simply reply to this message.";
  const perm = d.askPermission ? "If you're happy for me to share your words, with your name and business, on my website and social media, please let me know. If you'd rather keep it private, that's completely fine." : "";
  const wa = [`Hi ${first}! 👋🏾`, `Thank you again for trusting me with ${proj}${biz ? ` for ${biz}` : ""}. It was a pleasure working with you.`,
    `Would you mind sharing a few honest words about your experience? It really helps my small business grow.${qs.length ? "\n\nYou can answer any of these:\n" + qs.map((q) => "• " + q).join("\n") : ""}`, how, perm, `Thank you! 🙏🏾\n${me}`].filter(Boolean).join("\n\n");
  const em = [`Hi ${first},`, `Thank you again for trusting me with ${proj}${biz ? ` for ${biz}` : ""}. It was a pleasure working with you.`,
    `Would you mind sharing a few honest words about your experience? Your feedback really helps my business grow.${qs.length ? "\n\nYou can answer any of these:\n" + qs.map((q) => "- " + q).join("\n") : ""}`, how, perm, `Thank you,\n${brand.name}\n${brand.title}${brand.phone ? "\n" + brand.phone : ""}${brand.portfolio ? "\n" + brand.portfolio : ""}`].filter(Boolean).join("\n\n");
  return { whatsapp: wa, email: { subject: `A quick favour: your feedback on ${proj}`, body: em } };
}
