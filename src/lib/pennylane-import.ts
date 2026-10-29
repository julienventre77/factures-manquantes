// Supplier invoice import into Pennylane (API v2, POST /supplier_invoices/import) from a validated saisie.
// Pure helpers: the body, the VAT codes and the checks done before anything is sent.
import { round2, tvaLigne, type Facture } from "@/lib/ventilation";

// French VAT codes of the Pennylane API, by rate (the rates the screen offers).
const CODES_TVA: [number, string][] = [[0.2, "FR_200"], [0.1, "FR_100"], [0.055, "FR_55"], [0.021, "FR_21"], [0, "exempt"]];
export const codeTva = (taux: number) => CODES_TVA.find(([t]) => Math.abs(t - taux) < 1e-9)?.[1] ?? null;

const chaine = (n: number) => round2(n).toFixed(2);

export type Identifiants = {
  fileAttachmentId: number;
  supplierId: number;
  // Account number → ledger account id in the Pennylane company.
  comptes: Map<string, number>;
};

/** What prevents sending the invoice; empty when it can go. */
export function blocagesEnvoi(f: Facture, comptesPennylane?: Set<string>) {
  const out: string[] = [];
  for (const l of f.lignes) {
    if (codeTva(l.tauxTva) === null) out.push(`« ${l.libelle} » : taux de TVA ${l.tauxTva * 100} % non pris en charge par l'import.`);
    if (comptesPennylane && !comptesPennylane.has(l.compte)) out.push(`Le compte ${l.compte} n'existe pas dans le dossier Pennylane : créez-le d'abord.`);
  }
  // Pennylane requires the lines to add up to the invoice total; the invoice must also match its PDF.
  const ttc = round2(f.lignes.reduce((s, l) => s + l.ht + tvaLigne(l), 0));
  if (Math.abs(ttc - f.totalTtc) > 0.01)
    out.push(`Les lignes font ${chaine(ttc)} € TTC, la facture ${chaine(f.totalTtc)} € : corrigez la saisie avant l'envoi.`);
  if (!f.date) out.push("Date de facture manquante.");
  return [...new Set(out)];
}

/** Body of POST /supplier_invoices/import. Call blocagesEnvoi() first. */
export function corpsImport(f: Facture, ids: Identifiants, referenceExterne: string) {
  const lignes = f.lignes.map((l) => {
    const tva = tvaLigne(l);
    return {
      currency_amount: chaine(l.ht + tva),
      currency_tax: chaine(tva),
      vat_rate: codeTva(l.tauxTva)!,
      ledger_account_id: ids.comptes.get(l.compte)!,
    };
  });
  const ht = round2(f.lignes.reduce((s, l) => s + l.ht, 0));
  const tva = round2(f.lignes.reduce((s, l) => s + tvaLigne(l), 0));
  return {
    file_attachment_id: ids.fileAttachmentId,
    supplier_id: ids.supplierId,
    date: f.date,
    // The invoice is already paid (it justifies a bank payment): the deadline is the invoice date.
    deadline: f.date,
    ...(f.numero ? { invoice_number: f.numero } : {}),
    label: f.libelleEcriture,
    currency_amount_before_tax: chaine(ht),
    currency_tax: chaine(tva),
    // Sum of the lines as sent, so the balancing rule of the import holds to the cent.
    currency_amount: chaine(lignes.reduce((s, l) => s + Number(l.currency_amount), 0)),
    external_reference: referenceExterne,
    invoice_lines: lignes,
  };
}
