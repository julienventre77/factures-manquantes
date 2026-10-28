import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/accueil")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (me?.isCabinet) throw redirect({ to: "/cabinet" });
    throw redirect({ to: "/espace" });
  },
});
