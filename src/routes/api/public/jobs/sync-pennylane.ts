import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { syncAllDossiers } from "@/lib/sync.server";

export const Route = createFileRoute("/api/public/jobs/sync-pennylane")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const results = await syncAllDossiers();
        return Response.json({ success: true, results });
      },
    },
  },
});
