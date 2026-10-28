import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, RefreshCw, UserPlus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewPanel } from "@/components/ReviewPanel";
import { QuestionsPanel } from "@/components/QuestionsPanel";
import { createClientAccount } from "@/lib/admin.functions";
import { syncDossierNow } from "@/lib/sync.functions";
import { requireCabinet, meQuery, groupBySupplier, formatDate, formatEUR, STATUS_LABEL, type Tx } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/cabinet/$dossierId")({
  beforeLoad: requireCabinet,
  head: () => ({
    meta: [
      { title: "Tableau de bord du dossier — PBC List" },
      { name: "description", content: "Statut des justificatifs par fournisseur et par paiement." },
      { property: "og:title", content: "Tableau de bord du dossier — PBC List" },
      { property: "og:description", content: "Statut des justificatifs par fournisseur et par paiement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DossierPage,
});

const STATUS_CLS: Record<string, string> = {
  a_faire: "bg-warning text-warning-foreground",
  depose: "bg-success text-success-foreground",
  email: "bg-secondary text-secondary-foreground",
  sans_facture: "bg-destructive text-destructive-foreground",
};

function DossierPage() {
  const { dossierId } = Route.useParams();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const q = useQuery({
    queryKey: ["dossier-full", dossierId],
    queryFn: async () => {
      const [d, m, t, u] = await Promise.all([
        supabase.from("dossiers").select("*").eq("id", dossierId).single(),
        supabase.from("dossier_members").select("*").eq("dossier_id", dossierId),
        supabase.from("transactions").select("*").eq("dossier_id", dossierId).eq("is_open", true).order("date"),
        supabase.from("uploads").select("*").eq("dossier_id", dossierId),
      ]);
      if (d.error) throw d.error;
      return { dossier: d.data, members: m.data ?? [], txs: (t.data ?? []) as Tx[], uploads: u.data ?? [] };
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["dossier-full", dossierId] });

  async function sync() {
    setSyncing(true);
    try {
      const r = await syncDossierNow({ data: { dossierId } });
      toast.success(`Synchronisation terminée : ${r.open} demande(s) en cours, ${r.added} nouveau(x) paiement(s) à valider, ${r.closed} justifiée(s) entre-temps. Source : ${r.source}.`);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function download(path: string) {
    const { data, error } = await supabase.storage.from("factures").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function rename(detected: string, current: string) {
    const name = window.prompt(`Nom du fournisseur pour « ${detected} »`, current)?.trim();
    if (!name || name === current) return;
    await supabase.from("supplier_aliases").upsert(
      { dossier_id: dossierId, detected_name: detected, display_name: name },
      { onConflict: "dossier_id,detected_name" },
    );
    const { error } = await supabase.from("transactions").update({ supplier: name })
      .eq("dossier_id", dossierId).eq("supplier_detected", detected);
    if (error) { toast.error(error.message); return; }
    toast.success("Regroupement mis à jour");
    reload();
  }

  if (!q.data) return <div className="min-h-screen"><AppHeader space="cabinet" /><p className="p-8 text-muted-foreground">Chargement…</p></div>;
  const { dossier, members, txs, uploads } = q.data;
  const sent = txs.filter((t) => (t.review_state ?? "sent") === "sent");
  const groups = groupBySupplier(sent);

  return (
    <div className="min-h-screen">
      <AppHeader space="cabinet" />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Link to="/cabinet" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tous les dossiers
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{dossier.name}</h1>
            <p className="text-sm text-muted-foreground">
              Dernière synchronisation : {dossier.last_sync_at ? new Date(dossier.last_sync_at).toLocaleString("fr-FR") : "jamais"}
            </p>
            {dossier.last_sync_source && (
              <p className="text-sm text-muted-foreground">Source de la dernière synchronisation : {dossier.last_sync_source}</p>
            )}
            {dossier.last_mcp_error && <p className="text-sm text-destructive">Erreur MCP : {dossier.last_mcp_error}</p>}
            {dossier.last_sync_error && <p className="text-sm text-destructive">{dossier.last_sync_error}</p>}
          </div>
          <Button size="lg" onClick={sync} disabled={syncing}>
            <RefreshCw className={syncing ? "animate-spin" : ""} /> Actualiser maintenant
          </Button>
        </div>

        <DossierSettings dossier={dossier} onSaved={reload} />
        <Members dossierId={dossierId} members={members} onSaved={reload} />

        <QuestionsPanel dossierId={dossierId} />
        <ReviewPanel
          pending={txs.filter((t) => t.review_state === "pending")}
          dismissed={txs.filter((t) => t.review_state === "dismissed")}
          onChanged={reload}
        />

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Envoyés au client — tiers ({groups.length})</h2>
          {groups.length === 0 && <p className="text-muted-foreground">Aucune demande en cours.</p>}
          {groups.map((g) => (
            <Card key={g.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">{g.name}</CardTitle>
                <span className="text-sm text-muted-foreground">{g.direction === "in" ? "Client (vente)" : "Fournisseur (achat)"} · {g.txs.length} · {formatEUR(g.total)} · {g.state === "done" ? "Terminé" : g.state === "progress" ? "En cours" : "À faire"}</span>
              </CardHeader>
              <CardContent className="space-y-3">
                {g.txs.map((t) => (
                  <div key={t.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold">{formatEUR(Math.abs(Number(t.amount)))}</span>
                        <span className="text-muted-foreground"> · {formatDate(t.date)} · {t.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_CLS[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                        <Button variant="ghost" size="icon" title="Corriger le fournisseur" onClick={() => rename(t.supplier_detected, t.supplier)}>
                          <Pencil />
                        </Button>
                      </div>
                    </div>
                    {t.comment && <p className="mt-2 rounded bg-muted p-2 italic">« {t.comment} »</p>}
                    {uploads.filter((u) => u.transaction_id === t.id).map((u) => (
                      <Button key={u.id} variant="link" size="sm" className="px-0" onClick={() => download(u.storage_path)}>
                        <Download /> {u.file_name}
                      </Button>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}

function DossierSettings({ dossier, onSaved }: { dossier: { id: string; name: string; company_id: string; collect_email: string | null; collect_email_customers: string | null; detect_prefixes: string }; onSaved: () => void }) {
  const [f, setF] = useState({ name: dossier.name, company_id: dossier.company_id, collect_email: dossier.collect_email ?? "", collect_email_customers: dossier.collect_email_customers ?? "", detect_prefixes: dossier.detect_prefixes ?? "401, 411, 471" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("dossiers").update({ ...f, detect_prefixes: f.detect_prefixes.trim() || "401, 411, 471", collect_email: f.collect_email || null, collect_email_customers: f.collect_email_customers || null }).eq("id", dossier.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dossier enregistré");
    onSaved();
  }
  return (
    <Card>
      <CardHeader><CardTitle>Fiche du dossier</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1"><Label>Nom</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>company_id Pennylane</Label><Input value={f.company_id} onChange={(e) => setF({ ...f, company_id: e.target.value })} /></div>
          <div className="space-y-1"><Label>Adresse de collecte achats</Label>
            <Input type="email" placeholder="nom-du-dossier-XXXX@suppliers.pennylane.com" value={f.collect_email} onChange={(e) => setF({ ...f, collect_email: e.target.value })} /></div>
          <div className="space-y-1"><Label>Adresse de collecte ventes</Label>
            <Input type="email" placeholder="nom-du-dossier-XXXX@customers.pennylane.com" value={f.collect_email_customers} onChange={(e) => setF({ ...f, collect_email_customers: e.target.value })} /></div>
          <div className="space-y-1"><Label>Comptes surveillés (non lettrés)</Label>
            <Input placeholder="401, 411, 471" value={f.detect_prefixes} onChange={(e) => setF({ ...f, detect_prefixes: e.target.value })} /></div>
          <Button type="submit" variant="secondary" className="sm:col-span-3 sm:justify-self-start">Enregistrer</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Members({ dossierId, members, onSaved }: { dossierId: string; members: { id: string; email: string }[]; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createClientAccount({ data: { dossierId, email, password } });
      toast.success("Compte client créé. Transmettez l'e-mail et le mot de passe au client.");
      setEmail(""); setPassword("");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Comptes clients rattachés</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {members.length === 0 ? <p className="text-sm text-muted-foreground">Aucun compte.</p> : (
          <ul className="space-y-1 text-sm">{members.map((m) => <li key={m.id}>{m.email}</li>)}</ul>
        )}
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-3">
          <Input type="email" required placeholder="E-mail du client" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="text" required minLength={8} placeholder="Mot de passe initial (8+)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" disabled={busy}><UserPlus /> Créer le compte</Button>
        </form>
      </CardContent>
    </Card>
  );
}
