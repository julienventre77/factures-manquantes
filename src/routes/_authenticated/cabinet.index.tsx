import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, ChevronRight, Euro, Eye, Folder, Inbox, MailWarning, Plus, Search, Send, UserX, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterChip } from "@/components/FilterChip";
import { SortHeader } from "@/components/SortHeader";
import { compareBy, useSort } from "@/lib/sort";
import { SourcePill } from "@/components/StatusPill";
import { requireCabinet, formatEUR } from "@/lib/session";
import { formatSyncDate, isToday } from "@/lib/dates";
import { normalizeSearch } from "@/lib/priority";
import { McpPanel } from "@/components/McpPanel";
import { CabinetChat } from "@/components/CabinetChat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cabinet/")({
  beforeLoad: requireCabinet,
  head: () => ({
    meta: [
      { title: "Dossiers clients — PBC List" },
      { name: "description", content: "Suivi des factures manquantes par dossier client." },
      { property: "og:title", content: "Dossiers clients — PBC List" },
      { property: "og:description", content: "Suivi des factures manquantes par dossier client." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cabinet,
});

type SortKey = "name" | "pending" | "sent" | "received" | "progress" | "sync";

function Cabinet() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", company_id: "", collect_email: "" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "address" | "members">("all");
  const [sort, toggleSort] = useSort<SortKey>({ key: "pending", dir: "desc" });
  const dossiers = useQuery({
    queryKey: ["dossiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("*, dossier_members(email), transactions(status, is_open, review_state, amount)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("dossiers").insert({
      name: form.name, company_id: form.company_id, collect_email: form.collect_email || null,
    });
    if (error) { toast.error(error.message); return; }
    setForm({ name: "", company_id: "", collect_email: "" });
    toast.success("Dossier créé");
    qc.invalidateQueries({ queryKey: ["dossiers"] });
  }

  const rows = (dossiers.data ?? []).map((d) => {
    const open = d.transactions.filter((t) => t.is_open);
    const sentTx = open.filter((t) => t.review_state === "sent");
    const sent = sentTx.length;
    const received = sentTx.filter((t) => t.status !== "a_faire").length;
    return {
      d,
      pending: open.filter((t) => t.review_state === "pending").length,
      sent,
      received,
      progress: sent ? Math.round((received / sent) * 100) : -1,
      toJustify: open.filter((t) => t.review_state !== "dismissed" && t.status === "a_faire").reduce((s, t) => s + Math.abs(Number(t.amount)), 0),
      missingAddress: !d.collect_email || !d.collect_email_customers,
      members: d.dossier_members.length,
    };
  });
  type Row = (typeof rows)[number];

  const totals = {
    pending: rows.reduce((n, r) => n + r.pending, 0),
    pendingDossiers: rows.filter((r) => r.pending > 0).length,
    sent: rows.reduce((n, r) => n + r.sent, 0),
    received: rows.reduce((n, r) => n + r.received, 0),
    toJustify: rows.reduce((n, r) => n + r.toJustify, 0),
    syncedToday: rows.filter((r) => isToday(r.d.last_sync_at)).length,
  };
  const counts = {
    all: rows.length,
    pending: totals.pendingDossiers,
    address: rows.filter((r) => r.missingAddress).length,
    members: rows.filter((r) => r.members === 0).length,
  };

  const q = normalizeSearch(query);
  const get: Record<SortKey, (r: Row) => string | number> = {
    name: (r) => r.d.name,
    pending: (r) => r.pending,
    sent: (r) => r.sent,
    received: (r) => r.received,
    progress: (r) => r.progress,
    sync: (r) => r.d.last_sync_at ?? "",
  };
  const visible = rows
    .filter((r) => !q || normalizeSearch(`${r.d.name} ${r.d.company_id}`).includes(q))
    .filter((r) =>
      filter === "pending" ? r.pending > 0 : filter === "address" ? r.missingAddress : filter === "members" ? r.members === 0 : true,
    )
    .sort(compareBy(get[sort.key], sort.dir));

  return (
    <div className="space-cabinet min-h-screen bg-background pb-24">
      <AppHeader space="cabinet" /><CabinetChat dossierId={null} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Dossiers clients</h1>
            <p className="text-sm text-muted-foreground">{rows.length} dossier{rows.length > 1 ? "s" : ""} suivi{rows.length > 1 ? "s" : ""}</p>
          </div>
          <Button asChild>
            <a href="#nouveau-dossier"><Plus /> Nouveau dossier</a>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi icon={Folder} label="Dossiers" value={String(rows.length)} sub={`${totals.syncedToday} synchronisé${totals.syncedToday > 1 ? "s" : ""} aujourd'hui`} />
          <Kpi icon={Eye} label="Demandes à valider" value={String(totals.pending)} sub={`dans ${totals.pendingDossiers} dossier${totals.pendingDossiers > 1 ? "s" : ""}`} highlight={totals.pending > 0} />
          <Kpi icon={Send} label="Envoyées au client" value={String(totals.sent)} sub={`${totals.sent - totals.received} en attente de réponse`} />
          <Kpi icon={Inbox} label="Réponses reçues" value={String(totals.received)} sub={totals.sent ? `${Math.round((totals.received / totals.sent) * 100)} % des demandes envoyées` : "aucune demande envoyée"} />
          <Kpi icon={Euro} label="Montant restant à justifier" value={formatEUR(totals.toJustify)} sub="à valider ou en attente du client" className="col-span-2 lg:col-span-1" />
        </div>

        <McpPanel existing={rows.map((r) => r.d.company_id)} />

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[16rem] flex-1 sm:max-w-sm">
            <span className="sr-only">Rechercher un dossier</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un dossier ou un company_id" className="h-9 bg-card pl-9" />
          </label>
          <FilterChip size="sm" active={filter === "all"} onClick={() => setFilter("all")} count={counts.all}>Tous</FilterChip>
          <FilterChip size="sm" active={filter === "pending"} onClick={() => setFilter("pending")} count={counts.pending} icon={Eye}>Avec lignes à valider</FilterChip>
          <FilterChip size="sm" active={filter === "address"} onClick={() => setFilter("address")} count={counts.address} icon={MailWarning}>Adresse manquante</FilterChip>
          <FilterChip size="sm" active={filter === "members"} onClick={() => setFilter("members")} count={counts.members} icon={UserX}>Sans compte client</FilterChip>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b bg-muted/60 text-left text-muted-foreground">
              <tr>
                <SortHeader label="Dossier" k="name" sort={sort} onSort={toggleSort} />
                <th scope="col" className="px-3 py-2.5 font-semibold">company_id</th>
                <SortHeader label="À valider" k="pending" sort={sort} onSort={toggleSort} firstDir="desc" align="right" />
                <SortHeader label="Envoyées" k="sent" sort={sort} onSort={toggleSort} firstDir="desc" align="right" />
                <SortHeader label="Reçues" k="received" sort={sort} onSort={toggleSort} firstDir="desc" align="right" />
                <SortHeader label="Avancement" k="progress" sort={sort} onSort={toggleSort} firstDir="desc" />
                <SortHeader label="Dernière synchro" k="sync" sort={sort} onSort={toggleSort} />
                <th scope="col" className="w-10"><span className="sr-only">Ouvrir</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dossiers.isLoading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Chargement…</td></tr>
              )}
              {!dossiers.isLoading && visible.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">{rows.length === 0 ? "Aucun dossier pour l'instant." : "Aucun dossier ne correspond."}</td></tr>
              )}
              {visible.map((r) => (
                <tr key={r.d.id} className="cursor-pointer hover:bg-pale-2/60" onClick={() => navigate({ to: "/cabinet/$dossierId", params: { dossierId: r.d.id } })}>
                  <td className="px-3 py-2.5">
                    <Link to="/cabinet/$dossierId" params={{ dossierId: r.d.id }} className="font-bold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {r.d.name}
                    </Link>
                    <div className="flex flex-wrap gap-x-3 text-xs">
                      {r.missingAddress && <span className="inline-flex items-center gap-1 text-yellow-ink"><AlertTriangle className="h-3.5 w-3.5" /> Adresse de collecte à renseigner</span>}
                      {r.members === 0 && <span className="inline-flex items-center gap-1 text-yellow-ink"><UserX className="h-3.5 w-3.5" /> Aucun compte client</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{r.d.company_id}</span></td>
                  <td className="px-3 py-2.5 text-right">
                    {r.pending > 0 ? <span className="rounded-full bg-yellow-soft px-2 py-0.5 font-bold text-yellow-ink">{r.pending}</span> : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.sent}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.received}</td>
                  <td className="px-3 py-2.5">
                    {r.progress < 0 ? <span className="text-muted-foreground">Rien d'envoyé</span> : (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${r.progress}%` }} /></span>
                        <span className="tabular-nums">{r.progress} %</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap items-center gap-2">
                      {r.d.last_sync_at ? formatSyncDate(r.d.last_sync_at) : <span className="text-muted-foreground">Jamais</span>}
                      {r.d.last_sync_source && <SourcePill source={r.d.last_sync_source} />}
                      {r.d.last_sync_error && <span title={r.d.last_sync_error} className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Erreur</span>}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div id="nouveau-dossier" className="scroll-mt-6 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5" /> Nouveau dossier</h2>
          <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_12rem_1.5fr_auto]">
            <div className="space-y-1"><Label htmlFor="nd-name">Nom</Label>
              <Input id="nd-name" required placeholder="Ex. : SAS Exemple" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="nd-company">company_id Pennylane</Label>
              <Input id="nd-company" required placeholder="Ex. : 1234567" className="font-mono" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="nd-collect">Adresse de collecte</Label>
              <Input id="nd-collect" type="email" placeholder="nom-du-dossier-XXXX@suppliers.pennylane.com" className="font-mono" value={form.collect_email}
                onChange={(e) => setForm({ ...form, collect_email: e.target.value })} /></div>
            <Button type="submit"><Plus /> Créer le dossier</Button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, highlight, className }: {
  icon: LucideIcon; label: string; value: ReactNode; sub: string; highlight?: boolean; className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm", highlight && "border-yellow bg-yellow-soft/40", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", highlight ? "bg-yellow-soft text-yellow-ink" : "bg-pale text-primary")}>
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-primary sm:text-3xl">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
