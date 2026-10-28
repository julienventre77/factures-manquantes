import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function assertCabinet(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "cabinet" });
  if (!data) throw new Error("Accès refusé");
}

// Creates a "ne plus demander" rule and sets aside the matching lines awaiting review right away.
export const addSkipRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        dossierId: z.string().uuid(),
        kind: z.enum(["label", "supplier"]),
        pattern: z.string().trim().min(2).max(120),
        direction: z.enum(["out", "in"]).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCabinet(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("skip_rules").insert({
      dossier_id: data.dossierId,
      kind: data.kind,
      pattern: data.pattern,
      direction: data.direction,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    const { applySkipRules } = await import("./sync.server");
    return { skipped: await applySkipRules(data.dossierId) };
  });

// Deletes a rule; the lines it set aside (and still set aside) go back to "À valider".
export const deleteSkipRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ruleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCabinet(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: back, error: uErr } = await db
      .from("transactions")
      .update({ review_state: "pending" })
      .eq("skip_rule_id", data.ruleId)
      .eq("review_state", "dismissed")
      .select("id");
    if (uErr) throw new Error(uErr.message);
    const { error } = await db.from("skip_rules").delete().eq("id", data.ruleId);
    if (error) throw new Error(error.message);
    return { restored: back?.length ?? 0 };
  });
