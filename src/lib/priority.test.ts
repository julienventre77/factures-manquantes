import { describe, expect, it } from "vitest";
import { matchesSearch, prioritize, txHaystack } from "./priority";
import type { SupplierGroup, Tx } from "./session";

const tx = (over: Partial<Tx>): Tx => ({
  id: Math.random().toString(36), dossier_id: "d", pennylane_id: "p", date: "2026-01-01", amount: -10,
  label: "CB TEST", supplier: "Test", supplier_detected: "Test", status: "a_faire", comment: null, direction: "out",
  ...over,
});
const group = (name: string, txs: Tx[]): SupplierGroup => ({
  key: `achat:${name}`, direction: "out", name, txs, total: 0,
  state: txs.every((t) => t.status !== "a_faire") ? "done" : txs.some((t) => t.status !== "a_faire") ? "progress" : "todo",
});

describe("prioritize", () => {
  it("puts groups left to do first, largest amount to justify first", () => {
    const done = group("Orange", [tx({ amount: -5000, status: "depose" })]);
    const small = group("Adobe", [tx({ amount: -71.99 })]);
    const big = group("Hôtel du Parc", [tx({ amount: -1380 })]);
    expect(prioritize([done, small, big]).map((g) => g.name)).toEqual(["Hôtel du Parc", "Adobe", "Orange"]);
  });
  it("ignores the amounts already answered", () => {
    const a = group("A", [tx({ amount: -900, status: "email" }), tx({ amount: -10 })]);
    const b = group("B", [tx({ amount: -50 })]);
    expect(prioritize([a, b]).map((g) => g.name)).toEqual(["B", "A"]);
  });
  it("breaks ties with the oldest payment", () => {
    const recent = group("Récent", [tx({ amount: -20, date: "2026-05-01" })]);
    const old = group("Ancien", [tx({ amount: -20, date: "2026-01-15" })]);
    expect(prioritize([recent, old]).map((g) => g.name)).toEqual(["Ancien", "Récent"]);
  });
});

describe("search", () => {
  const h = txHaystack({ supplier: "Leroy Merlin", label: "CB LEROY MERLIN 12/03", amount: -1245.9, date: "2026-03-12" });
  it("matches names without accents or case", () => {
    expect(matchesSearch(h, "leroy")).toBe(true);
    expect(matchesSearch(h, "Mérlin")).toBe(true);
  });
  it("matches amounts written with a comma, a dot or spaces", () => {
    expect(matchesSearch(h, "1 245,90")).toBe(true);
    expect(matchesSearch(h, "1245.9")).toBe(true);
  });
  it("matches French dates", () => {
    expect(matchesSearch(h, "12/03")).toBe(true);
    expect(matchesSearch(h, "13/03")).toBe(false);
  });
  it("matches everything when the search is empty", () => {
    expect(matchesSearch(h, "  ")).toBe(true);
  });
});
