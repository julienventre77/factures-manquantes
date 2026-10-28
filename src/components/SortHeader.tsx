import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Sort } from "@/lib/sort";

export function SortHeader<K extends string>({ label, k, sort, onSort, firstDir = "asc", align, className }: {
  label: string; k: K; sort: Sort<K>; onSort: (k: K, firstDir: "asc" | "desc") => void;
  firstDir?: "asc" | "desc"; align?: "right" | undefined; className?: string | undefined;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2.5 font-semibold", align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(k, firstDir)}
        className={cn("inline-flex items-center gap-1 whitespace-nowrap hover:text-primary", active && "text-primary")}
      >
        {label} <Icon aria-hidden className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}
