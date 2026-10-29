import { describe, expect, it } from "vitest";
import { cleDesignation, ecartPaiement, LigneSaisie, parseLecture, proposer, reglesAEnregistrer, typeMedia } from "./saisie";
import { controle } from "./ventilation";

const reponse = (over: Record<string, unknown> = {}) => JSON.stringify({
  lisible: true, fournisseur: "Atelier Numérique", numero: "F-2026-1042", date: "2026-10-08",
  libelle_ecriture: "Matériel informatique octobre 2026", total_ht: 1455, total_tva: 291, total_ttc: 1746,
  lignes: [
    { designation: "Ordinateur portable 14 pouces", description: "", quantite: 1, prix_unitaire_ht: 1200, montant_ht: 1200, taux_tva: 0.2, debut: "", fin: "", compte: "2183", motif: "Matériel informatique durable (art. 211-6)." },
    { designation: "Tapis de souris textile", description: "", quantite: 1, prix_unitaire_ht: 15, montant_ht: 15, taux_tva: 20, debut: "", fin: "", compte: "", motif: "" },
    { designation: "Extension de garantie", description: "24 mois", quantite: 24, prix_unitaire_ht: 10, montant_ht: 240, taux_tva: 0.2, debut: "2026-10-08", fin: "2028-10-07", compte: "6156", motif: "Maintenance du matériel." },
  ],
  ...over,
});

describe("lecture de Claude", () => {
  it("convertit la réponse et lit un taux écrit en pourcentage", () => {
    const l = parseLecture(reponse())!;
    expect(l.numero).toBe("F-2026-1042");
    expect(l.lignes[1]!.tauxTva).toBe(0.2);
    expect(l.lignes[2]).toMatchObject({ debut: "2026-10-08", fin: "2028-10-07" });
    expect(l.lignes[0]!.debut).toBeUndefined();
  });
  it("refuse une pièce illisible, une réponse vide ou mal formée", () => {
    expect(parseLecture(reponse({ lisible: false }))).toBeNull();
    expect(parseLecture(reponse({ lignes: [] }))).toBeNull();
    expect(parseLecture("pas du json")).toBeNull();
    expect(parseLecture(JSON.stringify({ lisible: true }))).toBeNull();
  });
  it("ignore une date mal formée", () => {
    expect(parseLecture(reponse({ date: "08/10/2026" }))!.date).toBeNull();
  });
});

describe("proposition", () => {
  const lecture = parseLecture(reponse())!;
  it("éclate la facture et retombe sur le pied", () => {
    const f = proposer(lecture, { regles: [], dateRepli: "2026-10-10", fournisseur: "ATELIER" });
    expect(f.lignes.map((l) => l.compte)).toEqual(["2183", "6063", "6156", "486"]);
    expect(controle(f).ok).toBe(true);
  });
  it("reprend le compte mémorisé pour le fournisseur", () => {
    const f = proposer(lecture, { regles: [{ cle: "tapis de souris textile", compte: "60632", compte_libelle: "Petit matériel" }], dateRepli: "2026-10-10", fournisseur: "ATELIER" });
    expect(f.lignes[1]).toMatchObject({ compte: "60632", memorisee: true });
  });
  it("garde le compte choisi dans le plan, avec son motif", () => {
    const f = proposer(lecture, { regles: [], dateRepli: "2026-10-10", fournisseur: "ATELIER" });
    expect(f.lignes[0]).toMatchObject({ compte: "2183", compteLibelle: "Matériel de bureau et matériel informatique", motif: "Matériel informatique durable (art. 211-6)." });
    expect(f.lignes[1]).toMatchObject({ compte: "6063", motif: "Règle par mots-clés." });
  });
  it("écarte un compte hors plan ou hors achats et revient aux règles", () => {
    const l = { ...lecture, lignes: lecture.lignes.map((x, i) => (i === 0 ? { ...x, compte: "999" } : i === 2 ? { ...x, compte: "401" } : x)) };
    const f = proposer(l, { regles: [], dateRepli: "2026-10-10", fournisseur: "ATELIER" });
    expect(f.lignes.map((x) => x.compte)).toEqual(["2183", "6063", "6156", "486"]);
    expect(f.lignes[0]!.motif).toBe("Règle par mots-clés.");
  });
  it("prend la date du paiement si la facture n'en a pas", () => {
    const f = proposer({ ...lecture, date: null }, { regles: [], dateRepli: "2026-10-10", fournisseur: "ATELIER" });
    expect(f.date).toBe("2026-10-10");
  });
});

describe("mémoire par fournisseur", () => {
  it("la clé ignore mois, chiffres, accents et ponctuation", () => {
    expect(cleDesignation("Loyer octobre 2026 – Local n°3")).toBe("loyer local n");
    expect(cleDesignation("LOYER Novembre 2026 - local N°3")).toBe("loyer local n");
    expect(cleDesignation("Électricité")).toBe("electricite");
  });
  it("n'apprend ni la part en 486 ni une ligne ajoutée à la main", () => {
    const r = reglesAEnregistrer([
      { id: "0", compte: "6156", compteLibelle: "Maintenance", libelle: "Garantie", ht: 30, tauxTva: 0.2, designation: "Extension de garantie" },
      { id: "1", compte: "486", compteLibelle: "CCA", libelle: "Garantie (CCA)", ht: 210, tauxTva: 0.2, designation: "Extension de garantie" },
      { id: "2", compte: "6064", compteLibelle: "", libelle: "Ajout manuel", ht: 5, tauxTva: 0.2 },
    ]);
    expect(r).toEqual([{ cle: "extension de garantie", compte: "6156", compte_libelle: "Maintenance" }]);
  });
});

describe("contrôles", () => {
  it("écart entre facture et paiement", () => {
    expect(ecartPaiement(1746, -1746)).toBe(0);
    expect(ecartPaiement(1746, -1700)).toBe(46);
  });
  it("type de fichier envoyé à Claude", () => {
    expect(typeMedia("Facture.PDF")).toBe("application/pdf");
    expect(typeMedia("photo.jpeg")).toBe("image/jpeg");
    expect(typeMedia("tableau.xlsx")).toBeNull();
  });
  it("refuse un compte non numérique", () => {
    const l = { id: "a", compte: "6063", compteLibelle: "", libelle: "x", ht: 1, tauxTva: 0.2 };
    expect(LigneSaisie.safeParse(l).success).toBe(true);
    expect(LigneSaisie.safeParse({ ...l, compte: "60A3" }).success).toBe(false);
    expect(LigneSaisie.safeParse({ ...l, compte: "999" }).success).toBe(false);
    expect(LigneSaisie.safeParse({ ...l, compte: "401" }).success).toBe(false);
  });
});
