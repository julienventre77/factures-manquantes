// Ventilation d'une facture d'achat : totaux, contrôle du pied de facture, alertes et écriture.
// Repris de l'appli « Comptabilité augmentée » (hackathon du 28/10/2026), sans changement de calcul.
export type Ligne = {
  id: string;
  compte: string;
  compteLibelle: string;
  libelle: string;
  ht: number;
  tauxTva: number; // 0.2, 0.1, 0.055, 0
  nature?: "charge" | "immobilisation" | "charge_etalee";
  periodeMois?: number;
  /** Montant de TVA réel issu de la pièce (prioritaire sur ht × taux). */
  tvaMontant?: number;
  /** Désignation lue sur la pièce : sert de clé à la mémoire par fournisseur. */
  designation?: string;
  /** Compte repris d'une saisie validée pour ce fournisseur. */
  memorisee?: boolean;
  /** Pourquoi ce compte : mémoire, choix motivé selon le plan de comptes, ou règle par mots-clés. */
  motif?: string;
};

export type Facture = {
  id: string;
  numero: string;
  fournisseur: string;
  date: string;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  libelleGenerique: string;
  libelleEcriture: string;
  lignes: Ligne[];
  regleAppliquee?: string;
};

export const SEUIL_IMMOBILISATION_HT = 500;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function tvaLigne(l: Ligne) {
  return l.tvaMontant ?? round2(l.ht * l.tauxTva);
}

export function totaux(lignes: Ligne[]) {
  const ht = round2(lignes.reduce((s, l) => s + l.ht, 0));
  const tva = round2(lignes.reduce((s, l) => s + tvaLigne(l), 0));
  return { ht, tva, ttc: round2(ht + tva) };
}

/** Écarts entre la ventilation et le pied de facture (tolérance 1 centime). */
export function controle(f: Facture) {
  const t = totaux(f.lignes);
  const ecartHt = round2(t.ht - f.totalHt);
  const ecartTva = round2(t.tva - f.totalTva);
  const ecartTtc = round2(t.ttc - f.totalTtc);
  const ok = [ecartHt, ecartTva, ecartTtc].every((e) => Math.abs(e) <= 0.01);
  return { ...t, ecartHt, ecartTva, ecartTtc, ok };
}

/** Faut-il éclater la facture ? */
export function meriteEclatement(lignes: Ligne[]) {
  const comptes = new Set(lignes.map((l) => l.compte));
  return (
    comptes.size >= 2 ||
    lignes.some((l) => l.ht > SEUIL_IMMOBILISATION_HT && l.nature === "immobilisation") ||
    lignes.some((l) => (l.periodeMois ?? 0) > 1)
  );
}

/** Une ligne de bien > 500 € HT doit être en immobilisation (classe 2). */
export function alertes(lignes: Ligne[]) {
  const out: string[] = [];
  for (const l of lignes) {
    if (l.nature === "immobilisation" && l.ht > SEUIL_IMMOBILISATION_HT && !l.compte.startsWith("2"))
      out.push(`« ${l.libelle} » dépasse ${SEUIL_IMMOBILISATION_HT} € HT : à passer en immobilisation (compte 2…).`);
    if (l.periodeMois && l.periodeMois > 12 && !l.compte.startsWith("486"))
      out.push(`« ${l.libelle} » couvre ${l.periodeMois} mois : charge constatée d'avance à prévoir.`);
  }
  return out;
}

/** Compte de TVA déductible d'une ligne (PCG) : 44562 sur immobilisations, 44566 sur autres biens et services. */
export const compteTva = (l: Pick<Ligne, "compte">) => (l.compte.startsWith("2") ? "44562" : "44566");
const LIBELLE_TVA: Record<string, string> = {
  "44562": "TVA déductible sur immobilisations",
  "44566": "TVA déductible sur autres biens et services",
};

/** Écriture d'achat complète : débits charges + TVA (44562 / 44566), crédit dette fournisseur TTC (401). */
export function ecriture(f: Facture, compteFournisseur = "401") {
  const debits = f.lignes.map((l) => ({ compte: l.compte, libelle: l.libelle, debit: l.ht, credit: 0 }));
  for (const c of ["44562", "44566"]) {
    const tva = round2(f.lignes.filter((l) => compteTva(l) === c).reduce((s, l) => s + tvaLigne(l), 0));
    if (tva) debits.push({ compte: c, libelle: LIBELLE_TVA[c]!, debit: tva, credit: 0 });
  }
  const credit = { compte: compteFournisseur, libelle: `Dette fournisseur ${f.fournisseur}`, debit: 0, credit: f.totalTtc };
  const lignes = [...debits, credit];
  const totalDebit = round2(debits.reduce((s, l) => s + l.debit, 0));
  return { lignes, totalDebit, totalCredit: f.totalTtc, equilibree: Math.abs(totalDebit - f.totalTtc) <= 0.01 };
}
