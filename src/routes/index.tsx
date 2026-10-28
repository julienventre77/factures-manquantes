import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBootstrapStatus, bootstrapCabinet } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Connexion — PBC List" },
      { name: "description", content: "Connectez-vous pour transmettre vos factures manquantes à votre cabinet." },
      { property: "og:title", content: "Connexion — PBC List" },
      { property: "og:description", content: "Transmettez vos factures manquantes à votre cabinet comptable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrapStatus() });
  const needsBootstrap = boot.data?.needsBootstrap;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/accueil" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (needsBootstrap) {
        await bootstrapCabinet({ data: { email, password } });
        toast.success("Compte cabinet créé");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("E-mail ou mot de passe incorrect.");
      navigate({ to: "/accueil" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <FileCheck2 className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-3xl font-semibold">PBC List</h1>
          <p className="mt-2 text-muted-foreground">
            {needsBootstrap
              ? "Première utilisation : créez le compte administrateur du cabinet."
              : "Transmettez vos factures manquantes en quelques minutes."}
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={needsBootstrap ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12"
                />
              </div>
              <Button type="submit" size="xl" className="sm:w-full" disabled={busy}>
                {needsBootstrap ? "Créer le compte cabinet" : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Vos documents sont stockés de façon privée et sécurisée.
        </p>
      </div>
    </main>
  );
}
