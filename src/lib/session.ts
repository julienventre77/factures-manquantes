import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const isCabinet = !!roles?.some((r) => r.role === "cabinet");
    const { data: m } = await supabase
      .from("dossier_members")
      .select("dossier_id")
      .eq("user_id", u.user.id)
      .limit(1)
      .maybeSingle();
    return { id: u.user.id, email: u.user.email ?? "", isCabinet, dossierId: m?.dossier_id ?? null };
  },
});

export const STATUS_LABEL: Record<string, string> = {
  a_faire: "À faire",
  depose: "Déposé",
  email: "Transféré par e-mail",
  sans_facture: "Sans facture",
};

export function formatEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
export function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

export type Tx = {
  id: string;
  dossier_id: string;
  pennylane_id: string;
  date: string;
  amount: number;
  label: string;
  supplier: string;
  supplier_detected: string;
  status: "a_faire" | "depose" | "email" | "sans_facture";
  comment: string | null;
};

export type SupplierGroup = { name: string; txs: Tx[]; total: number; state: "todo" | "progress" | "done" };

export function groupBySupplier(txs: Tx[]): SupplierGroup[] {
  const map = new Map<string, Tx[]>();
  for (const t of txs) map.set(t.supplier, [...(map.get(t.supplier) ?? []), t]);
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .map(([name, list]) => {
      const done = list.filter((t) => t.status !== "a_faire").length;
      return {
        name,
        txs: list.sort((a, b) => a.date.localeCompare(b.date)),
        total: list.reduce((s, t) => s + Math.abs(Number(t.amount)), 0),
        state: done === 0 ? "todo" : done === list.length ? "done" : "progress",
      };
    });
}
