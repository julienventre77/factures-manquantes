import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, LogOut, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark, Monogram } from "@/components/brand";
import { CABINET } from "@/lib/cabinet";
import { meQuery } from "@/lib/session";
import { cn } from "@/lib/utils";

export function AppHeader({ space }: { space: "client" | "cabinet" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: space === "cabinet" ? "/cabinet/connexion" : "/", replace: true });
  }
  return space === "cabinet" ? <CabinetBar onSignOut={signOut} /> : <ClientBar onSignOut={signOut} />;
}

// Client side (design B, warm): the firm's identity comes first (design C).
function ClientBar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Monogram name={CABINET.name} />
          <div className="min-w-0">
            <div className="truncate font-bold leading-tight text-primary">{CABINET.name}</div>
            <div className="text-sm text-muted-foreground">Espace client</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <CabinetContact className="hidden md:flex" />
          <Button variant="outline" onClick={onSignOut} aria-label="Se déconnecter">
            <LogOut /> <span className="hidden sm:inline">Se déconnecter</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

// Phone and e-mail of the firm, hidden while they are not filled in.
export function CabinetContact({ className }: { className?: string | undefined }) {
  if (!CABINET.email && !CABINET.phone) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-primary", className)}>
      {CABINET.phone && (
        <a href={`tel:${CABINET.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:underline">
          <Phone className="h-4 w-4" /> {CABINET.phone}
        </a>
      )}
      {CABINET.email && (
        <a href={`mailto:${CABINET.email}`} className="inline-flex items-center gap-1.5 hover:underline">
          <Mail className="h-4 w-4" /> {CABINET.email}
        </a>
      )}
    </div>
  );
}

// Cabinet side (design B, dense): teal bar with navigation.
function CabinetBar({ onSignOut }: { onSignOut: () => void }) {
  const me = useQuery(meQuery);
  const email = me.data?.email ?? "";
  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4">
        <Link to="/cabinet" className="flex items-center gap-2.5 py-3">
          <BrandMark tone="mint" />
          <span className="font-bold">
            PBC List <span className="hidden font-normal text-primary-foreground/80 sm:inline">· Espace cabinet</span>
          </span>
        </Link>
        <nav className="hidden self-stretch sm:flex">
          <Link
            to="/cabinet"
            className="flex items-center gap-2 border-b-[3px] border-transparent px-3 text-sm font-semibold text-primary-foreground/80 hover:text-primary-foreground data-[status=active]:border-mint data-[status=active]:text-primary-foreground"
          >
            <FolderOpen className="h-4 w-4" /> Dossiers clients
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 py-2">
          {email && (
            <div className="hidden items-center gap-2 md:flex">
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-sm font-bold text-primary">
                {email.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm leading-tight">
                <span className="block max-w-[14rem] truncate font-semibold">{email}</span>
                <span className="text-primary-foreground/70">Cabinet</span>
              </span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={onSignOut}
            aria-label="Se déconnecter"
            className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <LogOut /> <span className="hidden sm:inline">Se déconnecter</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
