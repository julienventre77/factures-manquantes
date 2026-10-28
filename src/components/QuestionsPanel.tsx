import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MessageSquare className="h-5 w-5" /> Questions transmises par le client ({list.filter((x) => !x.handled).length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {list.length === 0 && <p className="text-sm text-muted-foreground">Aucune question.</p>}
        {list.map((x) => (
          <div key={x.id} className="rounded-md border p-3">
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
      </CardContent>
    </Card>
  );
}
