import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Copy, Mail, Upload, FileX, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { groupBySupplier, formatDate, formatEUR, STATUS_LABEL, type Tx } from "@/lib/session";
import { useClientTxs } from "./espace.index";

export const NO_INVOICE_WARNING = `Attention : sans facture, cette dépense risque de :
– ne pas être déduite de votre résultat, car une charge doit être appuyée de justificatifs suffisants (BOI-BIC-CHG-10) ;
– vous faire perdre la TVA récupérable, car la TVA n'est déductible que si elle figure sur une facture (CGI art. 271, II ; BOI-TVA-DED-40-10-10 § 30) ;
– être reclassée s'il s'agit d'une dépense personnelle : elle ne sera alors pas prise en charge par l'entreprise.
Vous pouvez souvent obtenir un duplicata auprès du fournisseur. Votre comptable reviendra vers vous si besoin.`;

const ACCEPT = "application/pdf,image/jpeg,image/png";

export const Route = createFileRoute("/_authenticated/espace/$supplier")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.supplier} — PBC List` },
      { name: "description", content: `Factures à transmettre pour ${params.supplier}.` },
      { property: "og:title", content: `${params.supplier} — PBC List` },
      { property: "og:description", content: `Factures à transmettre pour ${params.supplier}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplierPage,
});

