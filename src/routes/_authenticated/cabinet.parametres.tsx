import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, ImagePlus, Mail, Phone, Save, Trash2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Monogram } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCabinetAccount, listCabinetAccounts } from "@/lib/admin.functions";
import { DEFAULT_CABINET, LOGO_BUCKET, cabinetQuery, useCabinet } from "@/lib/cabinet";
import { requireCabinet } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/cabinet/parametres")({
  beforeLoad: requireCabinet,
  head: () => ({
    meta: [
      { title: "Paramètres du cabinet — PBC List" },
      { name: "description", content: "Nom, logo et coordonnées du cabinet affichés aux clients." },
      { property: "og:title", content: "Paramètres du cabinet — PBC List" },
      { property: "og:description", content: "Nom, logo et coordonnées du cabinet affichés aux clients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const LOGO_MAX = 1024 * 1024;

function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cabinet-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cabinet_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [f, setF] = useState({ name: "", email: "", phone: "" });
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = useCabinet();

  useEffect(() => {
    if (!q.data) return;
    setF({ name: q.data.name ?? "", email: q.data.email ?? "", phone: q.data.phone ?? "" });
    setLogoPath(q.data.logo_path);
  }, [q.data]);

  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!LOGO_TYPES[picked.type]) { toast.error("Format accepté : PNG, JPG ou WebP."); return; }
    if (picked.size > LOGO_MAX) { toast.error("Le logo doit faire moins de 1 Mo."); return; }
    setFile(picked);
  }

  function removeLogo() {
    setFile(null);
    setLogoPath(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const previous = q.data?.logo_path ?? null;
    try {
      let nextPath = logoPath;
      if (file) {
        nextPath = `cabinet/logo-${Date.now()}.${LOGO_TYPES[file.type]}`;
        const { error } = await supabase.storage.from(LOGO_BUCKET).upload(nextPath, file, { contentType: file.type });
        if (error) throw error;
      }
      const { error } = await supabase
        .from("cabinet_settings")
        .update({
          name: f.name.trim() || DEFAULT_CABINET.name,
          email: f.email.trim() || null,
          phone: f.phone.trim() || null,
          logo_path: nextPath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
      // The old logo is no longer referenced: remove it (best effort).
      if (previous && previous !== nextPath) await supabase.storage.from(LOGO_BUCKET).remove([previous]);
      setFile(null);
      toast.success("Paramètres enregistrés : les clients voient désormais ces informations.");
      await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: cabinetQuery.queryKey })]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const preview = {
    name: f.name.trim() || DEFAULT_CABINET.name,
    email: f.email.trim(),
    phone: f.phone.trim(),
    logoUrl: filePreview ?? (logoPath && logoPath === q.data?.logo_path ? saved.logoUrl : null),
  };

  return (
    <div className="space-cabinet min-h-screen bg-background pb-24">
      <AppHeader space="cabinet" />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm">
          <Link to="/cabinet" className="font-semibold text-primary hover:underline">Dossiers clients</Link>
          <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Paramètres du cabinet</span>
        </nav>
        <div>
          <h1 className="text-2xl sm:text-3xl">Paramètres du cabinet</h1>
          <p className="mt-1 text-muted-foreground">
            Ces informations sont affichées aux clients : page de connexion, en-tête de leur espace et écran de fin.
          </p>
        </div>

        {q.isError ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-red-soft p-3 text-sm text-destructive">
            Paramètres indisponibles : la mise à jour de la base de données n'est peut-être pas encore appliquée.
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_26rem]">
            <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-lg">Identité</h2>
              <div className="space-y-1">
                <Label htmlFor="c-name">Nom du cabinet</Label>
                <Input id="c-name" required maxLength={80} placeholder={DEFAULT_CABINET.name} value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="c-email">E-mail de contact</Label>
                  <Input id="c-email" type="email" maxLength={120} placeholder="contact@cabinet.fr" value={f.email}
                    onChange={(e) => setF({ ...f, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-phone">Téléphone</Label>
                  <Input id="c-phone" type="tel" maxLength={30} placeholder="01 23 45 67 89" value={f.phone}
                    onChange={(e) => setF({ ...f, phone: e.target.value })} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Laissez l'e-mail ou le téléphone vide pour ne pas l'afficher.</p>

              <div className="space-y-2">
                <span className="text-sm font-medium">Logo</span>
                <div className="flex flex-wrap items-center gap-3">
                  <Monogram name={preview.name} logoUrl={preview.logoUrl} className="h-16 w-16 text-lg" />
                  <Button type="button" variant="outline" asChild>
                    <label htmlFor="c-logo" className="cursor-pointer"><ImagePlus /> {preview.logoUrl ? "Changer le logo" : "Ajouter un logo"}</label>
                  </Button>
                  <input id="c-logo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={pick} />
                  {preview.logoUrl && (
                    <Button type="button" variant="ghost" onClick={removeLogo}><Trash2 /> Retirer</Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  PNG, JPG ou WebP, 1 Mo au plus. Sans logo, les initiales du cabinet sont affichées. Le logo est visible sur la page de connexion, comme le nom du cabinet.
                </p>
              </div>

              <Button type="submit" disabled={busy || !q.data}><Save /> Enregistrer</Button>
            </form>

            <Preview cabinet={preview} />
          </div>
        )}

        <CabinetAccounts />
      </main>
    </div>
  );
}

// What the client sees, updated as the form is filled in.
function Preview({ cabinet }: { cabinet: { name: string; email: string; phone: string; logoUrl: string | null } }) {
  return (
    <section aria-label="Aperçu côté client" className="space-y-3">
      <h2 className="text-lg">Aperçu côté client</h2>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Monogram name={cabinet.name} logoUrl={cabinet.logoUrl} />
          <div className="min-w-0">
            <div className="truncate font-bold leading-tight text-primary">{cabinet.name}</div>
            <div className="text-sm text-muted-foreground">Espace client</div>
          </div>
        </div>
        <div className="space-y-3 bg-background p-4">
          <p className="text-xl font-bold text-primary">Espace client</p>
          <p className="text-sm text-muted-foreground">Transmettez vos factures manquantes en quelques minutes</p>
          {cabinet.email || cabinet.phone ? (
            <div className="rounded-2xl border bg-card/70 p-3 text-sm">
              <p>Une question ? <strong>{cabinet.name}</strong> vous répond.</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-medium text-primary">
                {cabinet.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" /> {cabinet.phone}</span>}
                {cabinet.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" /> {cabinet.email}</span>}
              </div>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">Aucune coordonnée affichée.</p>
          )}
        </div>
      </div>
    </section>
  );
}

// Cabinet accounts: list and creation with an initial password, typed here and passed on by the cabinet.
function CabinetAccounts() {
  const q = useQuery({ queryKey: ["cabinet-accounts"], queryFn: () => listCabinetAccounts() });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createCabinetAccount({ data: { email, password } });
      toast.success("Accès cabinet créé. Transmettez l'e-mail et le mot de passe à la personne concernée.");
      setEmail(""); setPassword("");
      await q.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="comptes-cabinet" className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" /> Accès cabinet</h2>
      <div className="mt-3">
        {q.isError ? <p className="text-sm text-destructive">Liste indisponible.</p>
          : !q.data ? <p className="text-sm text-muted-foreground">Chargement…</p>
          : <ul className="space-y-1 text-sm">{q.data.map((m) => <li key={m} className="font-mono">{m}</li>)}</ul>}
      </div>
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input type="email" required placeholder="E-mail du collaborateur" aria-label="E-mail du collaborateur" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="text" required minLength={8} placeholder="Mot de passe initial (8+)" aria-label="Mot de passe initial" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" disabled={busy}><UserPlus /> Créer l'accès</Button>
      </form>
    </section>
  );
}
