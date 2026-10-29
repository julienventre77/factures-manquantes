// Accounts of the ANC chart of accounts (PCG at 1 January 2026) used by the "saisie augmentée".
import { PCG_2026 } from "@/data/pcg-2026";

export const SOURCE_PCG = "Plan de comptes ANC au 1er janvier 2026 (règlement ANC n° 2014-03, art. 1121-1)";

// The chart account a number belongs to: itself, or the closest parent it subdivides
// (art. 1131-1: a sub-account number always starts with the number of the account it subdivides).
export function comptePcg(compte: string): { numero: string; libelle: string } | null {
  for (let n = compte.trim(); n.length >= 2; n = n.slice(0, -1)) {
    const libelle = PCG_2026[n];
    if (libelle) return { numero: n, libelle };
  }
  return null;
}

// A purchase line goes to an intangible or tangible asset (20, 21), an expense of accounts 60 to 67, or a
// prepaid expense (486). Left out: stock changes (603) and discounts obtained (609, 619, 629), which an
// invoice line never debits, and the year-end accounts 68 and 69.
const RACINES_ACHAT = ["20", "21", "60", "61", "62", "63", "64", "65", "66", "67", "486"];
const EXCLUS_ACHAT = ["603", "609", "619", "629"];
const estAchat = (n: string) => RACINES_ACHAT.some((r) => n.startsWith(r)) && !EXCLUS_ACHAT.some((r) => n.startsWith(r));

/** The account is in the chart, or subdivides an account of the chart, and fits a purchase line. */
export const compteAchatValide = (compte: string) => /^\d{3,12}$/.test(compte) && estAchat(compte) && comptePcg(compte) !== null;

// Accounts offered to Claude: every account of the chart with at least 3 figures under those roots, except 486
// which the app computes from the service period.
export const COMPTES_ACHAT: { numero: string; libelle: string }[] = Object.entries(PCG_2026)
  .filter(([n]) => n.length >= 3 && estAchat(n) && !n.startsWith("486"))
  .map(([numero, libelle]) => ({ numero, libelle }));

/** Chart wording of an account: its own, or "subdivision of <parent>" for a sub-account opened by the firm. */
export function libellePcg(compte: string) {
  const c = comptePcg(compte);
  if (!c) return "";
  return c.numero === compte.trim() ? c.libelle : `${c.libelle} (subdivision du ${c.numero})`;
}