function SupplierPage() {
  const { supplier } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { txs, dossierId } = useClientTxs();
  const groups = groupBySupplier(txs.data ?? []);
  const idx = groups.findIndex((g) => g.name === supplier);
  const group = groups[idx];
  const [mode, setMode] = useState<"upload" | "email" | null>(null);
  const [noInvoiceTx, setNoInvoiceTx] = useState<Tx | null>(null);
  const [busy, setBusy] = useState(false);

  const dossier = useQuery({
    queryKey: ["dossier", dossierId],
    enabled: !!dossierId,
    queryFn: async () => (await supabase.from("dossiers").select("name, collect_email").eq("id", dossierId!).single()).data,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-txs"] });

  async function uploadFiles(files: File[], targets: Tx[]) {
    if (!dossierId || files.length === 0 || targets.length === 0) return;
    const bad = files.find((f) => !ACCEPT.split(",").includes(f.type));
    if (bad) { toast.error(`« ${bad.name} » n'est pas un PDF, JPG ou PNG.`); return; }
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const tx = targets[Math.min(i, targets.length - 1)]!;
        const safe = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `${dossierId}/${tx.id}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from("factures").upload(path, f, { contentType: f.type });
        if (up.error) throw up.error;
        const ins = await supabase.from("uploads").insert({
          dossier_id: dossierId, transaction_id: tx.id, storage_path: path, file_name: f.name,
        });
        if (ins.error) throw ins.error;
      }
      const ids = targets.slice(0, files.length).map((t) => t.id);
      const upd = await supabase.from("transactions").update({ status: "depose", comment: null }).in("id", ids);
      if (upd.error) throw upd.error;
      toast.success(files.length > 1 ? `${files.length} fichiers envoyés` : "Fichier envoyé");
      refresh();
    } catch (e) {
      toast.error("L'envoi a échoué : " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markEmail() {
    if (!group) return;
    const ids = group.txs.filter((t) => t.status === "a_faire").map((t) => t.id);
    if (ids.length) await supabase.from("transactions").update({ status: "email" }).in("id", ids);
    toast.success("C'est noté, merci !");
    refresh();
  }

  function next() {
    const nextG = groups.slice(idx + 1).find((g) => g.state !== "done") ?? groups.find((g, i) => i !== idx && g.state !== "done");
    if (nextG) navigate({ to: "/espace/$supplier", params: { supplier: nextG.name } });
    else navigate({ to: "/espace/termine" });
    setMode(null);
  }

  if (txs.isLoading) return <div className="min-h-screen"><AppHeader /><p className="p-8 text-muted-foreground">Chargement…</p></div>;
  if (!group)
    return (
      <div className="min-h-screen"><AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <p>Ce fournisseur n'a plus de demande en attente.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/espace">Retour</Link></Button>
        </main>
      </div>
    );

  const pending = group.txs.filter((t) => t.status === "a_faire");
  const collect = dossier.data?.collect_email;

  return (
    <div className="min-h-screen pb-28">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/espace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tous les fournisseurs
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">{group.name}</h1>
        <p className="text-muted-foreground">
          {group.txs.length} paiement{group.txs.length > 1 ? "s" : ""} · {formatEUR(group.total)}
        </p>

        <div className="mt-6 space-y-3">
          {group.txs.map((t) => (
            <TxRow key={t.id} tx={t} busy={busy} onFiles={(f) => uploadFiles(f, [t])} onNoInvoice={() => setNoInvoiceTx(t)} />
          ))}
        </div>

        {pending.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Comment souhaitez-vous nous les transmettre ?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button size="xl" variant={mode === "upload" ? "default" : "outline"} className="sm:w-full" onClick={() => setMode("upload")}>
                <Upload /> Je dépose mes factures
              </Button>
              <Button size="xl" variant={mode === "email" ? "default" : "outline"} className="sm:w-full" onClick={() => setMode("email")}>
                <Mail /> Je les envoie par e-mail
              </Button>
            </div>

            {mode === "upload" && (
              <DropZone
                busy={busy}
                label={`Glissez ici une ou plusieurs factures (PDF, JPG, PNG)`}
                hint={
                  pending.length > 1
                    ? "Les fichiers sont associés aux paiements dans l'ordre des dates. Vous pouvez aussi déposer un fichier sur chaque paiement ci-dessus."
                    : undefined
                }
                onFiles={(f) => uploadFiles(f, pending)}
              />
            )}

            {mode === "email" && (
              <div className="mt-4 rounded-xl border bg-card p-5">
                {collect ? (
                  <>
                    <p className="text-sm text-muted-foreground">Envoyez vos factures à cette adresse :</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <code className="flex-1 break-all rounded-md bg-muted px-3 py-3 text-sm">{collect}</code>
                      <Button
                        size="lg"
                        onClick={() => { navigator.clipboard.writeText(collect); toast.success("Adresse copiée"); }}
                      >
                        <Copy /> Copier
                      </Button>
                    </div>
                    <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      <li>Dans votre compte {group.name}, ajoutez cette adresse comme e-mail de réception des factures : elles nous arriveront automatiquement.</li>
                      <li>Ou transférez simplement les e-mails contenant vos factures à cette adresse.</li>
                    </ul>
                    <Button size="xl" className="mt-4" onClick={markEmail}>
                      <Check /> C'est fait, je les ai envoyées
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    L'adresse de réception n'est pas encore renseignée par votre cabinet. Utilisez plutôt le dépôt de fichiers.
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t bg-card p-4">
        <div className="mx-auto max-w-2xl">
          <Button size="xl" className="sm:w-full" onClick={next}>
            Fournisseur suivant <ArrowRight />
          </Button>
        </div>
      </div>

      <NoInvoiceDialog tx={noInvoiceTx} onClose={() => setNoInvoiceTx(null)} onDone={refresh} />
    </div>
  );
}

function TxRow({ tx, busy, onFiles, onNoInvoice }: { tx: Tx; busy: boolean; onFiles: (f: File[]) => void; onNoInvoice: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const done = tx.status !== "a_faire";
  return (
    <div
      className="rounded-xl border bg-card p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (!busy) onFiles([...e.dataTransfer.files]); }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{formatEUR(Math.abs(Number(tx.amount)))}</div>
          <div className="text-sm text-muted-foreground">{formatDate(tx.date)}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{tx.label}</div>
        </div>
        <Badge className={done ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
          {STATUS_LABEL[tx.status]}
        </Badge>
      </div>
      {!done && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input ref={input} type="file" multiple accept={ACCEPT} className="hidden"
            onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <Upload /> Ajouter la facture
          </Button>
          <Button variant="ghost" size="sm" onClick={onNoInvoice}>
            <FileX /> Je n'ai pas de facture
          </Button>
        </div>
      )}
    </div>
  );
}

function DropZone({ busy, label, hint, onFiles }: { busy: boolean; label: string; hint?: string | undefined; onFiles: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}
        className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${over ? "border-primary bg-accent" : "border-input bg-card"}`}
      >
        <Upload className="mb-2 h-8 w-8 text-primary" />
        <span className="font-semibold">{busy ? "Envoi en cours…" : label}</span>
        <span className="mt-1 text-sm text-muted-foreground">ou touchez pour choisir des fichiers</span>
      </button>
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden"
        onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NoInvoiceDialog({ tx, onClose, onDone }: { tx: Tx | null; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const close = () => { setComment(""); setStep(1); onClose(); };
  async function confirm() {
    if (!tx) return;
    const { error } = await supabase.from("transactions").update({ status: "sans_facture", comment: comment || null }).eq("id", tx.id);
    if (error) { toast.error(error.message); return; }
    toast.success("C'est noté");
    onDone();
    close();
  }
  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Je n'ai pas de facture</DialogTitle>
          <DialogDescription>
            {tx && `${formatEUR(Math.abs(Number(tx.amount)))} le ${formatDate(tx.date)}`}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="c">Expliquez-nous en quelques mots (facultatif)</label>
            <Textarea id="c" rows={4} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Ex. : achat personnel, facture perdue, abonnement résilié…" />
          </div>
        ) : (
          <div className="whitespace-pre-line rounded-lg bg-warning p-4 text-sm text-warning-foreground">{NO_INVOICE_WARNING}</div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close}>Annuler</Button>
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>Continuer</Button>
          ) : (
            <Button variant="destructive" onClick={confirm}>Je confirme</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
