import { createServerFn } from "@tanstack/react-start";

// Public: the client sign-in page shows the firm's identity. The `logos` bucket is
// private, so the logo is served through a short-lived signed URL.
export const getCabinetIdentity = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db.from("cabinet_settings").select("name, email, phone, logo_path").eq("id", 1).maybeSingle();
  if (error || !data) return null;
  let logoUrl: string | null = null;
  if (data.logo_path) {
    const { data: signed } = await db.storage.from("logos").createSignedUrl(data.logo_path, 6 * 3600);
    logoUrl = signed?.signedUrl ?? null;
  }
  return { name: data.name, email: data.email, phone: data.phone, logoUrl };
});
