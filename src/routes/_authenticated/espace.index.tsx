import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { meQuery, groupBySupplier, formatEUR, type Tx } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/espace/")({
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
        .order("date");
      if (error) throw error;
      return data as Tx[];
    },
  });
  return { me, txs, dossierId };
}

const STATE = {
  todo: { label: "À faire", cls: "bg-warning text-warning-foreground" },
  progress: { label: "En cours", cls: "bg-secondary text-secondary-foreground" },
  done: { label: "Terminé", cls: "bg-success text-success-foreground" },
};

function Espace() {
  const { me, txs } = useClientTxs();
  const groups = groupBySupplier(txs.data ?? []);
  const all = txs.data ?? [];
  const remaining = all.filter((t) => t.status === "a_faire").length;
  const pendingSuppliers = groups.filter((g) => g.state !== "done").length;
  const pct = all.length ? Math.round(((all.length - remaining) / all.length) * 100) : 100;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        {me.data && !me.data.dossierId ? (
          <p className="text-muted-foreground">Votre compte n'est rattaché à aucun dossier. Contactez votre cabinet.</p>
        ) : txs.isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : remaining === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" />
            <h1 className="text-2xl font-semibold">Tout est à jour, merci !</h1>
            <p className="mt-2 text-muted-foreground">Nous n'attendons aucune facture de votre part pour le moment.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Il nous manque {remaining} facture{remaining > 1 ? "s" : ""} chez {pendingSuppliers} fournisseur
              {pendingSuppliers > 1 ? "s" : ""}
            </h1>
            <p className="mt-2 text-muted-foreground">Choisissez un fournisseur pour commencer. Cela prend quelques minutes.</p>
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm">
                <span>Votre progression</span>
                <span className="font-semibold">{pct} %</span>
              </div>
              <Progress value={pct} className="h-3" />
            </div>
          </>
        )}

        <div className="mt-8 space-y-3">
          {groups.map((g) => (
            <Link
              key={g.name}
              to="/espace/$supplier"
              params={{ supplier: g.name }}
              className="flex items-center justify-between rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div>
                <div className="text-lg font-semibold">{g.name}</div>
                <div className="text-sm text-muted-foreground">
                  {g.txs.length} paiement{g.txs.length > 1 ? "s" : ""} · {formatEUR(g.total)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={STATE[g.state].cls}>{STATE[g.state].label}</Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
