import { describe, expect, it } from "vitest";
import { classer, eclater, lirePeriode, PIECE_ATELIER_NUMERIQUE } from "./eclatement";
import { totaux } from "./ventilation";

describe("éclatement Atelier Numérique F-2026-1042", () => {
  const l = eclater(PIECE_ATELIER_NUMERIQUE, "2026-10-08");

  it("l'ordinateur 1 200 € HT part en immobilisation 2183", () => {
    expect(l[0]).toMatchObject({ compte: "2183", ht: 1200 });
  });
  it("le tapis de souris va en petit équipement 6063", () => {
    expect(l[1]).toMatchObject({ compte: "6063", ht: 15 });
  });
  it("la garantie 24 mois : 3 mois en 6156 (30 €), 21 mois en 486 (210 €)", () => {
    expect(l[2]).toMatchObject({ compte: "6156", ht: 30 });
    expect(l[3]).toMatchObject({ compte: "486", ht: 210 });
  });
  it("aucune ligne en 628 et totaux = pied de facture", () => {
    expect(l.some((x) => x.compte.startsWith("628"))).toBe(false);
    expect(totaux(l)).toEqual({ ht: 1455, tva: 291, ttc: 1746 });
  });
  it("garde la désignation de la pièce sur chaque ligne", () => {
    expect(l.map((x) => x.designation)).toEqual([
      "Ordinateur portable 14 pouces", "Tapis de souris textile", "Extension de garantie", "Extension de garantie",
    ]);
  });
});

describe("règles", () => {
  it("matériel sous 500 € HT reste en charge", () => {
    expect(classer({ designation: "Écran 24 pouces", prixUnitaireHt: 180 }).compte).toBe("6063");
  });
  it("lit une période en toutes lettres", () => {
    expect(lirePeriode("du 8 octobre 2026 au 7 octobre 2028")).toEqual({ debut: "2026-10-08", fin: "2028-10-07" });
  });
});

describe("mémoire par fournisseur", () => {
  it("le compte mémorisé passe avant les règles", () => {
    const l = eclater(PIECE_ATELIER_NUMERIQUE.slice(1, 2), "2026-10-08", undefined, (p) =>
      p.designation.startsWith("Tapis") ? { compte: "60632", libelle: "Petit matériel", nature: "charge", memorisee: true } : undefined);
    expect(l[0]).toMatchObject({ compte: "60632", compteLibelle: "Petit matériel", memorisee: true });
  });
  it("sans mémoire, la ligne n'est pas marquée", () => {
    expect(eclater(PIECE_ATELIER_NUMERIQUE.slice(1, 2), "2026-10-08")[0]!.memorisee).toBeUndefined();
  });
});
