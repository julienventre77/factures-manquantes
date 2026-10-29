import { describe, expect, it } from "vitest";
import { blocagesEnvoi, codeTva, corpsImport } from "./pennylane-import";
import type { Facture } from "./ventilation";

const facture = (over: Partial<Facture> = {}): Facture => ({
  id: "s1", numero: "F-2026-1042", fournisseur: "Atelier Numérique", date: "2026-10-08",
  totalHt: 1455, totalTva: 291, totalTtc: 1746, libelleGenerique: "", libelleEcriture: "Matériel informatique octobre 2026",
  lignes: [
    { id: "0", compte: "2183", compteLibelle: "", libelle: "Ordinateur", ht: 1200, tauxTva: 0.2 },
    { id: "1", compte: "6063", compteLibelle: "", libelle: "Tapis", ht: 15, tauxTva: 0.2 },
    { id: "2", compte: "486", compteLibelle: "", libelle: "Garantie (CCA)", ht: 240, tauxTva: 0.2, tvaMontant: 48 },
  ],
  ...over,
});

describe("import d'une facture fournisseur dans Pennylane", () => {
  it("code TVA par taux", () => {
    expect(codeTva(0.2)).toBe("FR_200");
    expect(codeTva(0.055)).toBe("FR_55");
    expect(codeTva(0)).toBe("exempt");
    expect(codeTva(0.13)).toBeNull();
  });
  it("corps de l'envoi : montants en texte, lignes TTC qui retombent sur le total", () => {
    const comptes = new Map([["2183", 11], ["6063", 12], ["486", 13]]);
    const b = corpsImport(facture(), { fileAttachmentId: 7, supplierId: 9, comptes }, "pbc-s1");
    expect(b).toMatchObject({
      file_attachment_id: 7, supplier_id: 9, date: "2026-10-08", deadline: "2026-10-08", invoice_number: "F-2026-1042",
      currency_amount_before_tax: "1455.00", currency_tax: "291.00", currency_amount: "1746.00", external_reference: "pbc-s1",
    });
    expect(b.invoice_lines[0]).toEqual({ currency_amount: "1440.00", currency_tax: "240.00", vat_rate: "FR_200", ledger_account_id: 11 });
    expect(b.invoice_lines[2]!.ledger_account_id).toBe(13);
  });
  it("bloque un écart avec la facture, un taux inconnu ou un compte absent du dossier", () => {
    expect(blocagesEnvoi(facture(), new Set(["2183", "6063", "486"]))).toEqual([]);
    expect(blocagesEnvoi(facture({ totalTtc: 1700 }))).toHaveLength(1);
    const f = facture();
    f.lignes[1] = { ...f.lignes[1]!, tauxTva: 0.13 };
    expect(blocagesEnvoi(f).some((m) => m.includes("taux de TVA"))).toBe(true);
    expect(blocagesEnvoi(facture(), new Set(["2183", "486"]))).toEqual(["Le compte 6063 n'existe pas dans le dossier Pennylane : créez-le d'abord."]);
  });
});
