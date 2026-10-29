import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Mail, RefreshCw, Save, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinesTable } from "@/components/LinesTable";
import { QuestionsPanel } from "@/components/QuestionsPanel";
import { SkipRulesPanel } from "@/components/SkipRulesPanel";
import { CabinetChat } from "@/components/CabinetChat";
import { ClaudeAnalysis } from "@/components/ClaudeAnalysis";
import { SaisieAugmentee } from "@/components/SaisieAugmentee";
import { SourcePill } from "@/components/StatusPill";
import { createClientAccount } from "@/lib/admin.functions";
import { syncDossierNow } from "@/lib/sync.functions";
import { formatSyncDate } from "@/lib/dates";
import { requireCabinet, type Tx } from "@/lib/session";

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

function DossierPage() {
  const { dossierId } = Route.useParams();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [saisie, setSaisie] = useState<string | null>(null);
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
      toast.success(`Synchronisation terminée : ${r.open} demande(s) en cours, ${r.added} nouveau(x) paiement(s) à valider, ${r.closed} justifiée(s) entre-temps${r.skipped ? `, ${r.skipped} mise(s) de côté par une règle` : ""}. Source : ${r.source}.`);
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

  // Resolves to the new name, or null when nothing changed.
  async function rename(detected: string, current: string): Promise<string | null> {
    const name = window.prompt(`Nom du fournisseur pour « ${detected} »`, current)?.trim();
    if (!name || name === current) return null;
    await supabase.from("supplier_aliases").upsert(
      { dossier_id: dossierId, detected_name: detected, display_name: name },
      { onConflict: "dossier_id,detected_name" },
    );
    const { error } = await supabase.from("transactions").update({ supplier: name })
      .eq("dossier_id", dossierId).eq("supplier_detected", detected);
    if (error) { toast.error(error.message); return null; }
    toast.success("Regroupement mis à jour");
    reload();
    return name;
  }

  if (!q.data)
    return <div className="space-cabinet min-h-screen bg-background"><AppHeader space="cabinet" /><p className="p-8 text-muted-foreground">Chargement…</p></div>;
  const { dossier, members, txs, uploads } = q.data;

  return (
    <div className="space-cabinet min-h-screen bg-background pb-24">
      <AppHeader space="cabinet" /><CabinetChat dossierId={dossierId} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm">
          <Link to="/cabinet" className="font-semibold text-primary hover:underline">Dossiers clients</Link>
          <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{dossier.name}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl">{dossier.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>company_id <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{dossier.company_id}</span></span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> Adresse de collecte
                {dossier.collect_email
                  ? <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{dossier.collect_email}</span>
                  : <span className="font-semibold text-yellow-ink">à renseigner</span>}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" /> Dernière synchro : {dossier.last_sync_at ? formatSyncDate(dossier.last_sync_at) : "jamais"}
              {dossier.last_sync_source && <SourcePill source={dossier.last_sync_source} />}
              <span>· comptes {dossier.detect_prefixes}</span>
            </div>
          </div>
          <Button variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw className={syncing ? "animate-spin" : ""} /> Actualiser maintenant
          </Button>
        </div>

        {(dossier.last_mcp_error || dossier.last_sync_error) && (
          <div role="alert" className="space-y-1 rounded-xl border border-destructive/30 bg-red-soft p-3 text-sm text-destructive">
            {dossier.last_mcp_error && <p>Erreur MCP : {dossier.last_mcp_error}</p>}
            {dossier.last_sync_error && <p>{dossier.last_sync_error}</p>}
          </div>
        )}
        {(!dossier.collect_email || !dossier.collect_email_customers) && (
          <Notice>
            Adresse de collecte {!dossier.collect_email && !dossier.collect_email_customers ? "achats et ventes" : !dossier.collect_email ? "achats" : "ventes"} à renseigner :
            sans elle, le client ne peut pas transférer ses factures par e-mail. <a href="#fiche" className="font-semibold underline">Compléter la fiche</a>
          </Notice>
        )}
        {members.length === 0 && (
          <Notice>
            Aucun compte client : le client ne peut pas encore voir ses demandes. <a href="#comptes" className="font-semibold underline">Créer un compte</a>
          </Notice>
        )}

        <QuestionsPanel dossierId={dossierId} />
        <ClaudeAnalysis dossierId={dossierId} onApplied={reload} />
        <LinesTable txs={txs} uploads={uploads} onChanged={reload} onRename={rename} onDownload={download} onSaisie={setSaisie} />
        <SaisieAugmentee uploadId={saisie} onClose={() => setSaisie(null)} />
        <SkipRulesPanel dossierId={dossierId} txs={txs} onChanged={reload} />

        <div className="grid gap-5 lg:grid-cols-2">
          <DossierSettings dossier={dossier} onSaved={reload} />
          <Members dossierId={dossierId} members={members} onSaved={reload} />
        </div>
      </main>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-yellow/60 bg-yellow-soft/60 p-3 text-sm text-yellow-ink">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
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
    <section id="fiche" className="scroll-mt-6 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg">Fiche du dossier</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="f-name">Nom</Label><Input id="f-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="f-company">company_id Pennylane</Label><Input id="f-company" className="font-mono" value={f.company_id} onChange={(e) => setF({ ...f, company_id: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="f-collect">Adresse de collecte achats</Label>
          <Input id="f-collect" type="email" className="font-mono" placeholder="nom-du-dossier-XXXX@suppliers.pennylane.com" value={f.collect_email} onChange={(e) => setF({ ...f, collect_email: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="f-collect-customers">Adresse de collecte ventes</Label>
          <Input id="f-collect-customers" type="email" className="font-mono" placeholder="nom-du-dossier-XXXX@customers.pennylane.com" value={f.collect_email_customers} onChange={(e) => setF({ ...f, collect_email_customers: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="f-prefixes">Comptes surveillés (non lettrés)</Label>
          <Input id="f-prefixes" className="font-mono" placeholder="401, 411, 471" value={f.detect_prefixes} onChange={(e) => setF({ ...f, detect_prefixes: e.target.value })} /></div>
        <div className="flex items-end">
          <Button type="submit"><Save /> Enregistrer</Button>
        </div>
      </form>
    </section>
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
    <section id="comptes" className="scroll-mt-6 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" /> Comptes clients rattachés</h2>
      <div className="mt-3">
        {members.length === 0 ? <p className="text-sm text-muted-foreground">Aucun compte.</p> : (
          <ul className="space-y-1 text-sm">{members.map((m) => <li key={m.id} className="font-mono">{m.email}</li>)}</ul>
        )}
      </div>
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input type="email" required placeholder="E-mail du client" aria-label="E-mail du client" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="text" required minLength={8} placeholder="Mot de passe initial (8+)" aria-label="Mot de passe initial" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" disabled={busy}><UserPlus /> Créer le compte</Button>
      </form>
    </section>
  );
}
