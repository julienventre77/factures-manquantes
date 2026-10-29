import { queryOptions, useQuery } from "@tanstack/react-query";
import { getCabinetIdentity } from "@/lib/cabinet.functions";

// Identity of the accounting firm shown to clients (design option C), stored in
// `cabinet_settings` and edited on the cabinet's Paramètres page. Public on purpose:
// the client sign-in page shows it; the logo comes as a signed URL. Empty email/phone are hidden.
export type CabinetIdentity = { name: string; email: string; phone: string; logoUrl: string | null };

export const DEFAULT_CABINET: CabinetIdentity = { name: "Votre cabinet", email: "", phone: "", logoUrl: null };

export const LOGO_BUCKET = "logos";

export const cabinetQuery = queryOptions({
  queryKey: ["cabinet-identity"],
  queryFn: async (): Promise<CabinetIdentity> => {
    // Before the settings exist, or if the call fails, keep the placeholder.
    const data = await getCabinetIdentity().catch(() => null);
    if (!data) return DEFAULT_CABINET;
    return {
      name: data.name?.trim() || DEFAULT_CABINET.name,
      email: data.email?.trim() ?? "",
      phone: data.phone?.trim() ?? "",
      logoUrl: data.logoUrl,
    };
  },
  staleTime: 5 * 60_000,
});

export function useCabinet(): CabinetIdentity {
  return useQuery(cabinetQuery).data ?? DEFAULT_CABINET;
}
