export const PHASES = [
  ["lead", "Inquiry received"], ["lead", "Intake Google Form sent"], ["lead", "Form reviewed"], ["lead", "Brief call done"],
  ["deal", "Proposal sent"], ["deal", "Proposal approved"], ["deal", "Contract signed"], ["deal", "Invoice sent"], ["deal", "Deposit paid"],
  ["build", "Content checklist sent"], ["build", "Design sent for review"], ["build", "Development"], ["build", "Client testing & revisions"],
  ["launch", "Domain, hosting & SEO"], ["launch", "Handed over · launched"],
];
export const STAGES = [["lead", "Lead"], ["deal", "Deal"], ["build", "Build"], ["launch", "Launch"]];
export const GATE = 8;
export const LAST = PHASES.length - 1;
export const SOURCES = ["Church", "Referral", "WhatsApp", "TikTok", "Facebook", "Instagram", "Unrish Digital Center", "Other"];
export const DEFAULT_CONTENT = ["Logo (clear, high quality)", "Brand colors", "About us text", "Mission & vision", "Leaders / team photos and bios", "Photos for the website", "Services, ministries or programs", "Contact info: phone, email, address", "Social media links", "Preferred domain name", "Events or news to feature"];
export const DEFAULT_PRICES = {
  base: { "Website": 80, "Graphic design": 25, "Website + branding": 120, "Other": 50 }, page: 20,
  features: [
    { k: "contact", n: "Contact form", p: 15 }, { k: "whatsapp", n: "WhatsApp chat button", p: 5 }, { k: "gallery", n: "Photo gallery", p: 15 },
    { k: "blog", n: "Blog / news section", p: 30 }, { k: "events", n: "Events calendar", p: 25 }, { k: "media", n: "Sermons, music or video page", p: 25 },
    { k: "giving", n: "Online giving / donations", p: 40 }, { k: "admin", n: "Admin dashboard to edit content", p: 60 },
    { k: "seo", n: "SEO setup + Google listing", p: 20 }, { k: "logo", n: "Logo design", p: 30 }, { k: "domain", n: "Domain + hosting, 1st year", p: 35 },
  ],
};
export const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
export const NEXT_STEPS = [
  ["Getting the deal", ["Send the intake Google Form", "Remind the client to fill the Google Form", "Review the client's form answers", "Schedule the brief call", "Send the proposal", "Follow up on the proposal", "Update the proposal with the client's changes", "Send the contract", "Wait for the signed contract", "Send the deposit invoice", "Wait for the deposit"]],
  ["Design", ["Send the content checklist", "Collect content from the client", "Design the UI", "Send the UI design to the client for review", "Get the client's design feedback", "Make the design changes"]],
  ["Build", ["Start the front end", "Finish the front end", "Share the front end with the client for review", "Start the back end", "Finish the back end", "Share the full website with the client for testing", "Fix the client's changes"]],
  ["Launch", ["Buy the domain and set up hosting", "Set up SEO and the Google listing", "Collect the final payment", "Launch the website", "Hand over the website and logins"]],
  ["After launch", ["Request a testimonial", "Post the project on my portfolio and socials", "Send the maintenance offer"]],
];
export const ALL_NEXT = NEXT_STEPS.flatMap((g) => g[1]);
export const WAIT = new Set(["Remind the client to fill the Google Form", "Follow up on the proposal", "Wait for the signed contract", "Wait for the deposit", "Collect content from the client", "Get the client's design feedback", "Collect the final payment"]);
export const SUGGEST = { 0: "Send the intake Google Form", 1: "Remind the client to fill the Google Form", 2: "Schedule the brief call", 3: "Send the proposal", 4: "Follow up on the proposal", 5: "Send the contract", 6: "Send the deposit invoice", 7: "Wait for the deposit", 8: "Send the content checklist", 9: "Design the UI", 10: "Get the client's design feedback", 11: "Start the front end", 12: "Fix the client's changes", 13: "Launch the website", 14: "Request a testimonial" };
