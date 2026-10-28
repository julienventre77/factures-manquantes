import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Toggle chip used for filters: large on the client side, compact on the cabinet side.
export function FilterChip({ active, onClick, icon: Icon, count, size = "lg", children }: {
  active: boolean; onClick: () => void; icon?: LucideIcon; count?: number; size?: "lg" | "sm"; children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        size === "lg" ? "h-11 px-4" : "h-9 px-3 text-sm",
        active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-primary hover:bg-pale-2",
      )}
    >
      {Icon && <Icon aria-hidden className="h-4 w-4" />}
      {children}
      {count != null && (
        <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{count}</span>
      )}
    </button>
  );
}
