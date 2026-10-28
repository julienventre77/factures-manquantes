import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/LoginForm";

export const Route = createFileRoute("/cabinet/connexion")({
  head: () => ({
    meta: [
      { title: "Espace cabinet — PBC List" },
      { name: "description", content: "Connexion réservée au cabinet comptable." },
      { property: "og:title", content: "Espace cabinet — PBC List" },
      { property: "og:description", content: "Connexion réservée au cabinet comptable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LoginForm space="cabinet" />,
});
