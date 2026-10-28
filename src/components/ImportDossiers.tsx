import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getMcpStatus, listMcpCompanies } from "@/lib/mcp.functions";

type Company = { company_id: string; name: string };

export function ImportDossiers({ existing }: { existing: string[] }) {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getMcpStatus);
  const list = useServerFn(listMcpCompanies);
  const status = useQuery({ queryKey: ["mcp-status"], queryFn: () => fetchStatus() });
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  if (status.data?.status !== "connected") return null;
  const taken = new Set(existing);

  async function load() {
    setBusy(true);
    try {
      const r = await list();
      setCompanies(r.companies);
      setSel(new Set());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const rows = (companies ?? []).filter((c) => sel.has(c.company_id) && !taken.has(c.company_id));
    if (!rows.length) return;
    setBusy(true);
    const { error } = await supabase.from("dossiers").insert(
      rows.map((c) => ({ name: c.name, company_id: c.company_id, collect_email: null, collect_email_customers: null, detect_prefixes: "401, 411, 471" })),
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} dossier(s) créé(s). Cliquez sur « Actualiser maintenant » dans chaque dossier.`);
    setSel(new Set());
    qc.invalidateQueries({ queryKey: ["dossiers"] });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <Button size="lg" variant="outline" onClick={load} disabled={busy}>
        <Download /> Importer mes dossiers Pennylane
      </Button>
      {companies && (
        <div className="space-y-3">
          {companies.length === 0 && <p className="text-sm text-muted-foreground">Aucune entreprise accessible.</p>}
          {companies.map((c) => {
            const done = taken.has(c.company_id);
            return (
              <label key={c.company_id} className="flex items-center gap-3 text-sm">
                <Checkbox
                  disabled={done}
                  checked={done || sel.has(c.company_id)}
                  onCheckedChange={(v) => {
                    const n = new Set(sel);
                    if (v) n.add(c.company_id); else n.delete(c.company_id);
                    setSel(n);
                  }}
                />
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">company_id {c.company_id}</span>
                {done && <span className="text-muted-foreground">· déjà importé</span>}
              </label>
            );
          })}
          {companies.length > 0 && (
            <Button onClick={create} disabled={busy || sel.size === 0}>Créer les dossiers sélectionnés ({sel.size})</Button>
          )}
        </div>
      )}
    </div>
  );
}
