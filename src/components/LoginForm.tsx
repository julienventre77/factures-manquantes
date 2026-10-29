import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Briefcase, Eye, EyeOff, FileX, Mail, ShieldCheck, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBootstrapStatus, bootstrapCabinet } from "@/lib/admin.functions";
import { meQuery } from "@/lib/session";
import { useCabinet } from "@/lib/cabinet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark, Monogram } from "@/components/brand";
import { CabinetContact } from "@/components/AppHeader";

const FEATURES = [
  { icon: Upload, text: "Déposez vos factures en PDF, JPG ou PNG" },
  { icon: Mail, text: "Ou transférez-les simplement par e-mail" },
  { icon: FileX, text: "Pas de facture ? Indiquez-le, tout simplement" },
];

type Space = "client" | "cabinet";

export function LoginForm({ space }: { space: Space }) {
  const cabinet = useCabinet();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrongSpace, setWrongSpace] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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

  const form = (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-semibold">Adresse e-mail</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom.nom@entreprise.fr" className="h-12 bg-card md:text-base" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-semibold">Mot de passe</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={needsBootstrap ? "new-password" : "current-password"}
            required
            minLength={needsBootstrap ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 bg-card pr-12 md:text-base"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-muted-foreground hover:text-primary"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {wrongSpace && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-red-soft p-3 text-sm">
          {wrongSpace}.{" "}
          <Link to={isCabinetPage ? "/" : "/cabinet/connexion"} className="font-medium underline">
            {isCabinetPage ? "Aller à l'espace client" : "Aller à l'espace cabinet"}
          </Link>
        </div>
      )}
      <Button type="submit" size="xl" className="sm:w-full" disabled={busy}>
        {needsBootstrap ? "Créer le compte cabinet" : "Se connecter"} <ArrowRight className="text-mint" />
      </Button>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Vos documents sont stockés de façon privée et sécurisée.
      </p>
    </form>
  );

  if (isCabinetPage)
    return (
      <main className="space-cabinet flex min-h-screen flex-col bg-background">
        <div className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-3">
            <BrandMark tone="mint" />
            <span className="font-bold">PBC List <span className="font-normal text-primary-foreground/80">· Espace cabinet</span></span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <h1 className="text-3xl">Espace cabinet</h1>
            <p className="mt-2 text-muted-foreground">
              {needsBootstrap
                ? "Première utilisation : créez le compte administrateur du cabinet."
                : "Gestion des dossiers clients et des demandes de factures."}
            </p>
            <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">{form}</div>
          </div>
        </div>
      </main>
    );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-48 h-[30rem] w-[30rem] rounded-full bg-pale/70" />
      <div aria-hidden className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-cream-2" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:py-12">
        <div className="grid flex-1 content-center gap-8 lg:grid-cols-2 lg:gap-x-16">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <div className="flex items-center gap-3">
              <Monogram name={cabinet.name} logoUrl={cabinet.logoUrl} className="h-14 w-14 text-base" />
              <span className="text-lg font-bold text-primary">{cabinet.name}</span>
            </div>
            <h1 className="mt-8 text-4xl sm:text-5xl">Espace client</h1>
            <p className="mt-3 text-lg text-muted-foreground sm:text-xl">Transmettez vos factures manquantes en quelques minutes</p>
          </div>
          <div className="rounded-3xl border bg-card p-6 shadow-xl shadow-primary/10 sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            {form}
          </div>
          <div className="lg:col-start-1 lg:row-start-2">
            <ul className="space-y-4">
              {FEATURES.map(({ icon: FeatureIcon, text }) => (
                <li key={text} className="flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                    <FeatureIcon className="h-5 w-5" />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            {(cabinet.email || cabinet.phone) && (
              <div className="mt-8 rounded-2xl border bg-card/70 p-4">
                <p className="text-sm">Une question ? <strong>{cabinet.name}</strong> vous répond.</p>
                <CabinetContact className="mt-2" />
              </div>
            )}
          </div>
        </div>
        <footer className="mt-10 flex items-center justify-between border-t border-cream-3 pt-5 text-sm">
          <span className="flex items-center gap-2 font-semibold text-primary">
            <BrandMark className="h-6 w-6 rounded-md [&_svg]:h-4 [&_svg]:w-4" /> PBC List
          </span>
          <Link to="/cabinet/connexion" className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
            <Briefcase className="h-4 w-4" /> Accès cabinet
          </Link>
        </footer>
      </div>
    </main>
  );
}
