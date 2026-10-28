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
  review_state?: string;
  counterpart_accounts?: string | null;
  skip_rule_id?: string | null;
  direction: "out" | "in";
};

export type SupplierGroup = { key: string; direction: "out" | "in"; name: string; txs: Tx[]; total: number; state: "todo" | "progress" | "done" };

export function groupBySupplier(txs: Tx[]): SupplierGroup[] {
  const map = new Map<string, Tx[]>();
  for (const t of txs) {
    const k = `${t.direction === "in" ? "vente" : "achat"}:${t.supplier}`;
    map.set(k, [...(map.get(k) ?? []), t]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .map(([key, list]) => {
      const direction = key.startsWith("vente:") ? ("in" as const) : ("out" as const);
      const name = list[0]!.supplier;
      const done = list.filter((t) => t.status !== "a_faire").length;
      return {
        key,
        direction,
        name,
        txs: list.sort((a, b) => a.date.localeCompare(b.date)),
        total: list.reduce((s, t) => s + Math.abs(Number(t.amount)), 0),
        state: done === 0 ? "todo" : done === list.length ? "done" : "progress",
      };
    });
}

// Route guards (UI only; RLS stays the security boundary).
import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
export async function requireCabinet({ context }: { context: { queryClient: QueryClient } }) {
  const me = await context.queryClient.fetchQuery(meQuery);
  if (!me?.isCabinet) throw redirect({ to: "/cabinet/connexion" });
}
export async function requireClient({ context }: { context: { queryClient: QueryClient } }) {
  const me = await context.queryClient.fetchQuery(meQuery);
  if (!me || me.isCabinet || !me.dossierId) throw redirect({ to: "/" });
}
