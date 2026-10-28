import { useState } from "react";
import { toast } from "sonner";
import { Send, Ban, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupBySupplier, formatDate, formatEUR, type Tx } from "@/lib/session";

export function ReviewPanel({ pending, dismissed, onChanged }: { pending: Tx[]; dismissed: Tx[]; onChanged: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const groups = groupBySupplier(pending);
  const toggle = (ids: string[], on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  async function setState(ids: string[], review_state: "sent" | "dismissed" | "pending", msg: string) {
    if (!ids.length) return;
    setBusy(true);
    const { error } = await supabase.from("transactions").update({ review_state }).in("id", ids);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(msg);
    setSel(new Set());
    onChanged();
  }

  const selected = [...sel].filter((id) => pending.some((t) => t.id === id));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">
          À valider <Badge className="ml-2 bg-warning text-warning-foreground">{pending.length}</Badge>
        </h2>
        {pending.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy || !selected.length}
              onClick={() => setState(selected, "dismissed", "Paiement(s) écarté(s)")}>
              <Ban /> Ne pas demander
            </Button>
            <Button disabled={busy || !selected.length}
              onClick={() => setState(selected, "sent", `${selected.length} paiement(s) envoyé(s) au client`)}>
              <Send /> Envoyer au client ({selected.length})
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">Ces paiements ne sont pas visibles par le client tant que vous ne les avez pas envoyés.</p>
      {pending.length === 0 && <p className="text-muted-foreground">Rien à valider.</p>}
      {groups.map((g) => {
        const ids = g.txs.map((t) => t.id);
        const all = ids.every((id) => sel.has(id));
        return (
          <Card key={g.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">{g.name}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => toggle(ids, !all)}>
                {all ? "Tout décocher" : "Tout cocher"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {g.txs.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox checked={sel.has(t.id)} onCheckedChange={(v) => toggle([t.id], v === true)} />
                  <span className="font-semibold">{formatEUR(Math.abs(Number(t.amount)))}</span>
                  <span className="text-muted-foreground">{formatDate(t.date)} · {t.label}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        );
      })}
      {dismissed.length > 0 && (
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer font-semibold">Paiements écartés ({dismissed.length})</summary>
          <div className="mt-3 space-y-2">
            {dismissed.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span>
                  <span className="font-semibold">{t.supplier}</span> · {formatEUR(Math.abs(Number(t.amount)))} ·{" "}
                  <span className="text-muted-foreground">{formatDate(t.date)} · {t.label}</span>
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setState([t.id], "pending", "Paiement réactivé")}>
                  <RotateCcw /> Réactiver
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
