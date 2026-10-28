import { describe, expect, it } from "vitest";
import { describeRule, findRule, normalizeText, ruleMatches, type SkipRule } from "./skip-rules";

const tx = (label: string, supplier = "Autre", direction: "out" | "in" = "out") => ({
  label,
  supplier,
  supplier_detected: supplier,
  direction,
});
const rule = (r: Partial<SkipRule>): SkipRule => ({ id: "r", kind: "label", pattern: "", direction: null, ...r });

describe("normalizeText", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalizeText("Prlv URSSAF Île-de-France")).toBe("PRLV URSSAF ILE DE FRANCE");
  });
});

describe("ruleMatches", () => {
  it("matches whole words of the label", () => {
    expect(ruleMatches(rule({ pattern: "urssaf" }), tx("PRLV SEPA URSSAF IDF 0425"))).toBe(true);
    expect(ruleMatches(rule({ pattern: "dgfip impot" }), tx("PRLV DGFIP IMPOT 2026"))).toBe(true);
    expect(ruleMatches(rule({ pattern: "SFR" }), tx("VIR TRANSFRONTALIER"))).toBe(false);
  });
  it("matches the supplier exactly, displayed or detected", () => {
    expect(ruleMatches(rule({ kind: "supplier", pattern: "amazon" }), tx("CB AMZN MKTP", "Amazon"))).toBe(true);
    expect(ruleMatches(rule({ kind: "supplier", pattern: "Amazon Web" }), tx("CB AMZN MKTP", "Amazon"))).toBe(false);
    const renamed = { ...tx("CB LEROY", "Leroy Merlin"), supplier_detected: "Leroy" };
    expect(ruleMatches(rule({ kind: "supplier", pattern: "leroy" }), renamed)).toBe(true);
  });
  it("respects the direction when set", () => {
    const r = rule({ pattern: "salaire", direction: "out" });
    expect(ruleMatches(r, tx("VIR SALAIRE MARS", "Autre", "out"))).toBe(true);
    expect(ruleMatches(r, tx("VIR SALAIRE MARS", "Autre", "in"))).toBe(false);
  });
  it("never matches an empty pattern", () => {
    expect(ruleMatches(rule({ pattern: " - " }), tx("ANY"))).toBe(false);
  });
});

describe("findRule / describeRule", () => {
  it("returns the first matching rule", () => {
    const rules = [rule({ id: "a", pattern: "edf" }), rule({ id: "b", pattern: "urssaf" })];
    expect(findRule(rules, tx("PRLV URSSAF"))?.id).toBe("b");
    expect(findRule(rules, tx("CB FNAC"))).toBeUndefined();
  });
  it("describes a rule in French", () => {
    expect(describeRule({ kind: "label", pattern: "URSSAF", direction: null })).toBe("Libellé contenant « URSSAF »");
    expect(describeRule({ kind: "supplier", pattern: "Amazon", direction: "out" })).toBe("Tiers « Amazon » (achats)");
  });
});
