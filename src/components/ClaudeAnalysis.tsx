import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Check, Copy, Gauge, Sparkles, User, Users, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/StatusPill";
import { KIND_LABEL, formatUsd, type SuggestionKind } from "@/lib/analysis";
import { decideSuggestion, estimateAnalysis, getAnalysisState, runAnalysis, setMonthlyCap } from "@/lib/analysis.functions";
import { formatDate, formatEUR } from "@/lib/session";

const KIND: Record<SuggestionKind, { icon: LucideIcon; tone: "info" | "todo" | "danger" | "muted"; apply: string }> = {
  group: { icon: Users, tone: "info", apply: "Regrouper" },
  duplicate: { icon: Copy, tone: "todo", apply: "Ne pas demander les cochées" },
  personal: { icon: User, tone: "danger", apply: "Ne pas demander les cochées" },
  skip: { icon: Ban, tone: "muted", apply: "Ne pas demander les cochées" },
};

type State = Awaited<ReturnType<typeof getAnalysisState>>;
type Suggestion = State["suggestions"][number];
type Estimate = Awaited<ReturnType<typeof estimateAnalysis>>;

// "Analyser avec Claude": cost estimate first, then suggestions the firm applies or ignores one by one.
export function ClaudeAnalysis({ dossierId, onApplied }: { dossierId: string; onApplied: () => void }) {
  const q = useQuery({ queryKey: ["analysis", dossierId], queryFn: () => getAnalysisState({ data: { dossierId } }) });
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState<"estimate" | "run" | null>(null);
  const [editCap, setEditCap] = useState<string | null>(null);

  async function prepare() {
    setBusy("estimate");
    try {
      setEstimate(await estimateAnalysis({ data: { dossierId } }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function run() {
    if (!estimate) return;
    setBusy("run");
    try {
      const r = await runAnalysis({ data: { dossierId, maxCostUsd: Math.max(estimate.high, 0.01) } });
      toast.success(`Analyse terminée : ${r.suggestions} suggestion(s) sur ${r.lines} ligne(s). Coût réel : ${formatUsd(r.cost)}.`);
      setEstimate(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      q.refetch();
    }
  }

  async function saveCap(e: React.FormEvent) {
    e.preventDefault();
    const cap = Number((editCap ?? "").replace(",", "."));
    if (!Number.isFinite(cap) || cap < 0) { toast.error("Montant invalide."); return; }
    try {
      await setMonthlyCap({ data: { cap } });
      toast.success("Plafond enregistré");
      setEditCap(null);
      setEstimate(null);
      q.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const s = q.data;
  const over = !!estimate && !!s && s.spent + estimate.high > s.cap;

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5" /> Analyse par Claude</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Claude repère les tiers à regrouper, les doublons, les dépenses qui semblent personnelles et les lignes pour lesquelles
            aucune facture n'est en général attendue. Rien n'est modifié sans votre validation.
          </p>
        </div>
        <Button onClick={prepare} disabled={!!busy || !s || s.newLines === 0}>
          <Sparkles /> {busy === "estimate" ? "Estimation…" : "Analyser avec Claude"}
        </Button>
      </div>

      {q.isError && <p className="mt-3 text-sm text-destructive">Analyse indisponible pour le moment : {(q.error as Error).message}</p>}

      {s && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{s.newLines === 0 ? "Aucune nouvelle ligne à analyser" : `${s.newLines} nouvelle(s) ligne(s) à valider jamais analysée(s)`}</span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="h-4 w-4" /> Ce mois-ci : {formatUsd(s.spent)} sur {formatUsd(s.cap)}
            {editCap === null && <button type="button" className="font-semibold text-primary underline" onClick={() => setEditCap(String(s.cap))}>modifier</button>}
          </span>
          {editCap !== null && (
            <form onSubmit={saveCap} className="flex items-center gap-2">
              <Input aria-label="Plafond mensuel en dollars" inputMode="decimal" className="h-8 w-24" value={editCap} onChange={(e) => setEditCap(e.target.value)} />
              <span>$ / mois</span>
              <Button size="sm" type="submit">Enregistrer</Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => setEditCap(null)}>Annuler</Button>
            </form>
          )}
        </div>
      )}

      {estimate && (
        <div role="status" className="mt-4 rounded-lg border border-yellow/60 bg-yellow-soft/60 p-3 text-sm text-yellow-ink">
          {estimate.lines === 0 ? (
            <p>Aucune nouvelle ligne à analyser.</p>
          ) : (
            <>
              <p>
                Estimation pour {estimate.lines} ligne(s) : entre <strong>{formatUsd(estimate.low)}</strong> et <strong>{formatUsd(estimate.high)}</strong>, prélevés sur vos crédits API Anthropic.
                {estimate.waiting > 0 && ` ${estimate.waiting} autre(s) ligne(s) seront analysées à la prochaine analyse.`}
              </p>
              {over && <p className="mt-1 font-semibold">Ce montant dépasserait le plafond mensuel : relevez-le ou attendez le mois prochain.</p>}
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={run} disabled={!!busy || over}>{busy === "run" ? "Analyse en cours…" : "Lancer l'analyse"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setEstimate(null)} disabled={busy === "run"}>Annuler</Button>
              </div>
            </>
          )}
        </div>
      )}

      {s && s.suggestions.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold">{s.suggestions.length} suggestion(s) à valider</h3>
          {s.suggestions.map((x) => (
            <SuggestionCard key={x.id} s={x} onDone={() => { q.refetch(); onApplied(); }} />
          ))}
        </div>
      )}

      {s && s.runs.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Dernières analyses : {s.runs.map((r) => `${new Date(r.created_at).toLocaleDateString("fr-FR")} (${r.lines} lignes, ${formatUsd(r.cost)})`).join(" · ")}
        </p>
      )}
    </section>
  );
}

function SuggestionCard({ s, onDone }: { s: Suggestion; onDone: () => void }) {
  const k = KIND[s.kind];
  // Duplicates: keep the first (oldest) payment, propose to drop the copies.
  const [sel, setSel] = useState<Set<string>>(() => new Set((s.kind === "duplicate" ? s.lines.slice(1) : s.lines).map((t) => t.id)));
  const [target, setTarget] = useState(s.target_supplier ?? "");
  const [busy, setBusy] = useState(false);
  const notPending = s.kind !== "group" && s.lines.some((t) => sel.has(t.id) && t.review_state !== "pending");

  async function decide(apply: boolean) {
    setBusy(true);
    try {
      const r = await decideSuggestion({ data: { id: s.id, apply, transactionIds: [...sel], targetSupplier: target } });
      toast.success(apply ? `Suggestion appliquée : ${r.changed} ligne(s) mise(s) à jour` : "Suggestion ignorée");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={k.tone} icon={k.icon}>{KIND_LABEL[s.kind]}</Pill>
        <p className="text-sm">{s.reason}</p>
      </div>
      {s.kind === "group" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`target-${s.id}`}>Nom à retenir</label>
          <Input id={`target-${s.id}`} className="h-8 max-w-xs" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
      )}
      <ul className="mt-2 divide-y text-sm">
        {s.lines.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-1.5">
            <Checkbox
              aria-label={`Inclure la ligne du ${formatDate(t.date)}`}
              checked={sel.has(t.id)}
              onCheckedChange={(v) => setSel((p) => { const n = new Set(p); if (v) n.add(t.id); else n.delete(t.id); return n; })}
            />
            <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{formatDate(t.date)}</span>
            <span className="w-28 shrink-0 text-right tabular-nums">{formatEUR(Math.abs(Number(t.amount)))}</span>
            <span className="min-w-0 flex-1 truncate"><strong>{t.supplier}</strong> · {t.label}</span>
            {t.review_state !== "pending" && <span className="shrink-0 text-xs text-muted-foreground">{t.review_state === "sent" ? "déjà envoyée" : "non demandée"}</span>}
          </li>
        ))}
      </ul>
      {notPending && <p className="mt-1 text-xs text-muted-foreground">Les lignes déjà envoyées au client ne sont pas retirées de sa liste.</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => decide(true)} disabled={busy || sel.size === 0 || (s.kind === "group" && !target.trim())}>
          <Check /> {k.apply}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => decide(false)} disabled={busy}><X /> Ignorer</Button>
      </div>
    </div>
  );
}
