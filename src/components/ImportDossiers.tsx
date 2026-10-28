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

  // Rendered inside the Pennylane card: the button sits next to the others, the list takes a full row.
  return (
    <>
      <Button variant="outline" onClick={load} disabled={busy}>
        <Download /> Importer mes dossiers Pennylane
      </Button>
      {companies && (
        <div className="basis-full space-y-3 border-t pt-3">
          {companies.length === 0 && <p className="text-sm text-muted-foreground">Aucune entreprise accessible.</p>}
          {companies.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((c) => {
                const done = taken.has(c.company_id);
                return (
                  <label key={c.company_id} className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-pale-2">
                    <Checkbox
                      disabled={done}
                      checked={done || sel.has(c.company_id)}
                      onCheckedChange={(v) => {
                        const n = new Set(sel);
                        if (v) n.add(c.company_id); else n.delete(c.company_id);
                        setSel(n);
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.company_id}{done && " · déjà importé"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {companies.length > 0 && (
            <Button onClick={create} disabled={busy || sel.size === 0}>Créer les dossiers sélectionnés ({sel.size})</Button>
          )}
        </div>
      )}
    </>
  );
}
