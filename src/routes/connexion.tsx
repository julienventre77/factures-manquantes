import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/LoginForm";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Connexion client — PBC List" },
      { name: "description", content: "Connexion à l'espace client pour transmettre vos factures manquantes." },
      { property: "og:title", content: "Connexion client — PBC List" },
      { property: "og:description", content: "Connexion à l'espace client PBC List." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LoginForm space="client" />,
});
