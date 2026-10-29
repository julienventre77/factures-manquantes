import { round2, SEUIL_IMMOBILISATION_HT, type Ligne } from "./ventilation";

/**
 * Éclatement d'une facture à partir des lignes lues sur la pièce (PDF).
 * Une ligne de pièce = une nature → un compte : mémoire du fournisseur, puis compte du plan ANC 2026 choisi
 * à la lecture (saisie.ts), puis à défaut les règles par mots-clés ci-dessous (comptes du plan ANC 2026).
 * Les prestations sur plusieurs mois sont coupées : part de l'exercice en charge, reste en 486.
 * Repris de l'appli « Comptabilité augmentée » (hackathon du 28/10/2026) ; ajout : la mémoire par fournisseur.
 */
export type LignePiece = {
  designation: string;
  description?: string;
  quantite: number;
  prixUnitaireHt: number;
  montantHt: number;
  tauxTva: number; // 0.2
  debut?: string; // AAAA-MM-JJ si période de service
  fin?: string;
};

type Nature = NonNullable<Ligne["nature"]>;
type Regle = { mots: RegExp; compte: string; libelle: string; nature: Nature };
// motif : pourquoi ce compte (mémoire, choix motivé de la lecture ou règle par mots-clés).
export type Classement = { compte: string; libelle: string; nature: Nature; memorisee?: boolean; motif?: string };

// L'ordre compte : la garantie / licence passe avant le matériel (« garantie ordinateur »).
export const REGLES: Regle[] = [
  { mots: /garantie|maintenance|assistance|support|sav/i, compte: "6156", libelle: "Maintenance", nature: "charge" },
  { mots: /licen[cs]e|logiciel|saas|abonnement (au )?logiciel|software/i, compte: "651", libelle: "Redevances pour concessions, brevets, licences, marques, procédés, solutions informatiques, droits et valeurs similaires", nature: "charge" },
  { mots: /ordinateur|portable|laptop|macbook|serveur|[ée]cran|moniteur|imprimante|tablette|smartphone|t[ée]l[ée]phone/i, compte: "2183", libelle: "Matériel de bureau et matériel informatique", nature: "immobilisation" },
  { mots: /tapis|souris|clavier|c[âa]ble|adaptateur|chargeur|casque|cl[ée] usb|hub/i, compte: "6063", libelle: "Fournitures d'entretien et de petit équipement", nature: "charge" },
  { mots: /papeterie|fournitures? (de )?bureau|cartouche|toner/i, compte: "6064", libelle: "Fournitures administratives", nature: "charge" },
  { mots: /honoraires?|comptab|expert|avocat|juridique/i, compte: "6226", libelle: "Honoraires", nature: "charge" },
  { mots: /loyer|location (de )?(bureau|local)/i, compte: "6132", libelle: "Locations immobilières", nature: "charge" },
  { mots: /t[ée]l[ée]com|internet|forfait mobile|fibre/i, compte: "626", libelle: "Frais postaux et de télécommunications", nature: "charge" },
  { mots: /transport|livraison|port\b|exp[ée]dition/i, compte: "6241", libelle: "Transports sur achats", nature: "charge" },
  { mots: /publicit|annonce|marketing/i, compte: "6231", libelle: "Annonces et insertions", nature: "charge" },
];

export const CCA = { compte: "486", libelle: "Charges constatées d'avance" };

