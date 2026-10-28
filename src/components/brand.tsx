import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/supplier";

// Firm logo (design option C), or its monogram while no logo is uploaded.
export function Monogram({ name, logoUrl, className }: { name: string; logoUrl?: string | null | undefined; className?: string | undefined }) {
  if (logoUrl)
    return (
      <img
        src={logoUrl}
        alt={`Logo ${name}`}
        className={cn("h-11 w-11 shrink-0 rounded-lg border bg-card object-contain p-0.5", className)}
      />
    );
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card text-sm font-bold tracking-wide text-primary",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

// PBC List mark: mint square on the teal cabinet bar, teal square elsewhere.
export function BrandMark({ tone = "teal", className }: { tone?: "teal" | "mint"; className?: string | undefined }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        tone === "mint" ? "bg-mint text-primary" : "bg-primary text-mint",
        className,
      )}
    >
      <ListChecks className="h-5 w-5" />
    </span>
  );
}

const AVATAR_TONES = [
  "bg-yellow-soft text-yellow-ink",
  "bg-mint-soft text-primary",
  "bg-pale text-primary",
  "bg-cream-2 text-primary",
];

// Initials avatar for a supplier or customer; no third-party logos.
export function SupplierAvatar({ name, className }: { name: string; className?: string | undefined }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold",
        AVATAR_TONES[hash % AVATAR_TONES.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
