import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCabinet(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "cabinet" });
  if (!data) throw new Error("Accès refusé");
}

// Returns only a status, never any token.
export const getMcpStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCabinet(context);
    const { getMcpPublicStatus } = await import("./mcp.server");
    return await getMcpPublicStatus();
  });

export const startMcpConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCabinet(context);
    const origin = new URL(getRequest().url).origin;
    const { startOAuth } = await import("./mcp.server");
    return { url: await startOAuth(origin, context.userId) };
  });

export const listMcpCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCabinet(context);
    const { mcpListCompanies } = await import("./mcp.server");
    return { companies: await mcpListCompanies() };
  });
