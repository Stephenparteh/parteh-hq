// A password must never be stored in a handover document. Same rule as the client's check
// (reference/templates2.js): the word "password" (or pin, passcode...) followed by "is <value>", ":" or "=".
const PW_RE = /\b(password|passwd|passcode|pwd|pin)\b\s*(is\s+\S|[:=])/i;

export const handoverHasPassword = (data) => PW_RE.test(JSON.stringify(data ?? {}));
