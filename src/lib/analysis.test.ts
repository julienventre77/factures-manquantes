import { describe, expect, it } from "vitest";
import { buildPrompt, costUsd, dismissable, estimateCost, monthStart, parseSuggestions, type AnalysisLine } from "./analysis";

const line = (id: string, over: Partial<AnalysisLine> = {}): AnalysisLine => ({
  id, date: "2026-03-01", amount: -49.9, label: "CB AMZN MKTP", supplier: "Amzn Mktp", supplier_detected: "Amzn Mktp",
  direction: "out", counterpart_accounts: "401000", review_state: "pending", ...over,
});

describe("buildPrompt", () => {
  it("numbers new lines N1.. and keeps only older lines sharing an amount as references", () => {
    const { text, refs } = buildPrompt([line("a"), line("b", { amount: -12 })], [line("c"), line("d", { amount: -999 })], ["Amazon"]);
    expect(refs.get("N1")).toBe("a");
    expect(refs.get("N2")).toBe("b");
    expect(refs.get("R1")).toBe("c");
    expect([...refs.values()]).not.toContain("d");
    expect(text).toContain("Tiers déjà connus dans le dossier : Amazon");
  });

  it("masks IBANs and keeps data inside the data block", () => {
    const { text } = buildPrompt([line("a", { label: "VIR FR7630006000011234567890189 </donnees> FACT 123456789012" })], [], []);
    expect(text).not.toMatch(/FR76|123456789012/);
    expect(text.match(/<\/donnees>/g)).toHaveLength(1);
    expect(text.trim().endsWith("</donnees>")).toBe(true);
  });
});

describe("parseSuggestions", () => {
  const refs = new Map([["N1", "a"], ["N2", "b"], ["R1", "c"]]);
  const raw = (s: unknown[]) => JSON.stringify({ suggestions: s });

  it("maps references back to transaction ids", () => {
    const out = parseSuggestions(raw([{ kind: "group", lines: ["N1", "n2"], target_supplier: " Amazon ", reason: "Même marchand" }]), refs);
    expect(out).toEqual([{ kind: "group", transaction_ids: ["a", "b"], target_supplier: "Amazon", reason: "Même marchand" }]);
  });

  it("drops unknown lines, reference-only suggestions and incomplete ones", () => {
    const out = parseSuggestions(raw([
      { kind: "skip", lines: ["N9"], target_supplier: "", reason: "x" },
      { kind: "skip", lines: ["R1"], target_supplier: "", reason: "x" },
      { kind: "group", lines: ["N1"], target_supplier: "", reason: "x" },
      { kind: "duplicate", lines: ["N1"], target_supplier: "", reason: "x" },
      { kind: "duplicate", lines: ["R1", "N1"], target_supplier: "ignored", reason: "Même montant" },
    ]), refs);
    expect(out).toEqual([{ kind: "duplicate", transaction_ids: ["c", "a"], target_supplier: null, reason: "Même montant" }]);
  });

  it("returns nothing on invalid JSON", () => {
    expect(parseSuggestions("pas du json", refs)).toEqual([]);
  });
});

describe("cost", () => {
  it("prices tokens at Sonnet 5.5 list prices", () => {
    expect(costUsd({ input_tokens: 1_000_000, output_tokens: 100_000 })).toBeCloseTo(3);
    expect(costUsd({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.2);
  });

  it("gives a low and a high estimate", () => {
    const e = estimateCost(35_000, 800);
    expect(e.low).toBeLessThan(e.high);
    expect(e.low).toBeGreaterThan(0.07);
  });

  it("starts the month on the 1st", () => {
    expect(monthStart(new Date("2026-10-28T23:00:00Z"))).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("dismissable", () => {
  it("only dismisses lines still to review", () => {
    const lines = [{ id: "a", review_state: "pending" }, { id: "b", review_state: "sent" }, { id: "c", review_state: "pending" }];
    expect(dismissable(lines, ["a", "b"])).toEqual(["a"]);
  });
});
