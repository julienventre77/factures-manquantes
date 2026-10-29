// What the app sends to the AI assistants.

// Bank labels may contain IBANs or long account numbers: they never leave the app.
// IBAN-like run, in any case: in one block or grouped with single spaces or dashes
// (groups of 4, French RIB layout…), even glued to the previous word.
const IBAN_LIKE = /[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){11,30}/gi;
const TRAILING_WORD = /[ -][A-Z]+$/i;

// The run may have swallowed the words that follow the IBAN ("… 189 LOYER MARS"):
// they are kept, and what is left is masked if it is long enough for an IBAN (15 characters).
function maskIban(run: string): string {
  let iban = run;
  let rest = "";
  for (let m = TRAILING_WORD.exec(iban); m; m = TRAILING_WORD.exec(iban)) {
    rest = m[0] + rest;
    iban = iban.slice(0, m.index);
  }
  return iban.replace(/[ -]/g, "").length >= 15 ? `[masqué]${rest}` : run;
}

export function maskBankDetails(s: string): string {
  return s.replace(IBAN_LIKE, maskIban).replace(/\d{9,}/g, "[masqué]");
}

// One value of the data table: no line breaks, column separators or tags that could
// pass for the end of the data block.
export function dataCell(s: string | null | undefined): string {
  return maskBankDetails((s ?? "").replace(/[\s|<>]+/g, " ").trim());
}

// Past messages are resent to the model: long ones are cut so the cost stays bounded.
export const HISTORY_MAX_CHARS = 4000;
// Cut on a character boundary: half an emoji would make the request invalid.
export function clip(s: string): string {
  if (s.length <= HISTORY_MAX_CHARS) return s;
  const cut = s.slice(0, HISTORY_MAX_CHARS);
  return `${/[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut}…`;
}
