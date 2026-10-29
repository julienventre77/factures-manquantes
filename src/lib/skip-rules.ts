// "Ne plus demander" rules (lot 3): lines matching a rule of the dossier are set aside
// ("Non demandée") at each sync instead of waiting for the cabinet's review.

export type SkipRule = {
  id: string;
  kind: "label" | "supplier";
  pattern: string;
  direction: "out" | "in" | null;
};

export type RuleTarget = { label: string; supplier: string; supplier_detected: string; direction: "out" | "in" };

// Case, accent and spacing insensitive, so "Urssaf" matches "PRLV URSSAF ÎLE-DE-FRANCE".
export function normalizeText(s: string): string {
  return (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function ruleMatches(rule: SkipRule, t: RuleTarget): boolean {
  if (rule.direction && rule.direction !== t.direction) return false;
  const p = normalizeText(rule.pattern);
  if (!p) return false;
  // Whole words only, so "SFR" does not match "TRANSFRONTALIER".
  if (rule.kind === "label") return ` ${normalizeText(t.label)} `.includes(` ${p} `);
  return normalizeText(t.supplier) === p || normalizeText(t.supplier_detected) === p;
}

export function findRule(rules: SkipRule[], t: RuleTarget): SkipRule | undefined {
  return rules.find((r) => ruleMatches(r, t));
}

export function describeRule(r: Pick<SkipRule, "kind" | "pattern" | "direction">): string {
  const what = r.kind === "label" ? `Libellé contenant « ${r.pattern} »` : `Tiers « ${r.pattern} »`;
  const dir = r.direction === "out" ? " (achats)" : r.direction === "in" ? " (ventes)" : "";
  return what + dir;
}
