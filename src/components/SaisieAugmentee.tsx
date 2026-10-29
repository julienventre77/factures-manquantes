import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BookmarkCheck, Check, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill } from "@/components/StatusPill";
import { formatUsd } from "@/lib/analysis";
import { compteAchatValide, libellePcg } from "@/lib/pcg";
import { STATE_LABEL, ecartPaiement } from "@/lib/saisie";
import { envoyerPennylane, getSaisie, lireFacture, rejeterSaisie, validerSaisie } from "@/lib/saisie.functions";
import { formatDate, formatEUR } from "@/lib/session";
import { alertes, controle, ecriture, round2, tvaLigne, type Facture, type Ligne } from "@/lib/ventilation";

type State = Awaited<ReturnType<typeof getSaisie>>;
type Saisie = NonNullable<State["saisie"]>;
const TAUX = [0.2, 0.1, 0.055, 0.021, 0];
const pct = (t: number) => `${String(round2(t * 100)).replace(".", ",")} %`;

// "Saisie augmentée" of one uploaded invoice: Claude reads it, the firm corrects and validates the split.
export function SaisieAugmentee({ uploadId, onClose }: { uploadId: string | null; onClose: () => void }) {
  return (
    <Dialog open={uploadId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Saisie augmentée</DialogTitle>
          <DialogDescription>Claude lit la facture et propose un compte par nature. Vous validez. Sur un dossier démo, vous pouvez ensuite envoyer la facture et son PDF dans Pennylane.</DialogDescription>
        </DialogHeader>
        {uploadId && <Content key={uploadId} uploadId={uploadId} />}
      </DialogContent>
    </Dialog>
  );
}

function Content({ uploadId }: { uploadId: string }) {
  const q = useQuery({ queryKey: ["saisie", uploadId], queryFn: () => getSaisie({ data: { uploadId } }), retry: false });
  const [reading, setReading] = useState(false);

  async function lire() {
    setReading(true);
    try {
      const r = await lireFacture({ data: { uploadId } });
      toast.success(`Facture lue : ${r.lignes} ligne(s) proposée(s). Coût réel : ${formatUsd(r.cost)}.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReading(false);
      q.refetch();
    }
  }

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (q.error || !q.data) return <p role="alert" className="text-sm text-destructive">{(q.error as Error | null)?.message ?? "Chargement impossible."}</p>;
  const d = q.data;
  const s = d.saisie;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{d.fileName}</span>
        <span>Paiement : {d.paiement.tiers}, {formatEUR(Math.abs(d.paiement.montant))} le {formatDate(d.paiement.date)}</span>
        {s && <Pill tone={s.state === "validee" ? "ok" : s.state === "proposee" ? "info" : "muted"} icon={s.state === "validee" ? Check : Sparkles}>{STATE_LABEL[s.state]}</Pill>}
      </div>

      {s?.state === "proposee" ? (
        <Editor saisie={s} paiement={d.paiement.montant} onDone={() => q.refetch()} />
      ) : s?.state === "validee" ? (
        <Validated saisie={s} paiement={d.paiement.montant} envoiPossible={d.envoiPossible} onDone={() => q.refetch()} />
      ) : (
        <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
          {s?.state === "echec" && <p className="text-destructive">La dernière lecture n'a pas abouti : vous pouvez réessayer.</p>}
          {s?.state === "rejetee" && <p>La proposition précédente a été rejetée : vous pouvez relancer une lecture.</p>}
          {!d.paiement.achat ? (
            <p>La saisie augmentée ne traite que les factures d'achat.</p>
          ) : !d.lisible ? (
            <p>Ce fichier n'est ni un PDF ni une image : Claude ne peut pas le lire.</p>
          ) : (
            <>
              <p>
                Claude lit chaque ligne de la facture et choisit son compte dans le plan de comptes ANC au 1er janvier 2026, avec le motif (la mémoire du fournisseur passe d'abord), puis l'appli calcule la part en 486 pour une prestation
                sur plusieurs mois et le contrôle HT + TVA = TTC. Coût : quelques centimes, compté dans le plafond mensuel Claude
                ({formatUsd(d.spent)} dépensés sur {formatUsd(d.cap)} ce mois-ci).
              </p>
              <Button onClick={lire} disabled={reading}><Sparkles className={reading ? "animate-pulse" : ""} /> {reading ? "Lecture en cours…" : "Lire la facture avec Claude"}</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const asFacture = (s: Saisie, lignes: Ligne[], libelle: string): Facture => ({
  id: s.id, numero: s.numero, fournisseur: s.fournisseur, date: s.date ?? "", totalHt: s.totalHt, totalTva: s.totalTva, totalTtc: s.totalTtc,
  libelleGenerique: "", libelleEcriture: libelle, lignes,
});

function Editor({ saisie, paiement, onDone }: { saisie: Saisie; paiement: number; onDone: () => void }) {
  const [lignes, setLignes] = useState<Ligne[]>(saisie.lignes);
  const [libelle, setLibelle] = useState(saisie.libelleEcriture);
  const [forcer, setForcer] = useState(false);
  const [busy, setBusy] = useState(false);
  const f = asFacture(saisie, lignes, libelle);
  const c = controle(f);

  const edit = (id: string, patch: Partial<Ligne>) =>
    setLignes((ls) => ls.map((l) => {
      if (l.id !== id) return l;
      const n = { ...l, ...patch };
      // A changed amount or rate replaces the VAT read on the invoice.
      if ("ht" in patch || "tauxTva" in patch) n.tvaMontant = round2(n.ht * n.tauxTva);
      // A changed account takes the chart wording; the reason given for the proposed account no longer applies.
      if ("compte" in patch) {
        delete n.memorisee;
        n.compteLibelle = libellePcg(n.compte);
        n.motif = "Compte saisi par le cabinet.";
      }
      return n;
    }));
  const add = () => setLignes((ls) => [...ls, { id: `m${Date.now()}`, compte: "", compteLibelle: "", libelle: "", ht: 0, tauxTva: 0.2, tvaMontant: 0 }]);

  async function valider() {
    setBusy(true);
    try {
      const r = await validerSaisie({ data: { id: saisie.id, libelleEcriture: libelle, lignes, forcer } });
      toast.success(`Saisie validée${r.regles ? `, ${r.regles} compte(s) mémorisé(s) pour ce fournisseur` : ""}. Rien n'est encore envoyé dans Pennylane.`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function rejeter() {
    setBusy(true);
    try {
      await rejeterSaisie({ data: { id: saisie.id } });
      toast.success("Proposition rejetée.");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Header saisie={saisie} />
      <label className="block space-y-1 text-sm">
        <span className="font-semibold">Libellé d'écriture</span>
        <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={200} />
      </label>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="border-b bg-muted/60 text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-2">Compte</th>
              <th scope="col" className="px-2 py-2">Libellé de ligne</th>
              <th scope="col" className="px-2 py-2 text-right">HT</th>
              <th scope="col" className="px-2 py-2">TVA</th>
              <th scope="col" className="px-2 py-2 text-right">Montant TVA</th>
              <th scope="col" className="px-2 py-2"><span className="sr-only">Supprimer</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lignes.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="px-2 py-2">
                  <Input aria-label="Compte" className="h-8 w-28 font-mono" inputMode="numeric" value={l.compte}
                    onChange={(e) => edit(l.id, { compte: e.target.value.trim() })} />
                  {compteAchatValide(l.compte)
                    ? <div className="mt-1 max-w-[9rem] text-xs text-muted-foreground">{l.compteLibelle}</div>
                    : <div className="mt-1 max-w-[9rem] text-xs font-semibold text-destructive">Absent du plan de comptes ANC 2026 (comptes d'achat)</div>}
                  {l.memorisee && <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary"><BookmarkCheck className="h-3 w-3" /> mémorisé</span>}
                </td>
                <td className="px-2 py-2">
                  <Input aria-label="Libellé de ligne" className="h-8" value={l.libelle} onChange={(e) => edit(l.id, { libelle: e.target.value })} />
                  {l.designation && l.designation !== l.libelle && <div className="mt-1 text-xs text-muted-foreground">Sur la facture : {l.designation}</div>}
                  {l.motif && <div className="mt-1 text-xs italic text-muted-foreground">Pourquoi ce compte : {l.motif}</div>}
                </td>
                <td className="px-2 py-2">
                  <Input aria-label="Montant HT" type="number" step="0.01" className="h-8 w-28 text-right tabular-nums" value={l.ht}
                    onChange={(e) => edit(l.id, { ht: Number(e.target.value) || 0 })} />
                </td>
                <td className="px-2 py-2">
                  <select aria-label="Taux de TVA" value={l.tauxTva} onChange={(e) => edit(l.id, { tauxTva: Number(e.target.value) })}
                    className="h-8 rounded-md border border-input bg-card px-2 text-sm">
                    {[...new Set([...TAUX, l.tauxTva])].map((t) => <option key={t} value={t}>{pct(t)}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatEUR(tvaLigne(l))}</td>
                <td className="px-2 py-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Supprimer la ligne ${l.libelle}`}
                    onClick={() => setLignes((ls) => ls.filter((x) => x.id !== l.id))}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t px-2 py-2"><Button variant="link" size="sm" onClick={add}><Plus /> Ajouter une ligne</Button></div>
      </div>

      <Checks facture={f} paiement={paiement} />
      <EntryPreview facture={f} />

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        {!c.ok && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={forcer} onCheckedChange={(v) => setForcer(v === true)} /> Valider malgré l'écart
          </label>
        )}
        <Button onClick={valider} disabled={busy || (!c.ok && !forcer) || !lignes.every((l) => compteAchatValide(l.compte))}><Check /> Valider la saisie</Button>
        <Button variant="outline" onClick={rejeter} disabled={busy}><X /> Rejeter</Button>
        <span className="text-xs text-muted-foreground">Lecture : {formatUsd(saisie.cost)}. L'envoi dans Pennylane se fait après validation.</span>
      </div>
    </div>
  );
}

function Validated({ saisie, paiement, envoiPossible, onDone }: { saisie: Saisie; paiement: number; envoiPossible: boolean; onDone: () => void }) {
  const f = asFacture(saisie, saisie.lignes, saisie.libelleEcriture);
  const [confirmer, setConfirmer] = useState(false);
  const [busy, setBusy] = useState(false);

  // Writes to Pennylane: a second click confirms the sending.
  async function envoyer() {
    setBusy(true);
    try {
      const r = await envoyerPennylane({ data: { id: saisie.id } });
      toast.success(`Facture importée dans Pennylane avec son PDF (n° ${r.invoiceId}).`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setConfirmer(false);
    }
  }

  return (
    <div className="space-y-4">
      <Header saisie={saisie} />
      <p className="text-sm"><span className="font-semibold">Libellé d'écriture :</span> {saisie.libelleEcriture}</p>
      <Checks facture={f} paiement={paiement} />
      <EntryPreview facture={f} />
      {saisie.pennylaneInvoiceId ? (
        <p className="text-sm font-semibold text-primary">
          Importée dans Pennylane avec son PDF (facture fournisseur n° {saisie.pennylaneInvoiceId}){saisie.envoyeLe ? ` le ${formatDate(saisie.envoyeLe.slice(0, 10))}` : ""}.
        </p>
      ) : envoiPossible ? (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          {confirmer ? (
            <>
              <span className="text-sm">La facture, ses lignes et son PDF vont être créés dans le dossier Pennylane. Confirmez-vous ?</span>
              <Button onClick={envoyer} disabled={busy}><Send /> {busy ? "Envoi en cours…" : "Confirmer l'envoi"}</Button>
              <Button variant="outline" onClick={() => setConfirmer(false)} disabled={busy}>Annuler</Button>
            </>
          ) : (
            <Button onClick={() => setConfirmer(true)}><Send /> Envoyer dans Pennylane</Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Validée{saisie.decidedAt ? ` le ${formatDate(saisie.decidedAt.slice(0, 10))}` : ""}. L'envoi dans Pennylane n'est proposé que pour une facture PDF d'un dossier démo du hackathon.
        </p>
      )}
    </div>
  );
}

function Header({ saisie }: { saisie: Saisie }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
      <div><dt className="text-muted-foreground">Fournisseur</dt><dd className="font-semibold">{saisie.fournisseur}</dd></div>
      <div><dt className="text-muted-foreground">Facture</dt><dd className="font-mono">{saisie.numero || "—"}{saisie.date ? ` du ${formatDate(saisie.date)}` : ""}</dd></div>
      <div><dt className="text-muted-foreground">Pied de facture</dt><dd className="tabular-nums">{formatEUR(saisie.totalHt)} HT · {formatEUR(saisie.totalTva)} TVA · <span className="font-bold">{formatEUR(saisie.totalTtc)} TTC</span></dd></div>
    </dl>
  );
}

function Checks({ facture, paiement }: { facture: Facture; paiement: number }) {
  const c = controle(facture);
  const warn = alertes(facture.lignes);
  const ecart = ecartPaiement(facture.totalTtc, paiement);
  const items = [
    ...(c.ok ? [] : [`Les lignes ne retombent pas sur le pied de facture : écart HT ${formatEUR(c.ecartHt)}, TVA ${formatEUR(c.ecartTva)}, TTC ${formatEUR(c.ecartTtc)}.`]),
    ...(Math.abs(ecart) > 0.01 ? [`Le TTC de la facture diffère du paiement de ${formatEUR(Math.abs(ecart))} (acompte, paiement partiel ou autre facture ?).`] : []),
    ...warn,
  ];
  return (
    <div className="space-y-1 text-sm">
      <p className={c.ok ? "flex items-center gap-2 font-semibold text-primary" : "flex items-center gap-2 font-semibold text-destructive"}>
        {c.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        Ventilation : {formatEUR(c.ht)} HT + {formatEUR(c.tva)} TVA = {formatEUR(c.ttc)} TTC
      </p>
      {items.map((m) => <p key={m} className="flex items-start gap-2 text-yellow-ink"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m}</p>)}
    </div>
  );
}

// The full purchase entry, always visible: expense lines, deductible VAT (44562 / 44566) and supplier debt (401).
function EntryPreview({ facture }: { facture: Facture }) {
  const e = ecriture(facture);
  return (
    <section className="rounded-xl border p-3 text-sm" aria-label="Écriture d'achat">
      <h3 className="font-semibold">Écriture d'achat {e.equilibree ? "(équilibrée)" : "(déséquilibrée)"}</h3>
      <table className="mt-2 w-full">
        <thead className="text-left text-muted-foreground">
          <tr><th scope="col" className="py-1">Compte</th><th scope="col" className="py-1">Libellé</th><th scope="col" className="py-1 text-right">Débit</th><th scope="col" className="py-1 text-right">Crédit</th></tr>
        </thead>
        <tbody className="divide-y">
          {e.lignes.map((l, i) => (
            <tr key={i} className={l.credit ? "font-semibold" : undefined}>
              <td className="py-1 font-mono">{l.compte}</td>
              <td className="py-1">{l.libelle}</td>
              <td className="py-1 text-right tabular-nums">{l.debit ? formatEUR(l.debit) : ""}</td>
              <td className="py-1 text-right tabular-nums">{l.credit ? formatEUR(l.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t font-bold">
          <tr>
            <td className="py-1" colSpan={2}>Totaux</td>
            <td className="py-1 text-right tabular-nums">{formatEUR(e.totalDebit)}</td>
            <td className="py-1 text-right tabular-nums">{formatEUR(e.totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
