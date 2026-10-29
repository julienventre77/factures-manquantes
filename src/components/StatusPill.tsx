import type { ReactNode } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, Clock, Contrast, Eye, FileCheck2, FileX, MailCheck, Plug, Send,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type SupplierGroup, type Tx } from "@/lib/session";

const TONES = {
  todo: "bg-yellow-soft text-yellow-ink",
  ok: "bg-mint-soft text-primary",
  info: "bg-pale text-primary",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-red-soft text-destructive",
};

// Status badge with colour AND icon, so the status never relies on colour alone.
export function Pill({ tone, icon: Icon, children, className }: {
  tone: keyof typeof TONES; icon: LucideIcon; children: ReactNode; className?: string | undefined;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", TONES[tone], className)}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

const TX: Record<Tx["status"], { tone: keyof typeof TONES; icon: LucideIcon }> = {
  a_faire: { tone: "todo", icon: Clock },
  depose: { tone: "ok", icon: FileCheck2 },
  email: { tone: "ok", icon: MailCheck },
  sans_facture: { tone: "danger", icon: FileX },
};

export function TxStatusPill({ status }: { status: Tx["status"] }) {
  const s = TX[status];
  return <Pill tone={s.tone} icon={s.icon}>{STATUS_LABEL[status]}</Pill>;
}

const GROUP: Record<SupplierGroup["state"], { tone: keyof typeof TONES; icon: LucideIcon; label: string }> = {
  todo: { tone: "todo", icon: Clock, label: "À faire" },
  progress: { tone: "info", icon: Contrast, label: "En cours" },
  done: { tone: "ok", icon: CheckCircle2, label: "Terminé" },
};

export function GroupStatePill({ state, className }: { state: SupplierGroup["state"]; className?: string | undefined }) {
  const s = GROUP[state];
  return <Pill tone={s.tone} icon={s.icon} className={className}>{s.label}</Pill>;
}

const REVIEW = {
  pending: { tone: "todo", icon: Eye, label: "À valider" },
  sent: { tone: "info", icon: Send, label: "Envoyée au client" },
  dismissed: { tone: "muted", icon: Ban, label: "Non demandée" },
} satisfies Record<string, { tone: keyof typeof TONES; icon: LucideIcon; label: string }>;

export function ReviewPill({ state }: { state: string }) {
  const s = state === "pending" || state === "dismissed" ? REVIEW[state] : REVIEW.sent;
  return <Pill tone={s.tone} icon={s.icon}>{s.label}</Pill>;
}

// Where the last sync came from: the MCP (demo dossiers only), the API as the normal source, or the API used as a fallback.
export function SourcePill({ source }: { source: string }) {
  if (source === "MCP") return <Pill tone="ok" icon={Plug}>{source}</Pill>;
  if (source === "API") return <Pill tone="muted" icon={Plug}>{source}</Pill>;
  return <Pill tone="todo" icon={AlertTriangle}>{source}</Pill>;
}
