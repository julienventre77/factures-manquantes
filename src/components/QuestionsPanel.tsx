import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function QuestionsPanel({ dossierId }: { dossierId: string }) {
  const q = useQuery({
    queryKey: ["questions", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cabinet_questions").select("*")
        .eq("dossier_id", dossierId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  async function toggle(id: string, handled: boolean) {
    await supabase.from("cabinet_questions").update({ handled }).eq("id", id);
    q.refetch();
  }
  const list = q.data ?? [];
  // Only shown once the client has forwarded a question through the assistant.
  if (list.length === 0) return null;
  const open = list.filter((x) => !x.handled).length;
  return (
    <section className={`rounded-xl border bg-card p-5 shadow-sm ${open ? "border-yellow" : ""}`}>
      <h2 className="flex items-center gap-2 text-lg">
        <MessageSquare className="h-5 w-5" /> Questions transmises par le client
        {open > 0 && <span className="rounded-full bg-yellow-soft px-2 py-0.5 text-sm font-bold text-yellow-ink">{open} à traiter</span>}
      </h2>
      <div className="mt-3 space-y-3">
        {list.map((x) => (
          <div key={x.id} className={`rounded-lg border p-3 ${x.handled ? "bg-muted/40" : ""}`}>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {new Date(x.created_at).toLocaleString("fr-FR")} · {x.user_email}
              {x.context && <Badge variant="outline">{x.context.replace(/^achat:/, "Fournisseur : ").replace(/^vente:/, "Client : ")}</Badge>}
              {x.handled && <Badge variant="secondary">Traitée</Badge>}
            </div>
            <p className="whitespace-pre-wrap text-sm">{x.question}</p>
            <Button size="sm" variant="ghost" className="mt-1" onClick={() => toggle(x.id, !x.handled)}>
              {x.handled ? "Marquer non traitée" : "Marquer comme traitée"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
