import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Filter, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSkipRule, deleteSkipRule } from "@/lib/skip-rules.functions";
import { describeRule, ruleMatches, type SkipRule } from "@/lib/skip-rules";
import type { Tx } from "@/lib/session";

type Kind = SkipRule["kind"];
type Dir = "all" | "out" | "in";

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
const selectClass =
  "h-10 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lot 3: per-dossier rules so recurring lines (URSSAF, salaires, impôts…) are not requested again at each sync.
export function SkipRulesPanel({ dossierId, txs, onChanged }: { dossierId: string; txs: Tx[]; onChanged: () => void }) {
  const [kind, setKind] = useState<Kind>("label");
  const [pattern, setPattern] = useState("");
  const [dir, setDir] = useState<Dir>("all");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["skip-rules", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase.from("skip_rules").select("*").eq("dossier_id", dossierId).order("created_at");
      if (error) throw error;
      return (data ?? []) as (SkipRule & { created_at: string })[];
    },
  });
  const rules = q.data ?? [];
  const suppliers = [...new Set(txs.map((t) => t.supplier))].sort((a, b) => a.localeCompare(b, "fr"));
  const draft: SkipRule = { id: "", kind, pattern, direction: dir === "all" ? null : dir };
  // Same scope as the sync: open lines still awaiting the cabinet's review.
  const wouldSkip = pattern.trim().length >= 2 ? txs.filter((t) => t.review_state === "pending" && ruleMatches(draft, t)).length : 0;
  const setAside = (id: string) => txs.filter((t) => t.skip_rule_id === id && t.review_state === "dismissed").length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await addSkipRule({ data: { dossierId, kind, pattern: pattern.trim(), direction: draft.direction } });
      toast.success(`Règle ajoutée : ${plural(r.skipped, "ligne")} mise${r.skipped > 1 ? "s" : ""} de côté.`);
      setPattern("");
      await q.refetch();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(rule: SkipRule) {
    if (!window.confirm(`Supprimer la règle « ${describeRule(rule)} » ? Les lignes qu'elle a mises de côté repasseront « À valider ».`)) return;
    try {
      const r = await deleteSkipRule({ data: { ruleId: rule.id } });
      toast.success(`Règle supprimée : ${plural(r.restored, "ligne")} à valider de nouveau.`);
      await q.refetch();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section id="regles" className="scroll-mt-6 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5" /> Règles « ne plus demander »</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Les lignes à valider qui correspondent à une règle passent en « Non demandée », maintenant et à chaque synchronisation.
        Les lignes déjà envoyées au client ne sont pas modifiées.
      </p>

      {rules.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Aucune règle pour ce dossier.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-semibold">{describeRule(r)}</span>
                <span className="text-muted-foreground"> · {plural(setAside(r.id), "ligne")} mise{setAside(r.id) > 1 ? "s" : ""} de côté</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => remove(r)} aria-label={`Supprimer la règle ${describeRule(r)}`}>
                <Trash2 /> Supprimer
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[11rem_1fr_9rem_auto] sm:items-end">
        <SelectField id="rule-kind" label="Type" value={kind} onChange={(v) => setKind(v as Kind)}
          options={[["label", "Libellé contenant"], ["supplier", "Tiers"]]} />
        <div className="space-y-1">
          <Label htmlFor="rule-pattern">{kind === "label" ? "Mot(s) du libellé" : "Nom du tiers"}</Label>
          <Input id="rule-pattern" required minLength={2} maxLength={120} value={pattern} onChange={(e) => setPattern(e.target.value)}
            placeholder={kind === "label" ? "ex. URSSAF, DGFIP, SALAIRE" : "ex. Amazon"} list={kind === "supplier" ? "rule-suppliers" : undefined} />
          <datalist id="rule-suppliers">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <SelectField id="rule-dir" label="Sens" value={dir} onChange={(v) => setDir(v as Dir)}
          options={[["all", "Achats et ventes"], ["out", "Achats"], ["in", "Ventes"]]} />
        <Button type="submit" disabled={busy || pattern.trim().length < 2}><Plus /> Ajouter</Button>
      </form>
      {pattern.trim().length >= 2 && (
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {wouldSkip ? `${plural(wouldSkip, "ligne")} à valider ser${wouldSkip > 1 ? "ont" : "a"} mise${wouldSkip > 1 ? "s" : ""} de côté.` : "Aucune ligne à valider ne correspond pour l'instant."}
        </p>
      )}
    </section>
  );
}

function SelectField({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
      </div>
    </div>
  );
}
