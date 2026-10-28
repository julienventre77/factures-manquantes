import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, FileCheck2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBootstrapStatus, bootstrapCabinet } from "@/lib/admin.functions";
import { meQuery } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Space = "client" | "cabinet";

export function LoginForm({ space }: { space: Space }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrongSpace, setWrongSpace] = useState<string | null>(null);
  const isCabinetPage = space === "cabinet";
  const boot = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => getBootstrapStatus(),
    enabled: isCabinetPage,
  });
  const needsBootstrap = isCabinetPage && boot.data?.needsBootstrap;

  async function freshMe() {
    qc.removeQueries({ queryKey: meQuery.queryKey });
    return qc.fetchQuery(meQuery);
  }
  const goHome = () => navigate({ to: isCabinetPage ? "/cabinet" : "/espace" });

  // Already signed in with the right kind of account: go straight to the space.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const me = await freshMe();
      if (me && (isCabinetPage ? me.isCabinet : !me.isCabinet && me.dossierId)) goHome();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setWrongSpace(null);
    try {
      if (needsBootstrap) {
        await bootstrapCabinet({ data: { email, password } });
        toast.success("Compte cabinet créé");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("E-mail ou mot de passe incorrect");
      const me = await freshMe();
      if (isCabinetPage && !me?.isCabinet) {
        await supabase.auth.signOut();
        qc.clear();
        setWrongSpace("Ce compte est un compte client : veuillez utiliser l'espace client");
        return;
      }
      if (!isCabinetPage && me?.isCabinet) {
        await supabase.auth.signOut();
        qc.clear();
        setWrongSpace("Ce compte est un compte cabinet : veuillez utiliser l'espace cabinet");
        return;
      }
      if (!isCabinetPage && !me?.dossierId) {
        await supabase.auth.signOut();
        qc.clear();
        throw new Error("Aucun dossier n'est encore rattaché à ce compte. Contactez votre cabinet.");
      }
      goHome();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const Icon = isCabinetPage ? Building2 : FileCheck2;
  return (
    <main className={`flex min-h-screen items-center justify-center px-4 py-10 ${isCabinetPage ? "bg-secondary" : ""}`}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Icon className="mx-auto mb-3 h-10 w-10 text-primary" />
          {isCabinetPage && <Badge className="mb-2">Cabinet</Badge>}
          <h1 className="text-3xl font-semibold">{isCabinetPage ? "Espace cabinet" : "Espace client"}</h1>
          <p className="mt-2 text-muted-foreground">
            {isCabinetPage
              ? needsBootstrap
                ? "Première utilisation : créez le compte administrateur du cabinet."
                : "Gestion des dossiers clients et des demandes de factures."
              : "Transmettez vos factures manquantes en quelques minutes"}
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
              {wrongSpace && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  {wrongSpace}.{" "}
                  <Link to={isCabinetPage ? "/" : "/cabinet/connexion"} className="font-medium underline">
                    {isCabinetPage ? "Aller à l'espace client" : "Aller à l'espace cabinet"}
                  </Link>
                </div>
              )}
              <Button type="submit" size="xl" className="sm:w-full" disabled={busy}>
                {needsBootstrap ? "Créer le compte cabinet" : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Vos documents sont stockés de façon privée et sécurisée.
        </p>
        {!isCabinetPage && (
          <p className="mt-4 text-center text-xs">
            <Link to="/cabinet/connexion" className="text-muted-foreground/70 hover:underline">Accès cabinet</Link>
          </p>
        )}
      </div>
    </main>
  );
}
