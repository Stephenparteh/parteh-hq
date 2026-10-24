// Renders every document type (PDF and Word) from sample data into client/samples/.
// Run: npm run samples. The files hold only made-up sample data. The folder is git-ignored.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createKit } from "../src/docs/kit.js";
import { setFontData, ensureLibs, toPdf, toDocx } from "../src/docs/engine.js";
import { withDefaults } from "../src/lib/format.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "samples");
mkdirSync(out, { recursive: true });

const fontFiles = ["Poppins-SemiBold", "Poppins-Medium", "Inter-Regular", "Inter-SemiBold"];
const fonts = {};
for (const k of fontFiles) { const b = readFileSync(join(root, "public", "fonts", `${k}.ttf`)); fonts[k] = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
setFontData(fonts);
await ensureLibs(true);

const settings = withDefaults({ payInfo: "Orange Money: 0770 000 000 (Stephen Parteh)\nBank transfer: ask for the details", about: "" });
const project = {
  id: "p1", name: "Christ Life Pentecostal Church website", client: "Christ Life Pentecostal Church of Monrovia", contactName: "Pastor Joseph Kollie", contact: "0770 000 001", type: "Website", billing: "paid",
  phase: 8, waitingOn: "me", status: "active", depositPct: 30, startDate: "2026-02-02",
  scope: [{ item: "Website: design & build (home page)", price: 80 }, { item: "4 extra pages", price: 80 }, { item: "Contact form", price: 15 }, { item: "Photo gallery", price: 15 }, { item: "Events calendar", price: 25 }, { item: "Church / nonprofit discount (−15%)", price: -32 }],
  payments: [{ id: "pay_1", date: "2026-02-10", amount: 54, note: "Deposit", method: "Orange Money", receiptNo: "RCT-2026-001" }], content: [],
};
const docs = [];
const kit = createKit(() => ({ projects: [project], docs, settings }));

const build = (type, pid, opts, edit) => {
  const doc = kit.TY[type].make(pid, opts);
  if (edit) edit(doc.data);
  doc.number = `${kit.TY[type].prefix}-2026-001`; doc.data.number = doc.number; doc.id = "x";
  return doc;
};

const proposal = build("proposal", "p1", {}, (d) => {
  d.goals = ["credibility", "info", "contact", "donations", "events", "media"]; d.pages = ["home", "about", "ministries", "events", "media", "give", "contact"].map(kit.pagePreset);
  d.features = ["mobile", "speed", "social", "contact", "whatsapp", "gallery", "events", "giving", "admin", "seo"]; d.contactRole = "Pastor"; d.phone = "0770 000 001";
  d.goalNote = "We want our members abroad to follow our services and give online."; d.maintenance = "offer"; d.maintenancePrice = 15; d.domainName = "christlife.org"; d.status = "Sent";
});
docs.push({ ...proposal, status: "Accepted", updatedAt: "2026-01-20T10:00:00Z" });

const SAMPLES = {
  "01-proposal": proposal,
  "02-invoice-deposit": build("invoice", "p1", { kind: "deposit" }, (d) => { d.date = "2026-02-02"; d.email = "office@christlife.example"; }),
  "03-receipt": build("receipt", "p1", { payRef: "pay_1", invoiceNo: "INV-2026-001" }, (d) => { d.confirmed = true; d.method = "Orange Money"; d.txRef = "OM-883920"; }),
  "04-agreement": build("agreement", "p1", {}, (d) => { d.address = "Broad Street, Monrovia"; d.extraRate = 10; }),
  "05-timeline": build("timeline", "p1", {}, (d) => { d.startDate = "2026-03-02"; d.hasBack = "1"; kit.regenRows(d); d.rows[0].status = "Done"; d.rows[1].status = "In progress"; }),
  "06-content": build("content", "p1", {}, (d) => { d.items[0].status = "rec"; d.items[2].status = "ok"; }),
  "07-revision": build("revision", "p1", {}, (d) => {
    d.requests = [{ date: "2026-03-20", page: "Home", desc: "Make the logo bigger and change the banner photo.", scope: "in", round: "1", status: "Done", cost: "", impact: "No delay" },
      { date: "2026-03-22", page: "Events", desc: "Add an online registration form for the youth conference.", scope: "extra", round: "1", status: "Approved", cost: 25, impact: "+2–3 days" },
      { date: "2026-03-25", page: "Whole website", desc: "Add a Spanish version of every page.", scope: "extra", round: "1", status: "New", cost: "", impact: "+1 week" }];
  }),
  "08-handover": build("handover", "p1", {}, (d) => { d.siteUrl = "https://christlife.org"; d.adminUrl = "https://christlife.org/admin"; d.domain = "christlife.org"; d.registrar = "Namecheap"; d.domainRenew = "2027-02-10"; d.host = "Vercel"; d.limitations = "Online giving works with PayPal only for now.\nThe events calendar needs the church to add events monthly."; d.accounts = ["Website admin dashboard", "Domain registrar account", "Hosting account"]; }),
  // stress cases
  "09-invoice-40-items": build("invoice", "", {}, (d) => {
    d.org = "A Very Long Organisation Name That Keeps Going: The Association of Churches, Schools and Community Groups of Greater Monrovia and Its Surroundings";
    d.contactName = "Reverend Doctor Josephine Wleh-Kollie-Johnson"; d.projectName = "Averyveryveryverylongprojectnamewithoutanyspaces-https://example.com/a/very/long/link/that/should/wrap/nicely";
    d.items = Array.from({ length: 44 }, (_, i) => ({ desc: `Item ${i + 1}: ${i % 5 === 0 ? "A longer description that needs to wrap onto a second line in the table so we can see how rows break across pages" : "Page design and build"}`, qty: (i % 4) + 1, rate: 12.5 + i }));
    d.discType = "percent"; d.discValue = 10; d.taxOn = "1"; d.taxPct = 5; d.taxLabel = "GST"; d.paidBefore = 100; d.kind = "additional";
  }),
  "10-empty-proposal": build("proposal", "", {}, () => { }),
  "11-empty-invoice": build("invoice", "", {}, (d) => { d.date = ""; }),
  "12-empty-receipt": build("receipt", "", {}, (d) => { d.date = ""; }),
  "13-emoji-and-special": build("proposal", "", {}, (d) => { d.org = "Café Ñandú & Sons <Ltd> 😀🙏🏾"; d.contactName = "Zoë O’Brien"; d.goalNote = "We want “quotes”, ampersands & <tags>, emoji 🎉 and accents: é à ü."; d.items = [{ item: "Site 💻", price: 100 }]; d.date = ""; }),
};

for (const [name, doc] of Object.entries(SAMPLES)) {
  const T = kit.TY[doc.type];
  const model = T.build(doc.data, doc);
  const { pdf, pageCount } = toPdf(model);
  writeFileSync(join(out, `${name}.pdf`), Buffer.from(pdf.output("arraybuffer")));
  const docx = await toDocx(model);
  const bytes = docx instanceof Blob ? Buffer.from(await docx.arrayBuffer()) : docx;
  writeFileSync(join(out, `${name}.docx`), bytes);
  console.log(`${name}: ${pageCount} page${pageCount === 1 ? "" : "s"} · docx ${(bytes.length / 1024).toFixed(0)} KB`);
}
console.log(`Saved to ${out}`);
