import { describe, expect, it } from "vitest";
import { blocagesEnvoi, choisirPlanItem, clePlanItem, codeTva, corpsMiseAJour, type PlanItem } from "./pennylane-import";
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

// Accounts of the demo dossier as Pennylane returns them (one per VAT rate).
const items: PlanItem[] = [
  { id: 11, number: "2183", vat_rate: "FR_200", enabled: true },
  { id: 12, number: "6063", vat_rate: "FR_200", enabled: true },
  { id: 13, number: "486", vat_rate: "any", enabled: true },
  { id: 14, number: "6226", vat_rate: "exempt", enabled: true },
  { id: 15, number: "651", vat_rate: "any", enabled: false },
];
const trouves = new Map([[clePlanItem("2183", "FR_200"), 11], [clePlanItem("6063", "FR_200"), 12], [clePlanItem("486", "FR_200"), 13]]);

describe("envoi d'une facture fournisseur dans Pennylane", () => {
  it("code TVA par taux", () => {
    expect(codeTva(0.2)).toBe("FR_200");
    expect(codeTva(0.055)).toBe("FR_55");
    expect(codeTva(0)).toBe("exempt");
    expect(codeTva(0.13)).toBeNull();
  });
  it("prend le compte au même taux, sinon celui « tous taux », jamais un compte désactivé", () => {
    expect(choisirPlanItem(items, "2183", "FR_200")).toBe(11);
    expect(choisirPlanItem(items, "486", "FR_200")).toBe(13);
    expect(choisirPlanItem(items, "6226", "FR_200")).toBeNull();
    expect(choisirPlanItem(items, "651", "FR_200")).toBeNull();
  });
  it("remplace les lignes lues par Pennylane par les lignes validées", () => {
    const b = corpsMiseAJour(facture(), trouves, [101, 102]);
    expect(b.invoice).toMatchObject({ direction: "supplier", date: "2026-10-08", invoice_number: "F-2026-1042",
      label: "Atelier Numérique - Matériel informatique octobre 2026 - F-2026-1042" });
    const lignes = b.invoice.invoice_lines_attributes;
    expect(lignes.slice(0, 2)).toEqual([{ id: 101, _destroy: true }, { id: 102, _destroy: true }]);
    expect(lignes[2]).toEqual({ pnl_plan_item_id: 11, vat_rate: "FR_200", currency_amount: "1440.00", currency_tax: "240.00", ledger_event_label: "Ordinateur" });
    expect(lignes[4]).toMatchObject({ pnl_plan_item_id: 13, currency_amount: "288.00", currency_tax: "48.00" });
  });
  it("bloque un écart avec la facture, un taux inconnu ou un compte absent du dossier", () => {
    expect(blocagesEnvoi(facture(), trouves)).toEqual([]);
    expect(blocagesEnvoi(facture({ totalTtc: 1700 }))).toHaveLength(1);
    const f = facture();
    f.lignes[1] = { ...f.lignes[1]!, tauxTva: 0.13 };
    expect(blocagesEnvoi(f).some((m) => m.includes("taux de TVA"))).toBe(true);
    const sans6063 = new Map(trouves);
    sans6063.delete(clePlanItem("6063", "FR_200"));
    expect(blocagesEnvoi(facture(), sans6063)).toEqual(["Le compte 6063 n'est pas ouvert dans le dossier Pennylane pour ce taux de TVA : ouvrez-le d'abord."]);
  });
});
