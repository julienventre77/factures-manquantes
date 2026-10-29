// Extracts a normalized supplier name from a bank label.
// e.g. "CB AMAZON PAYMENTS 12/10" and "AMZN MKTP FR" -> "Amazon"

const KNOWN: Array<[RegExp, string]> = [
  [/\b(AMAZON|AMZN)\b/, "Amazon"],
  [/\bGOOGLE\b/, "Google"],
  [/\bAPPLE\b|\bITUNES\b/, "Apple"],
  [/\bMICROSOFT\b|\bMSFT\b/, "Microsoft"],
  [/\bOVH\b/, "OVH"],
  [/\bFREE ?MOBILE\b|\bFREE TELECOM\b/, "Free"],
  [/\bORANGE\b/, "Orange"],
  [/\bSFR\b/, "SFR"],
  [/\bBOUYGUES\b/, "Bouygues Telecom"],
  [/\bUBER\b/, "Uber"],
  [/\bSNCF\b|\bOUIGO\b/, "SNCF"],
  [/\bTOTAL(ENERGIES)?\b/, "TotalEnergies"],
  [/\bEDF\b/, "EDF"],
  [/\bPAYPAL\b/, "PayPal"],
  [/\bADOBE\b/, "Adobe"],
  [/\bLINKEDIN\b/, "LinkedIn"],
  [/\bFACEBK\b|\bFACEBOOK\b|\bMETA\b/, "Meta"],
  [/\bCANVA\b/, "Canva"],
  [/\bNOTION\b/, "Notion"],
  [/\bSLACK\b/, "Slack"],
];

const NOISE = new Set([
  "CB", "CARTE", "PRLV", "PRELEVEMENT", "SEPA", "VIR", "VIREMENT", "PAIEMENT", "PAYMENT",
  "PAYMENTS", "ACHAT", "FACTURE", "FAC", "INST", "INSTANTANE", "EUROPE", "EU", "FR", "FRANCE",
  "SARL", "SAS", "SASU", "SA", "EURL", "MKTP", "MARKETPLACE", "COM", "WWW", "RETRAIT", "DAB",
  "DE", "DU", "LA", "LE", "LES", "ET", "X", "REF", "ECH", "DATE",
]);

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function normalizeSupplier(label: string): string {
  const up = (label || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const [re, name] of KNOWN) if (re.test(up)) return name;
  const tokens = up
    .replace(/[*./\\_\-:,;#]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t) && !/\d/.test(t) && t.length > 1);
  if (tokens.length === 0) return "Autre";
  return titleCase(tokens.slice(0, 2).join(" "));
}

const LEGAL_FORMS = new Set(["SARL", "SAS", "SASU", "SA", "EURL", "SCI", "SNC", "EI", "EIRL", "SCP", "SELARL"]);
const SMALL_WORDS = new Set(["DE", "DU", "DES", "LA", "LE", "LES", "ET", "D", "L"]);

// Two-letter monogram shown in the avatar of a supplier or of the firm.
// e.g. "Leroy Merlin" -> "LM", "Amazon" -> "AM", "SARL Martin Rénovation" -> "MR"
export function initials(name: string): string {
  const words = (name || "")
    .split(/[\s'’\-_.&/]+/)
    .filter((w) => w && !LEGAL_FORMS.has(w.toUpperCase()) && !SMALL_WORDS.has(w.toUpperCase()));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}
