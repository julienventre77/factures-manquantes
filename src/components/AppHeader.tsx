import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader({ space }: { space: "client" | "cabinet" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: space === "cabinet" ? "/cabinet/connexion" : "/", replace: true });
  }
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-6 w-6 text-primary" />
          <div>
            <div className="font-serif text-lg font-semibold leading-none">PBC List</div>
            <div className="text-xs font-medium text-muted-foreground">{space === "cabinet" ? "Espace cabinet" : "Espace client"}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut /> Se déconnecter
        </Button>
      </div>
    </header>
  );
}
