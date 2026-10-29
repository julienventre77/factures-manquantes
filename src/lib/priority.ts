import type { SupplierGroup } from "./session";

type SearchableTx = { label: string; supplier: string; amount: number; date: string };

// Order of the client's steps: groups left to do first, the largest amount still
// to justify first, then the oldest payment, then by name.
export function prioritize(groups: SupplierGroup[]): SupplierGroup[] {
  const info = new Map(
    groups.map((g) => {
      const todo = g.txs.filter((t) => t.status === "a_faire");
      return [g.key, {
        done: todo.length === 0,
        // In cents, as in stepOrder: sums of the same amounts can differ by a hair.
        amount: Math.round(todo.reduce((s, t) => s + Math.abs(Number(t.amount)), 0) * 100),
        oldest: todo.reduce((d, t) => (t.date < d ? t.date : d), "9999-12-31"),
      }] as const;
    }),
  );
  return [...groups].sort((a, b) => {
    const x = info.get(a.key)!;
    const y = info.get(b.key)!;
    if (x.done !== y.done) return x.done ? 1 : -1;
    if (x.amount !== y.amount) return y.amount - x.amount;
    if (x.oldest !== y.oldest) return x.oldest < y.oldest ? -1 : 1;
    return a.name.localeCompare(b.name, "fr");
  });
}

// Order of the steps inside the flow. It must not move while the client answers,
// so it uses each group's whole amount and oldest payment, not what is left to do.
export function stepOrder(groups: SupplierGroup[]): SupplierGroup[] {
  const oldest = (g: SupplierGroup) => g.txs.reduce((d, t) => (t.date < d ? t.date : d), "9999-12-31");
  const cents = (g: SupplierGroup) => Math.round(g.total * 100);
  return [...groups].sort((a, b) => cents(b) - cents(a) || oldest(a).localeCompare(oldest(b)) || a.name.localeCompare(b.name, "fr"));
}

// Case, accents and spaces are ignored; "389.90" and "389,90" are the same amount.
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/\s+/g, "");
}

// What a search can match for one payment: counterpart, bank label, amount ("1245,90") and date ("14/01/2026").
export function txHaystack(t: SearchableTx): string {
  const [y, m, d] = t.date.slice(0, 10).split("-");
  return normalizeSearch(`${t.supplier} ${t.label} ${Math.abs(Number(t.amount)).toFixed(2)} ${d}/${m}/${y}`);
}

export function matchesSearch(haystack: string, query: string): boolean {
  const q = normalizeSearch(query);
  return !q || haystack.includes(q);
}
