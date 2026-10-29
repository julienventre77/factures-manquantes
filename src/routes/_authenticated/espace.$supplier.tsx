import { requireClient } from "@/lib/session";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HelpChat } from "@/components/HelpChat";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, ChevronDown, CloudUpload, Copy, FileX, FolderOpen, Info, Mail, PartyPopper, Upload,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { SupplierAvatar } from "@/components/brand";
import { GroupStatePill, TxStatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { groupBySupplier, formatDate, formatEUR, type SupplierGroup, type Tx } from "@/lib/session";
import { stepOrder } from "@/lib/priority";
import { cn } from "@/lib/utils";
import { useClientDossier, useClientTxs } from "./espace.index";

export const NO_INVOICE_WARNING = `Attention : sans facture, cette dépense risque de :
– ne pas être déduite de votre résultat, car une charge doit être appuyée de justificatifs suffisants (BOI-BIC-CHG-10-20-20 § 1 et 10) ;
– vous faire perdre la TVA récupérable, car la TVA n'est déductible que si elle figure sur une facture (CGI art. 271, II-2 ; BOI-TVA-DED-40-10-10 § 30) ;
– être reclassée s'il s'agit d'une dépense personnelle : elle ne sera alors pas prise en charge par l'entreprise.
Vous pouvez souvent obtenir un duplicata auprès du fournisseur. Votre comptable reviendra vers vous si besoin.`;

// For a sale, the missing document is the client's own invoice: guidance only, no tax rule.
export const NO_INVOICE_NOTE_SALE = `À savoir : pour un encaissement, la pièce attendue est la facture (ou le justificatif de vente) que vous avez établie pour votre client.
– Si vous l'avez émise, vous la retrouverez dans votre logiciel de facturation ou dans vos e-mails envoyés : vous pouvez la déposer ou la transférer.
– S'il s'agit d'un remboursement d'un fournisseur, déposez plutôt l'avoir qu'il vous a adressé (choix 1).
– S'il ne s'agit pas d'une vente (apport, prêt, virement entre vos comptes…), précisez-le dans le commentaire.
Votre comptable reviendra vers vous si besoin.`;

const ACCEPT = "application/pdf,image/jpeg,image/png";

export const Route = createFileRoute("/_authenticated/espace/$supplier")({
  beforeLoad: requireClient,
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
  const { txs, dossierId } = useClientTxs();
  // Stable order, so "Étape X sur N", Précédent and Suivant do not move after each answer.
  const steps = stepOrder(groupBySupplier(txs.data ?? []));
  const idx = steps.findIndex((g) => g.key === supplier);

  if (txs.isLoading)
    return <div className="min-h-screen bg-background"><AppHeader space="client" /><p className="p-8 text-muted-foreground">Chargement…</p></div>;
  if (idx < 0 || !dossierId)
    return (
      <div className="min-h-screen bg-background"><AppHeader space="client" />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <p>Ce fournisseur n'a plus de demande en attente.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/espace">Retour</Link></Button>
        </main>
      </div>
    );
  // Keyed by group so the selection starts afresh on each step.
  return <SupplierStep key={supplier} steps={steps} idx={idx} dossierId={dossierId} />;
}

function SupplierStep({ steps, idx, dossierId }: { steps: SupplierGroup[]; idx: number; dossierId: string }) {
  const group = steps[idx]!;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dossier = useClientDossier(dossierId);
  const pending = group.txs.filter((t) => t.status === "a_faire");
  // All the payments still to do are selected at first: one click answers the whole supplier.
  const [sel, setSel] = useState<Set<string>>(() => new Set(pending.map((t) => t.id)));
  const [mode, setMode] = useState<"upload" | "email" | "none" | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = pending.filter((t) => sel.has(t.id));
  const isSale = group.direction === "in";
  const collect = isSale ? dossier.data?.collect_email_customers : dossier.data?.collect_email;
  const noun = isSale ? "encaissement" : "paiement";
  const thisOne = isSale ? "cet encaissement" : "ce paiement";
  const plural = (n: number) => (n > 1 ? "s" : "");
  const refresh = () => qc.invalidateQueries({ queryKey: ["client-txs"] });
  const toggle = (id: string, on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (on) n.add(id); else n.delete(id);
      return n;
    });

  const NOTHING_SELECTED = "Sélectionnez au moins une ligne.";

  async function uploadFiles(files: File[], targets: Tx[]) {
    if (files.length === 0) return;
    if (targets.length === 0) { toast.error(NOTHING_SELECTED); return; }
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
    const ids = selected.map((t) => t.id);
    if (!ids.length) { toast.error(NOTHING_SELECTED); return; }
    setBusy(true);
    const { error } = await supabase.from("transactions").update({ status: "email" }).in("id", ids);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("C'est noté, merci !");
    refresh();
  }

  async function markNoInvoice() {
    const ids = selected.map((t) => t.id);
    if (!ids.length) { toast.error(NOTHING_SELECTED); return; }
    setBusy(true);
    const { error } = await supabase.from("transactions").update({ status: "sans_facture", comment: comment.trim() || null }).in("id", ids);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("C'est noté");
    setComment("");
    setMode(null);
    refresh();
  }

  function goNext() {
    const nextG = steps.slice(idx + 1).find((g) => g.state !== "done") ?? steps.find((g, i) => i !== idx && g.state !== "done");
    if (nextG) navigate({ to: "/espace/$supplier", params: { supplier: nextG.key } });
    else navigate({ to: "/espace/termine" });
  }
  function goPrevious() {
    const prev = steps[idx - 1];
    if (prev) navigate({ to: "/espace/$supplier", params: { supplier: prev.key } });
    else navigate({ to: "/espace" });
  }

  const answered = group.txs.length - pending.length;
  return (
    <div className="min-h-screen bg-background pb-32 sm:text-[17px]">
      <AppHeader space="client" /><HelpChat groupKey={group.key} raised />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/espace" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Retour à la liste
          </Link>
          <div className="flex items-center gap-3 text-sm font-semibold text-primary">
            Étape {idx + 1} sur {steps.length}
            {steps.length <= 12 && (
              <span aria-hidden className="hidden gap-1 sm:flex">
                {steps.map((g, i) => (
                  <span key={g.key} className={cn("h-1.5 w-6 rounded-full", i === idx ? "bg-primary" : g.state === "done" ? "bg-primary/40" : "bg-cream-3")} />
                ))}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-start gap-4">
          <SupplierAvatar name={group.name} className="h-16 w-16 text-xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-tight sm:text-3xl">{group.name}</h1>
            <p className="mt-1 text-muted-foreground">
              {isSale ? "Votre client" : "Fournisseur"} · {group.txs.length} {noun}{plural(group.txs.length)} · total{" "}
              <strong className="text-foreground">{formatEUR(group.total)}</strong>
              {answered > 0 && ` · ${answered} déjà traité${plural(answered)}`}
            </p>
          </div>
          <GroupStatePill state={group.state} className="hidden sm:inline-flex" />
        </div>

        {pending.length === 0 && (
          <div className="mt-6 flex items-center gap-4 rounded-2xl bg-mint-pale p-5 text-primary">
            <PartyPopper className="h-8 w-8 shrink-0" />
            <div>
              <p className="font-bold">Merci, tout est traité pour {group.name}.</p>
              <p className="text-sm">Passez à l'étape suivante avec le bouton « Suivant ».</p>
            </div>
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-sm">
          {pending.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-pale-2 px-4 py-3">
              <label className="flex cursor-pointer items-center gap-3 font-semibold text-primary">
                <Checkbox
                  className="h-5 w-5"
                  checked={selected.length === pending.length}
                  onCheckedChange={(v) => setSel(new Set(v === true ? pending.map((t) => t.id) : []))}
                />
                Tout sélectionner pour {isSale ? "ce client" : "ce fournisseur"}
              </label>
              <span className="text-sm text-muted-foreground">
                {selected.length} sélectionné{plural(selected.length)} ·{" "}
                <strong className="text-foreground">{formatEUR(selected.reduce((s, t) => s + Math.abs(Number(t.amount)), 0))}</strong>
              </span>
            </div>
          )}
          <ul className="divide-y">
            {group.txs.map((t) => (
              <TxRow
                key={t.id}
                tx={t}
                selected={sel.has(t.id)}
                onToggle={(on) => toggle(t.id, on)}
                onFiles={(f) => !busy && uploadFiles(f, [t])}
              />
            ))}
          </ul>
        </div>

        {pending.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl sm:text-2xl">
              {selected.length === 0
                ? "Sélectionnez au moins une ligne ci-dessus"
                : selected.length === 1
                  ? `Pour ${thisOne}, comment souhaitez-vous procéder ?`
                  : `Pour ces ${selected.length} ${noun}s, comment souhaitez-vous procéder ?`}
            </h2>
            <p className="mt-1 text-muted-foreground">Choisissez la solution la plus simple pour vous.</p>
            <div inert={selected.length === 0} className={cn("mt-5 space-y-4", selected.length === 0 && "opacity-50")}>
              <ChoiceCard n={1} icon={Upload} tone="mint" open={mode === "upload"} onToggle={() => setMode(mode === "upload" ? null : "upload")}
                title="Je dépose mes factures" desc="Ajoutez les factures depuis votre ordinateur ou votre téléphone.">
                <DropZone busy={busy} several={selected.length > 1} noun={noun} onFiles={(f) => uploadFiles(f, selected)} />
              </ChoiceCard>

              <ChoiceCard n={2} icon={Mail} tone="pale" open={mode === "email"} onToggle={() => setMode(mode === "email" ? null : "email")}
                title="Je les envoie par e-mail" desc="Transférez les e-mails qui contiennent vos factures à l'adresse de votre dossier.">
                {collect ? (
                  <>
                    <div className="flex flex-col gap-3 rounded-xl border bg-pale-2 p-3 sm:flex-row sm:items-center">
                      <code className="flex-1 break-all px-1 font-mono font-semibold text-primary">{collect}</code>
                      <Button variant="outline" size="lg" onClick={() => { navigator.clipboard.writeText(collect); toast.success("Adresse copiée"); }}>
                        <Copy /> Copier
                      </Button>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-2">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        {isSale
                          ? `Depuis votre logiciel de facturation, ajoutez cette adresse en copie lorsque vous envoyez une facture à ${group.name}.`
                          : `Dans votre compte ${group.name}, ajoutez cette adresse comme e-mail de réception des factures : elles nous arriveront automatiquement.`}
                      </li>
                      <li className="flex gap-2">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        Ou transférez simplement les e-mails contenant vos factures à cette adresse : elles arrivent directement dans votre dossier.
                      </li>
                    </ul>
                    <Button size="xl" className="mt-5" disabled={busy} onClick={markEmail}>
                      <Check /> C'est fait, je les ai envoyées
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    L'adresse de réception n'est pas encore renseignée par votre cabinet. Utilisez plutôt le dépôt de fichiers.
                  </p>
                )}
              </ChoiceCard>

              <ChoiceCard n={3} icon={FileX} tone="yellow" open={mode === "none"} onToggle={() => setMode(mode === "none" ? null : "none")}
                title="Je n'ai pas de facture" desc="Indiquez-le simplement ; un mot d'explication aide votre comptable.">
                <label htmlFor="no-invoice-comment" className="text-sm font-semibold">Votre commentaire (facultatif)</label>
                <Textarea id="no-invoice-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder={isSale ? "Par exemple : apport, virement entre mes comptes…" : "Par exemple : facture introuvable, achat personnel…"}
                  className="mt-2 bg-card md:text-base" />
                <NoInvoiceWarning text={isSale ? NO_INVOICE_NOTE_SALE : NO_INVOICE_WARNING} />
                <Button size="xl" className="mt-5" disabled={busy} onClick={markNoInvoice}>
                  Je confirme : pas de facture pour {selected.length > 1 ? `ces ${selected.length} ${noun}s` : thisOne}
                </Button>
              </ChoiceCard>
            </div>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3 px-4 py-3">
          <Button size="xl" variant="outline" className="w-auto" onClick={goPrevious}>
            <ArrowLeft /> Précédent
          </Button>
          <Button size="xl" className="flex-1 sm:ml-auto sm:flex-none" onClick={goNext}>
            Suivant <ArrowRight className="text-mint" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TxRow({ tx, selected, onToggle, onFiles }: { tx: Tx; selected: boolean; onToggle: (on: boolean) => void; onFiles: (f: File[]) => void }) {
  const todo = tx.status === "a_faire";
  const amount = formatEUR(Math.abs(Number(tx.amount)));
  return (
    <li
      className={cn("flex items-center gap-3 px-4 py-3", todo && selected && "bg-mint-pale/70")}
      onDragOver={(e) => todo && e.preventDefault()}
      onDrop={(e) => { if (!todo) return; e.preventDefault(); onFiles([...e.dataTransfer.files]); }}
    >
      {todo ? (
        <Checkbox className="h-5 w-5" checked={selected} onCheckedChange={(v) => onToggle(v === true)}
          aria-label={`Sélectionner le paiement du ${formatDate(tx.date)} de ${amount}`} />
      ) : (
        <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-soft text-primary">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="grid min-w-0 flex-1 gap-x-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_7.5rem] sm:items-center">
        <span className="order-2 font-mono text-sm text-muted-foreground sm:order-none sm:text-foreground">{formatDate(tx.date)}</span>
        <span className="order-3 min-w-0 sm:order-none">
          <span className="block truncate font-mono text-sm text-muted-foreground">{tx.label}</span>
          {tx.comment && <span className="block truncate text-sm italic text-muted-foreground">« {tx.comment} »</span>}
        </span>
        <span className="order-1 font-bold tabular-nums sm:order-none sm:text-right">{amount}</span>
      </div>
      <TxStatusPill status={tx.status} />
    </li>
  );
}

const TILE = { mint: "bg-mint-soft text-primary", pale: "bg-pale text-primary", yellow: "bg-yellow-soft text-yellow-ink" };

function ChoiceCard({ n, icon: Icon, tone, open, onToggle, title, desc, children }: {
  n: number; icon: LucideIcon; tone: keyof typeof TILE; open: boolean; onToggle: () => void; title: string; desc: string; children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl bg-card shadow-sm transition-colors", open ? "border-2 border-primary" : "border")}>
      <button type="button" aria-expanded={open} onClick={onToggle}
        className="flex w-full items-start gap-4 rounded-2xl p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", TILE[tone])}>
          <Icon className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-primary">{title}</span>
          <span className="block text-muted-foreground">{desc}</span>
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-muted-foreground">
          Choix {n} <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && <div className="px-5 pb-6 sm:pl-[5.25rem]">{children}</div>}
    </div>
  );
}

function DropZone({ busy, several, noun, onFiles }: { busy: boolean; several: boolean; noun: string; onFiles: (f: File[]) => void }) {
  const files = useRef<HTMLInputElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) onFiles([...e.dataTransfer.files]); }}
      className={cn("flex flex-col items-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8", over ? "border-primary bg-pale" : "border-input bg-pale-2/60")}
    >
      <CloudUpload aria-hidden className="h-9 w-9 text-primary" />
      <p className="mt-2 font-bold text-primary">{busy ? "Envoi en cours…" : "Glissez vos factures ici"}</p>
      <p className="text-sm text-muted-foreground">ou</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="lg" disabled={busy} onClick={() => files.current?.click()}>
          <FolderOpen /> Choisir des fichiers
        </Button>
        <Button variant="outline" size="lg" className="sm:hidden" disabled={busy} onClick={() => photo.current?.click()}>
          <Camera /> Prendre une photo
        </Button>
      </div>
      <input ref={files} type="file" multiple accept={ACCEPT} className="hidden" onChange={pick} />
      <input ref={photo} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={pick} />
      <p className="mt-3 text-sm text-muted-foreground">Formats acceptés : <strong>PDF, JPG ou PNG</strong></p>
      {several && (
        <p className="mt-2 text-sm text-muted-foreground">
          Plusieurs fichiers d'un coup : ils sont associés aux {noun}s sélectionnés, dans l'ordre des dates.
        </p>
      )}
    </div>
  );
}

function NoInvoiceWarning({ text }: { text: string }) {
  const [title, ...lines] = text.split("\n");
  return (
    <div role="note" className="mt-4 flex gap-3 rounded-xl border border-yellow/60 bg-yellow-soft/60 p-4 text-sm text-yellow-ink">
      <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="space-y-2">
        <p className="font-bold">{title}</p>
        <ul className="space-y-1">
          {lines.filter((l) => l.startsWith("–")).map((l) => <li key={l}>{l}</li>)}
        </ul>
        {lines.filter((l) => !l.startsWith("–")).map((l) => <p key={l}>{l}</p>)}
      </div>
    </div>
  );
}
