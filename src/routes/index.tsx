import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/LoginForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Espace client — PBC List" },
      { name: "description", content: "Connectez-vous pour transmettre vos factures manquantes à votre cabinet." },
      { property: "og:title", content: "Espace client — PBC List" },
      { property: "og:description", content: "Transmettez vos factures manquantes à votre cabinet comptable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LoginForm space="client" />,
});
