// What the app sends to the AI assistants.

// Bank labels may contain IBANs or long account numbers: they never leave the app.
// IBANs in any case, written in one block or in groups of four, even glued to the previous word.
const IBAN = /[A-Z]{2}\d{2}(?:[A-Z0-9]{11,30}|(?: [A-Z0-9]{4}){2,7}(?: [A-Z0-9]{1,4})?)\b/gi;

export function maskBankDetails(s: string): string {
  return s.replace(IBAN, "[masqué]").replace(/\d{9,}/g, "[masqué]");
}

// One value of the data table: no line breaks, column separators or tags that could
// pass for the end of the data block.
export function dataCell(s: string | null | undefined): string {
  return maskBankDetails((s ?? "").replace(/[\s|<>]+/g, " ").trim());
}

// Past messages are resent to the model: long ones are cut so the cost stays bounded.
export const HISTORY_MAX_CHARS = 4000;
export const clip = (s: string) => (s.length > HISTORY_MAX_CHARS ? `${s.slice(0, HISTORY_MAX_CHARS)}…` : s);
