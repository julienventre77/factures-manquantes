import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/espace/termine")({
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
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-success" />
        <h1 className="text-3xl font-semibold">Merci, c'est terminé !</h1>
        <p className="mt-3 text-muted-foreground">
          Vos réponses ont bien été transmises à votre cabinet. Votre comptable reviendra vers vous si besoin.
        </p>
        <Button asChild size="xl" variant="outline" className="mt-8">
          <Link to="/espace">Revenir à la liste</Link>
        </Button>
      </main>
    </div>
  ),
});
