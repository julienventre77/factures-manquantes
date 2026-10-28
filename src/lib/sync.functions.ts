import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Placeholder: the Pennylane sync is implemented once PENNYLANE_API_TOKEN is configured.
export const syncDossierNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dossierId: z.string().uuid() }).parse(d))
  .handler(async ({ context }) => {
    const { data: isCabinet } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "cabinet" });
    if (!isCabinet) throw new Error("Accès refusé");
    if (!process.env["PENNYLANE_API_TOKEN"]) {
      throw new Error("La synchronisation Pennylane n'est pas encore configurée (jeton manquant).");
    }
    throw new Error("La synchronisation Pennylane sera disponible à la prochaine étape.");
  });
