import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncDossierNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dossierId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isCabinet } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "cabinet" });
    if (!isCabinet) throw new Error("Accès refusé");
    const { syncDossier } = await import("./sync.server");
    return await syncDossier(data.dossierId);
  });
