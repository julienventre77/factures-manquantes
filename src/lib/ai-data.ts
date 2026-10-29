// What the app sends to the AI assistants.

// Bank labels may contain IBANs or account numbers: they never leave the app.
const MASK = "[masqué]";

// IBAN length by country, from the SWIFT IBAN registry (ISO 13616), release 103 of September 2026.
// prettier-ignore
const IBAN_LENGTH: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27, BR: 29, BY: 28, CH: 21, CR: 22,
  CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FK: 18, FO: 18, FR: 27, GB: 22,
  GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HN: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30,
  KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MN: 20,
  MR: 27, MT: 31, MU: 30, NI: 28, NL: 18, NO: 15, OM: 23, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22,
  RU: 33, SA: 24, SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26,
  UA: 29, VA: 22, VG: 24, XK: 20, YE: 30,
};

// ISO 13616 check: with the first four characters moved to the end and letters read as numbers
// (A = 10 … Z = 35), a valid IBAN leaves 1 when divided by 97.
function validIban(iban: string): boolean {
  let rest = 0;
  for (const ch of iban.slice(4) + iban.slice(0, 4)) {
    const code = ch.charCodeAt(0);
    rest = code >= 65 ? (rest * 100 + code - 55) % 97 : (rest * 10 + code - 48) % 97;
  }
  return rest === 1;
}

type Span = [number, number];
// Where an IBAN can start: country code and check digits. Two of them never overlap.
const COUNTRY_AND_KEY = /[A-Z]{2}\d{2}/gi;
const ALNUM = /[A-Z0-9]/i;
// Where the French RIB layout puts its spaces: after the check digits, the bank, the branch and the account.
const RIB_GAPS = [4, 9, 14, 25];

// IBANs read at their country's exact length, in any case, even glued to the previous word, with single
// spaces, dashes or dots. Each start is read on its own, so a false start just before an IBAN cannot hide it.
// Masked: a valid IBAN in one block, by groups of 4 or in the French RIB layout, even glued to the next
// word; a valid IBAN with other spacing (national layouts, typing slips) that ends a word and holds no
// word of letters, except a bank code of up to 4 letters after the check digits (GB29 NWBK 601613…);
// and a mistyped IBAN printed by groups of 4 that ends a word, with at least 8 digits after the check digits.
function ibanSpans(s: string): Span[] {
  const spans: Span[] = [];
  for (const m of s.matchAll(COUNTRY_AND_KEY)) {
    const length = IBAN_LENGTH[m[0].slice(0, 2).toUpperCase()];
    if (!length) continue;
    let iban = "";
    const gaps: number[] = [];
    let i = m.index;
    while (iban.length < length && i < s.length) {
      const c = s[i] ?? "";
      if (ALNUM.test(c)) iban += c.toUpperCase();
      else if (" -.".includes(c) && ALNUM.test(s[i + 1] ?? "")) gaps.push(iban.length);
      else break;
      i++;
    }
    if (iban.length < length) continue;
    const endsWord = !ALNUM.test(s[i] ?? "");
    const layout = gaps.every((g) => g % 4 === 0) || gaps.every((g) => RIB_GAPS.includes(g));
    const bounds = [0, ...gaps, length];
    const words = bounds.slice(1).map((to, k) => iban.slice(bounds[k], to));
    const noWord = words.every((w, k) => !/^[A-Z]+$/.test(w) || (k === 1 && w.length <= 4));
    const byFours =
      gaps.length === Math.ceil(length / 4) - 1 && gaps.every((g, k) => g === 4 * (k + 1));
    const digits = iban.slice(4).match(/\d/g)?.length ?? 0;
    if (validIban(iban) ? layout || (endsWord && noWord) : byFours && endsWord && digits >= 8)
      spans.push([m.index, i]);
  }
  return spans;
}

// IBANs that fail the check (cut or mistyped), not right after a digit: in one block, by groups of 4
// or in the French RIB layout. After the first group (which may be a bank code, such as NWBK), each
// group holds a digit.
const IBAN_LIKE = new RegExp(
  "(?<![0-9])[A-Z]{2}\\d{2}(?:" +
    "[A-Z0-9]{11,30}" +
    "|[ .-]\\d{5}[ .-]\\d{5}(?:[ .-](?=[A-Z]*\\d)[A-Z0-9]{1,11}(?:[ .-]\\d{2})?)?" +
    "|[ .-][A-Z0-9]{4}(?:[ .-](?=[A-Z]{0,3}\\d)[A-Z0-9]{4}){1,6}(?:[ .-](?=[A-Z]{0,2}\\d)[A-Z0-9]{1,3})?" +
    ")(?![A-Z0-9])",
  "iy",
);
// A run is masked when at least 8 digits follow the check digits, or 7 after a bank code in letters
// (an IBAN cut at 15 characters, such as NL91ABNA0417164). When its first two letters are no IBAN
// country (mistyped, or an invoice or RF reference such as FA26-0012 1250), it must also be as long
// as the shortest IBAN, 15 characters.
function ibanLikeSpans(s: string): Span[] {
  const spans: Span[] = [];
  for (const m of s.matchAll(COUNTRY_AND_KEY)) {
    IBAN_LIKE.lastIndex = m.index;
    const run = IBAN_LIKE.exec(s)?.[0] ?? "";
    const rest = run.slice(4);
    const digits = rest.match(/\d/g)?.length ?? 0;
    const masked = IBAN_LENGTH[m[0].slice(0, 2).toUpperCase()]
      ? digits >= 8 || (digits >= 7 && /^[ .-]?[A-Z]{4}/i.test(rest))
      : digits >= 8 && run.replace(/[ .-]/g, "").length >= 15;
    if (masked) spans.push([m.index, m.index + run.length]);
  }
  return spans;
}

// French RIB without its IBAN prefix: bank (5 digits), branch (5), account (11 characters), key (2).
const RIB = /(?<![0-9])\d{5}[ .-]\d{5}[ .-](?=[A-Z]*\d)[A-Z0-9]{11}[ .-]\d{2}(?![A-Z0-9])/gi;

// Each span becomes one mask; spans that overlap or touch become a single one.
function maskSpans(s: string, spans: Span[]): string {
  const merged: Span[] = [];
  for (const [from, to] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  let out = "";
  let end = 0;
  for (const [from, to] of merged) {
    out += s.slice(end, from) + MASK;
    end = to;
  }
  return out + s.slice(end);
}

// Everything else in the label is kept: dates, amounts, references and names.
export function maskBankDetails(s: string): string {
  const withoutIbans = maskSpans(s, ibanSpans(s));
  return maskSpans(withoutIbans, ibanLikeSpans(withoutIbans))
    .replace(RIB, MASK)
    .replace(/\d{9,}/g, MASK);
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
