import { requireClient } from "@/lib/session";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpChat } from "@/components/HelpChat";
import { CheckCircle2 } from "lucide-react";
import { AppHeader, CabinetContact } from "@/components/AppHeader";
import { useCabinet } from "@/lib/cabinet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/espace/termine")({
  beforeLoad: requireClient,
  head: () => ({
    meta: [
      { title: "Merci ! — PBC List" },
      { name: "description", content: "Vos réponses ont bien été transmises à votre cabinet." },
      { property: "og:title", content: "Merci ! — PBC List" },
      { property: "og:description", content: "Vos réponses ont bien été transmises à votre cabinet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background pb-28 sm:text-[17px]">
      <AppHeader space="client" /><HelpChat />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <section className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-xl shadow-primary/20 sm:px-12">
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full border-[48px] border-teal-2/60" />
          <div className="relative">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mint text-primary shadow-lg">
              <CheckCircle2 className="h-11 w-11" />
            </span>
            <h1 className="mt-6 text-3xl text-primary-foreground sm:text-4xl">Merci, c'est terminé !</h1>
            <p className="mx-auto mt-3 max-w-md text-primary-foreground/85">
              Vos réponses ont bien été transmises à votre cabinet. Votre comptable reviendra vers vous si besoin.
            </p>
            <Button asChild size="xl" className="mt-8 bg-mint text-primary hover:bg-mint-soft focus-visible:ring-mint focus-visible:ring-offset-primary">
              <Link to="/espace">Revenir à la liste</Link>
            </Button>
          </div>
        </section>
        <AskCabinet />
      </main>
    </div>
  ),
});

function AskCabinet() {
  const cabinet = useCabinet();
  if (!cabinet.email && !cabinet.phone) return null;
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      Une question ? {cabinet.name} vous répond : <CabinetContact />
    </div>
  );
}