export function classer(l: Pick<LignePiece, "designation" | "description" | "prixUnitaireHt">): Classement {
  const txt = `${l.designation} ${l.description ?? ""}`;
  const r = REGLES.find((x) => x.mots.test(l.designation)) ?? REGLES.find((x) => x.mots.test(txt));
  if (!r) return { compte: "628", libelle: "Divers", nature: "charge" as const, motif: "Aucune règle ne reconnaît la ligne : compte à vérifier." };
  // Matériel sous le seuil : petit équipement, pas d'immobilisation.
  if (r.nature === "immobilisation" && l.prixUnitaireHt <= SEUIL_IMMOBILISATION_HT)
    return { compte: "6063", libelle: "Fournitures d'entretien et de petit équipement", nature: "charge" as const, motif: "Règle par mots-clés : matériel de faible valeur." };
  return { compte: r.compte, libelle: r.libelle, nature: r.nature, motif: "Règle par mots-clés." };
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisAnnee = (iso: string) => { const d = new Date(iso); return `${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

/** Nombre de mois (entamés) entre deux dates. */
export function nbMois(debut: string, fin: string) {
  const a = new Date(debut), b = new Date(fin);
  const m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
  return Math.max(1, b.getUTCDate() >= a.getUTCDate() ? m : m + 0) || 1;
}

/** Lit « du 8 octobre 2026 au 7 octobre 2028 » dans un texte. */
export function lirePeriode(txt: string): { debut: string; fin: string } | null {
  const re = /du (\d{1,2}) (\p{L}+) (\d{4}) au (\d{1,2}) (\p{L}+) (\d{4})/iu;
  const m = txt.match(re);
  if (!m) return null;
  const iso = (j: string, mo: string, a: string) => {
    const i = MOIS.indexOf(mo.toLowerCase());
    return i < 0 ? null : `${a}-${String(i + 1).padStart(2, "0")}-${j.padStart(2, "0")}`;
  };
  const debut = iso(m[1]!, m[2]!, m[3]!), fin = iso(m[4]!, m[5]!, m[6]!);
  return debut && fin ? { debut, fin } : null;
}

/**
 * Transforme les lignes de la pièce en lignes de ventilation.
 * finExercice : date de clôture (AAAA-MM-JJ), par défaut le 31/12 de l'année de facture.
 * memoire : compte déjà validé pour cette désignation chez ce fournisseur, prioritaire sur les règles.
 */
export function eclater<P extends LignePiece>(
  piece: P[],
  dateFacture: string,
  finExercice?: string,
  memoire?: (p: P) => Classement | undefined,
): Ligne[] {
  const cloture = finExercice ?? `${dateFacture.slice(0, 4)}-12-31`;
  const out: Ligne[] = [];
  piece.forEach((p, i) => {
    const c = memoire?.(p) ?? classer(p);
    const per = p.debut && p.fin ? { debut: p.debut, fin: p.fin } : lirePeriode(`${p.designation} ${p.description ?? ""}`);
    const base = { tauxTva: p.tauxTva, nature: c.nature, designation: p.designation, ...(c.memorisee ? { memorisee: true } : {}), ...(c.motif ? { motif: c.motif } : {}) };
    if (per && per.fin > cloture) {
      const total = nbMois(per.debut, per.fin);
      const dansExercice = Math.min(total, nbMois(per.debut, cloture) + 1);
      const partExercice = round2((p.montantHt * dansExercice) / total);
      const reste = round2(p.montantHt - partExercice);
      const periode = `${moisAnnee(per.debut)} → ${moisAnnee(per.fin)}`;
      out.push({ ...base, id: `${i}a`, compte: c.compte, compteLibelle: c.libelle, libelle: `${p.designation} — ${dansExercice} mois sur l'exercice (${periode})`, ht: partExercice, tvaMontant: round2(partExercice * p.tauxTva), periodeMois: dansExercice });
      if (reste) out.push({ ...base, id: `${i}b`, nature: "charge_etalee", motif: "Charge constatée d'avance (PCG art. 211-8) : part de la prestation après la clôture.", compte: CCA.compte, compteLibelle: CCA.libelle, libelle: `${p.designation} — ${total - dansExercice} mois après clôture (CCA)`, ht: reste, tvaMontant: round2(reste * p.tauxTva), periodeMois: total - dansExercice });
      return;
    }
    out.push({ ...base, id: String(i), compte: c.compte, compteLibelle: c.libelle, libelle: p.designation, ht: round2(p.montantHt), tvaMontant: round2(p.montantHt * p.tauxTva) });
  });
  return out;
}

/** Lignes lues sur la pièce Atelier Numérique F-2026-1042 (référence de démo). */
export const PIECE_ATELIER_NUMERIQUE: LignePiece[] = [
  { designation: "Ordinateur portable 14 pouces", description: "Réf. AN-NB14 · Core Ultra, 16 Go RAM, 512 Go SSD. Matériel informatique livré le 8 octobre 2026.", quantite: 1, prixUnitaireHt: 1200, montantHt: 1200, tauxTva: 0.2 },
  { designation: "Tapis de souris textile", description: "Réf. AN-PAD · format standard, coloris graphite.", quantite: 1, prixUnitaireHt: 15, montantHt: 15, tauxTva: 0.2 },
  { designation: "Extension de garantie", description: "Abonnement de 10,00 € HT par mois, du 8 octobre 2026 au 7 octobre 2028. Durée ferme de 24 mois, facturée en une fois.", quantite: 24, prixUnitaireHt: 10, montantHt: 240, tauxTva: 0.2 },
];
