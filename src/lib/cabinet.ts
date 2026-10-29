import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Identity of the accounting firm shown to clients (design option C), stored in
// `cabinet_settings` and edited on the cabinet's Paramètres page. Public on purpose:
// the client sign-in page shows it. Empty email/phone are hidden.
export type CabinetIdentity = { name: string; email: string; phone: string; logoUrl: string | null };

export const DEFAULT_CABINET: CabinetIdentity = { name: "Votre cabinet", email: "", phone: "", logoUrl: null };

export const LOGO_BUCKET = "logos";

export function logoPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export const cabinetQuery = queryOptions({
  queryKey: ["cabinet-identity"],
  queryFn: async (): Promise<CabinetIdentity> => {
    const { data, error } = await supabase.from("cabinet_settings").select("name, email, phone, logo_path").eq("id", 1).maybeSingle();
    // Before the migration is applied, or if the row is missing, keep the placeholder.
    if (error || !data) return DEFAULT_CABINET;
    return {
      name: data.name?.trim() || DEFAULT_CABINET.name,
      email: data.email?.trim() ?? "",
      phone: data.phone?.trim() ?? "",
      logoUrl: logoPublicUrl(data.logo_path),
    };
  },
  staleTime: 5 * 60_000,
});

export function useCabinet(): CabinetIdentity {
  return useQuery(cabinetQuery).data ?? DEFAULT_CABINET;
}
