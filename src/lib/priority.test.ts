import { describe, expect, it } from "vitest";
import { matchesSearch, prioritize, stepOrder, txHaystack } from "./priority";
import type { SupplierGroup, Tx } from "./session";

const tx = (over: Partial<Tx>): Tx => ({
  id: Math.random().toString(36), dossier_id: "d", pennylane_id: "p", date: "2026-01-01", amount: -10,
  label: "CB TEST", supplier: "Test", supplier_detected: "Test", status: "a_faire", comment: null, direction: "out",
  ...over,
});
const group = (name: string, txs: Tx[]): SupplierGroup => ({
  key: `achat:${name}`, direction: "out", name, txs, total: txs.reduce((s, t) => s + Math.abs(t.amount), 0),
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
  it("agrees with stepOrder on totals equal to the cent, so the next step is the first one", () => {
    const adobe = group("Adobe", [tx({ amount: -10.1, date: "2026-01-05" }), tx({ amount: -20.2, date: "2026-01-05" })]);
    const bureau = group("Bureau Vallée", [tx({ amount: -30.3, date: "2026-04-01" })]);
    expect(adobe.total).not.toBe(bureau.total);
    expect(prioritize([bureau, adobe]).map((g) => g.name)).toEqual(["Adobe", "Bureau Vallée"]);
    expect(stepOrder([bureau, adobe]).map((g) => g.name)).toEqual(["Adobe", "Bureau Vallée"]);
  });
});

describe("stepOrder", () => {
  it("keeps the same order while the client answers", () => {
    const a = group("A", [tx({ amount: -1000 })]);
    const b = group("B", [tx({ amount: -500 })]);
    const c = group("C", [tx({ amount: -100 })]);
    const before = stepOrder([c, a, b]).map((g) => g.name);
    const aDone = group("A", [tx({ amount: -1000, status: "depose" })]);
    expect(before).toEqual(["A", "B", "C"]);
    expect(stepOrder([c, aDone, b]).map((g) => g.name)).toEqual(before);
  });
  it("treats totals equal to the cent as a tie, whatever the order of the lines", () => {
    const amazon = group("Amazon", [tx({ amount: -36.41, date: "2026-01-02" }), tx({ amount: -2.58, date: "2026-01-02" }), tx({ amount: -1.01, date: "2026-01-02" })]);
    const boulanger = group("Boulanger", [tx({ amount: -40, date: "2026-03-05" })]);
    expect(amazon.total).not.toBe(40);
    expect(stepOrder([boulanger, amazon]).map((g) => g.name)).toEqual(["Amazon", "Boulanger"]);
  });
  it("breaks ties with the oldest payment, then the name", () => {
    const recent = group("Récent", [tx({ amount: -20, date: "2026-05-01" })]);
    const old = group("Ancien", [tx({ amount: -20, date: "2026-01-15" })]);
    const twin = group("Bis", [tx({ amount: -20, date: "2026-01-15" })]);
    expect(stepOrder([recent, twin, old]).map((g) => g.name)).toEqual(["Ancien", "Bis", "Récent"]);
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
