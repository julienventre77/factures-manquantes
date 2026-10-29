import { useState } from "react";

export type Sort<K extends string> = { key: K; dir: "asc" | "desc" };

// Click a column once to sort by it, again to reverse the order.
export function useSort<K extends string>(initial: Sort<K>) {
  const [sort, setSort] = useState(initial);
  const toggle = (key: K, firstDir: "asc" | "desc" = "asc") =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: firstDir }));
  return [sort, toggle] as const;
}

// Compares numbers, or strings the French way.
export function compareBy<T>(get: (row: T) => string | number, dir: "asc" | "desc") {
  return (a: T, b: T) => {
    const x = get(a);
    const y = get(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr");
    return dir === "asc" ? c : -c;
  };
}
