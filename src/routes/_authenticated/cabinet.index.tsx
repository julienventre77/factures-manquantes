import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCabinet, meQuery } from "@/lib/session";
import { McpPanel } from "@/components/McpPanel";
import { ImportDossiers } from "@/components/ImportDossiers";

export const Route = createFileRoute("/_authenticated/cabinet/")({
  beforeLoad: requireCabinet,
  head: () => ({
    meta: [
      { title: "Dossiers clients — PBC List" },
      { name: "description", content: "Suivi des factures manquantes par dossier client." },
      { property: "og:title", content: "Dossiers clients — PBC List" },
      { property: "og:description", content: "Suivi des factures manquantes par dossier client." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cabinet,
});

function Cabinet() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", company_id: "", collect_email: "" });
  const dossiers = useQuery({
    queryKey: ["dossiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("*, dossier_members(email), transactions(status, is_open)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("dossiers").insert({
      name: form.name, company_id: form.company_id, collect_email: form.collect_email || null,
    });
    if (error) { toast.error(error.message); return; }
    setForm({ name: "", company_id: "", collect_email: "" });
    toast.success("Dossier créé");
    qc.invalidateQueries({ queryKey: ["dossiers"] });
  }

  return (
    <div className="min-h-screen">
      <AppHeader space="cabinet" />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <h1 className="text-3xl font-semibold">Dossiers clients</h1>
        <McpPanel />
        <ImportDossiers existing={(dossiers.data ?? []).map((d) => d.company_id)} />
        <div className="space-y-3">
          {dossiers.data?.length === 0 && <p className="text-muted-foreground">Aucun dossier pour l'instant.</p>}
          {dossiers.data?.map((d) => {
            const open = d.transactions.filter((t) => t.is_open);
            const todo = open.filter((t) => t.status === "a_faire").length;
            return (
              <Link key={d.id} to="/cabinet/$dossierId" params={{ dossierId: d.id }}
                className="flex items-center justify-between rounded-xl border bg-card p-5 hover:shadow-md">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">{d.name}</div>
                  <div className="text-sm text-muted-foreground">
                    company_id {d.company_id} · {d.dossier_members.length} compte(s) client
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{d.collect_email ?? "Adresse de collecte non renseignée"}</div>
                </div>
                <div className="flex items-center gap-3 text-right text-sm">
                  <div><span className="font-semibold">{todo}</span> à faire<br /><span className="text-muted-foreground">sur {open.length}</span></div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
        <Card>
          <CardHeader><CardTitle>Nouveau dossier</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1"><Label>Nom</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>company_id Pennylane</Label>
                <Input required value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} /></div>
              <div className="space-y-1"><Label>Adresse de collecte</Label>
                <Input type="email" placeholder="nom-du-dossier-XXXX@suppliers.pennylane.com" value={form.collect_email}
                  onChange={(e) => setForm({ ...form, collect_email: e.target.value })} /></div>
              <Button type="submit" className="sm:col-span-3 sm:justify-self-start"><Plus /> Créer le dossier</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
