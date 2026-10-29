import { requireClient } from "@/lib/session";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpChat } from "@/components/HelpChat";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowDownWideNarrow, ArrowRight, CalendarCheck, CheckCircle2, ChevronDown, ChevronRight, Clock, ReceiptText, Search, ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader, CabinetContact } from "@/components/AppHeader";
import { SupplierAvatar } from "@/components/brand";
import { FilterChip } from "@/components/FilterChip";
import { GroupStatePill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { useCabinet } from "@/lib/cabinet";
import { matchesSearch, prioritize, txHaystack } from "@/lib/priority";
import { meQuery, groupBySupplier, formatEUR, type SupplierGroup, type Tx } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/espace/")({
  beforeLoad: requireClient,
  head: () => ({
    meta: [
      { title: "Mes factures à transmettre — PBC List" },
      { name: "description", content: "Les factures fournisseurs que votre cabinet attend." },
      { property: "og:title", content: "Mes factures à transmettre — PBC List" },
      { property: "og:description", content: "Les factures fournisseurs que votre cabinet attend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Espace,
});

export function useClientTxs() {
  const me = useQuery(meQuery);
  const dossierId = me.data?.dossierId;
  const txs = useQuery({
    queryKey: ["client-txs", dossierId],
    enabled: !!dossierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("dossier_id", dossierId!)
        .eq("is_open", true)
        .eq("review_state", "sent")
        .order("date")
        .order("id");
      if (error) throw error;
      return data as Tx[];
    },
  });
  return { me, txs, dossierId };
}

export function useClientDossier(dossierId: string | null | undefined) {
  return useQuery({
    queryKey: ["dossier", dossierId],
    enabled: !!dossierId,
    queryFn: async () =>
      (await supabase.from("dossiers").select("name, collect_email, collect_email_customers").eq("id", dossierId!).single()).data,
  });
}

// "3 fournisseurs", "1 client" or "2 fournisseurs ou clients", depending on what is left to do.
function counterparts(groups: SupplierGroup[]) {
  const s = groups.length > 1 ? "s" : "";
  const out = groups.some((g) => g.direction === "out");
  const inn = groups.some((g) => g.direction === "in");
  const noun = out && inn ? `fournisseur${s} ou client${s}` : inn ? `client${s}` : `fournisseur${s}`;
  return `${groups.length} ${noun}`;
}

const todoCount = (g: SupplierGroup) => g.txs.filter((t) => t.status === "a_faire").length;

function Espace() {
  const cabinet = useCabinet();
  const { me, txs, dossierId } = useClientTxs();
  const dossier = useClientDossier(dossierId);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "todo" | "done">("all");
  const [dir, setDir] = useState<"all" | "out" | "in">("all");
  const [order, setOrder] = useState<"priority" | "name">("priority");

  const all = txs.data ?? [];
  const steps = prioritize(groupBySupplier(all));
  const remaining = all.filter((t) => t.status === "a_faire").length;
  const pendingGroups = steps.filter((g) => g.state !== "done");
  const next = pendingGroups[0];
  const pct = all.length ? Math.round(((all.length - remaining) / all.length) * 100) : 100;
  const years = [...new Set(all.filter((t) => t.status === "a_faire").map((t) => t.date.slice(0, 4)))].sort();
  const bothDirections = steps.some((g) => g.direction === "in") && steps.some((g) => g.direction === "out");

  const ordered = order === "priority" ? steps : [...steps].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const visible = ordered.filter(
    (g) =>
      (status === "all" || (status === "done") === (g.state === "done")) &&
      (dir === "all" || g.direction === dir) &&
      g.txs.some((t) => matchesSearch(txHaystack(t), query)),
  );
  const filtered = query.trim() !== "" || status !== "all" || dir !== "all";

  return (
    <div className="min-h-screen bg-background pb-28 sm:text-[17px]">
      <AppHeader space="client" /><HelpChat />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        {me.data && !me.data.dossierId ? (
          <p className="text-muted-foreground">Votre compte n'est rattaché à aucun dossier. Contactez votre cabinet.</p>
        ) : txs.isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl">Bonjour,</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {remaining === 0
                ? all.length === 0
                  ? "Aucune facture ne vous est demandée pour le moment."
                  : "Merci pour vos réponses."
                : `Voici les factures qui nous manquent encore${dossier.data?.name ? ` pour ${dossier.data.name}` : ""}. Vous pouvez vous arrêter à tout moment et reprendre plus tard : tout est enregistré au fur et à mesure.`}
            </p>

            {remaining === 0 ? (
              <section className="mt-6 rounded-3xl bg-primary px-6 py-10 text-center text-primary-foreground sm:px-12">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint text-primary">
                  <CheckCircle2 className="h-9 w-9" />
                </span>
                <h2 className="mt-5 text-2xl text-primary-foreground sm:text-3xl">Tout est à jour, merci !</h2>
                <p className="mt-2 text-primary-foreground/80">Nous n'attendons aucune facture de votre part pour le moment.</p>
              </section>
            ) : (
              <section className="relative mt-6 overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/20 sm:p-10">
                <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[56px] border-teal-2/60" />
                <div className="relative">
                  {years.length > 0 && (
                    <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-mint">
                      <CalendarCheck className="h-4 w-4" /> Opérations {years.length > 1 ? `${years[0]} – ${years.at(-1)}` : years[0]}
                    </p>
                  )}
                  <h2 className="mt-3 max-w-2xl text-2xl leading-tight text-primary-foreground sm:text-4xl">
                    Il nous manque {remaining} facture{remaining > 1 ? "s" : ""}
                    {remaining > 1 && pendingGroups.length > 1 ? ", réparties chez " : ", chez "}
                    {counterparts(pendingGroups)}
                  </h2>
                  <div className="mt-6 max-w-xl">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-base font-bold">
                        <CheckCircle2 className="h-5 w-5 text-mint" /> {all.length - remaining} sur {all.length} traitée{all.length - remaining > 1 ? "s" : ""}
                      </span>
                      <span className="text-primary-foreground/80">{remaining} restante{remaining > 1 ? "s" : ""}</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Votre progression"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-3 overflow-hidden rounded-full bg-teal-2"
                    >
                      <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {next && (
                    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                      <Link
                        to="/espace/$supplier"
                        params={{ supplier: next.key }}
                        className="inline-flex h-14 items-center gap-2 rounded-xl bg-mint px-7 text-lg font-bold text-primary shadow-lg transition-colors hover:bg-mint-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
                      >
                        Je continue <ArrowRight className="h-5 w-5" />
                      </Link>
                      <span className="text-primary-foreground/85">
                        Prochaine étape : <strong className="text-primary-foreground">{next.name}</strong>, {todoCount(next)} facture
                        {todoCount(next) > 1 ? "s" : ""} à transmettre
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {steps.length > 0 && (
              <div className="mt-8 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="relative flex-1 sm:min-w-[16rem]">
                    <span className="sr-only">Rechercher</span>
                    <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher un fournisseur, un montant, une date"
                      className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-3 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="relative sm:shrink-0">
                    <span className="sr-only">Ordre d'affichage</span>
                    <ArrowDownWideNarrow aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                    <select
                      value={order}
                      onChange={(e) => setOrder(e.target.value as "priority" | "name")}
                      className="h-12 w-full appearance-none rounded-xl border border-input bg-card pl-11 pr-10 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="priority">Par priorité</option>
                      <option value="name">Par ordre alphabétique</option>
                    </select>
                    <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <FilterChip active={status === "todo"} onClick={() => setStatus((s) => (s === "todo" ? "all" : "todo"))} icon={Clock}>
                    À faire
                  </FilterChip>
                  <FilterChip active={status === "done"} onClick={() => setStatus((s) => (s === "done" ? "all" : "done"))} icon={CheckCircle2}>
                    Terminé
                  </FilterChip>
                  {bothDirections && (
                    <>
                      <span aria-hidden className="mx-1 h-6 w-px bg-cream-3" />
                      <FilterChip active={dir === "out"} onClick={() => setDir((d) => (d === "out" ? "all" : "out"))} icon={ShoppingBag}>
                        Achats
                      </FilterChip>
                      <FilterChip active={dir === "in"} onClick={() => setDir((d) => (d === "in" ? "all" : "in"))} icon={ReceiptText}>
                        Ventes
                      </FilterChip>
                    </>
                  )}
                </div>
              </div>
            )}

            {filtered && visible.length === 0 && (
              <div className="mt-8 rounded-2xl border border-dashed border-cream-3 bg-card/60 p-6 text-center">
                <p className="text-muted-foreground">Aucun résultat pour cette recherche.</p>
                <Button variant="outline" className="mt-3" onClick={() => { setQuery(""); setStatus("all"); setDir("all"); }}>
                  Tout afficher
                </Button>
              </div>
            )}

            {(["out", "in"] as const).map((d) => {
              const list = visible.filter((g) => g.direction === d);
              if (!list.length) return null;
              const todo = list.reduce((n, g) => n + todoCount(g), 0);
              const Icon = d === "out" ? ShoppingBag : ReceiptText;
              return (
                <section key={d} className="mt-10">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <h2 className="flex items-center gap-3 text-xl sm:text-2xl">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pale text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      {d === "out" ? "Achats — factures fournisseurs manquantes" : "Ventes — factures clients manquantes"}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      {todo} à transmettre · {list.length} {d === "out" ? "fournisseur" : "client"}{list.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {list.map((g) => <SupplierCard key={g.key} g={g} />)}
                  </div>
                </section>
              );
            })}
          </>
        )}

        {(cabinet.email || cabinet.phone) && (
          <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            Une question ? {cabinet.name} vous répond : <CabinetContact />
          </div>
        )}
      </main>
    </div>
  );
}

function SupplierCard({ g }: { g: SupplierGroup }) {
  const done = g.txs.length - todoCount(g);
  const noun = g.direction === "in" ? "encaissement" : "paiement";
  return (
    <Link
      to="/espace/$supplier"
      params={{ supplier: g.key }}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        g.state === "done" ? "bg-card/60" : "bg-card shadow-sm",
      )}
    >
      <SupplierAvatar name={g.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold text-primary">{g.name}</div>
        <div className="text-sm text-muted-foreground">
          {g.txs.length} {noun}{g.txs.length > 1 ? "s" : ""} · <span className="font-semibold text-foreground">{formatEUR(g.total)}</span>
        </div>
        {g.state === "progress" && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-cream-2">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((done / g.txs.length) * 100)}%` }} />
            </span>
            {done} sur {g.txs.length} traité{done > 1 ? "s" : ""}
          </div>
        )}
        <GroupStatePill state={g.state} className="mt-2 sm:hidden" />
      </div>
      <GroupStatePill state={g.state} className="hidden sm:inline-flex" />
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
