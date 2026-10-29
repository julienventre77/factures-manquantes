// Sending a validated saisie to Pennylane as a supplier invoice with its PDF, through the MCP (demo dossiers only).
// Pure helpers: VAT codes, account lookup, checks done before anything is sent, and the update body.
// Flow tested on the demo dossier 276211 on 29/10/2026: PDF upload, invoice created from the PDF, then the
// firm's lines replace the ones Pennylane read.
import { round2, tvaLigne, type Facture } from "@/lib/ventilation";

// French VAT codes used by Pennylane, by rate (the rates the screen offers).
const CODES_TVA: [number, string][] = [[0.2, "FR_200"], [0.1, "FR_100"], [0.055, "FR_55"], [0.021, "FR_21"], [0, "exempt"]];
export const codeTva = (taux: number) => CODES_TVA.find(([t]) => Math.abs(t - taux) < 1e-9)?.[1] ?? null;

const chaine = (n: number) => round2(n).toFixed(2);

// One account number can exist several times in a Pennylane company, once per VAT rate.
export type PlanItem = { id: number; number: string; vat_rate: string; enabled: boolean };
export const clePlanItem = (compte: string, code: string) => `${compte}|${code}`;

/** Pennylane account for this number and VAT code: the one with the same rate, else the one for any rate. */
export function choisirPlanItem(items: PlanItem[], compte: string, code: string) {
  const actifs = items.filter((p) => p.enabled && p.number === compte);
  return (actifs.find((p) => p.vat_rate === code) ?? actifs.find((p) => p.vat_rate === "any"))?.id ?? null;
}

/** What prevents sending the invoice; empty when it can go. planItems: account ids found in the dossier. */
export function blocagesEnvoi(f: Facture, planItems?: Map<string, number>) {
  const out: string[] = [];
  for (const l of f.lignes) {
    const code = codeTva(l.tauxTva);
    if (code === null) out.push(`« ${l.libelle} » : taux de TVA ${l.tauxTva * 100} % non pris en charge par l'envoi.`);
    else if (planItems && !planItems.has(clePlanItem(l.compte, code)))
      out.push(`Le compte ${l.compte} n'est pas ouvert dans le dossier Pennylane pour ce taux de TVA : ouvrez-le d'abord.`);
  }
  // The invoice in Pennylane must match its PDF: the lines must add up to the invoice total.
  const ttc = round2(f.lignes.reduce((s, l) => s + l.ht + tvaLigne(l), 0));
  if (Math.abs(ttc - f.totalTtc) > 0.01)
    out.push(`Les lignes font ${chaine(ttc)} € TTC, la facture ${chaine(f.totalTtc)} € : corrigez la saisie avant l'envoi.`);
  if (!f.date) out.push("Date de facture manquante.");
  return [...new Set(out)];
}

/**
 * Body of the accountant update of the invoice Pennylane created from the PDF: the lines it read are removed and
 * replaced by the validated ones (account, VAT, TTC amount, VAT amount, line label). Call blocagesEnvoi() first.
 */
export function corpsMiseAJour(f: Facture, planItems: Map<string, number>, lignesLues: number[]) {
  return {
    invoice: {
      direction: "supplier",
      label: [f.fournisseur, f.libelleEcriture, f.numero].filter(Boolean).join(" - "),
      date: f.date,
      ...(f.numero ? { invoice_number: f.numero } : {}),
      invoice_lines_attributes: [
        ...lignesLues.map((id) => ({ id, _destroy: true })),
        ...f.lignes.map((l) => {
          const code = codeTva(l.tauxTva)!;
          const tva = tvaLigne(l);
          return {
            pnl_plan_item_id: planItems.get(clePlanItem(l.compte, code))!,
            vat_rate: code,
            currency_amount: chaine(l.ht + tva),
            currency_tax: chaine(tva),
            ledger_event_label: l.libelle.slice(0, 200),
          };
        }),
      ],
    },
  };
}
