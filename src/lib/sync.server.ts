import { normalizeSupplier } from "./supplier";

const BASE = "https://app.pennylane.com/api/external/v2";
const LOOKBACK_DAYS = 365;

type PlTx = {
  id: number;
  label: string | null;
  date: string;
  amount: string;
  attachment_required: boolean;
  archived_at: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pl<T>(path: string, companyId: string, token: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Company-Id": companyId, Accept: "application/json" },
    });
    if (res.status === 429) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      console.error("Pennylane error", res.status, body.slice(0, 500));
      if (res.status === 401 || res.status === 403)
        throw new Error("Pennylane refuse l'accès : vérifiez le jeton et son accès à ce dossier.");
      throw new Error(`Erreur Pennylane (${res.status}).`);
    }
    return (await res.json()) as T;
  }
  throw new Error("Pennylane : trop de requêtes, réessayez plus tard.");
}

export async function syncDossier(dossierId: string) {
  const token = process.env["PENNYLANE_API_TOKEN"];
  if (!token) throw new Error("Jeton Pennylane manquant.");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const { data: dossier, error: dErr } = await db.from("dossiers").select("*").eq("id", dossierId).single();
  if (dErr || !dossier) throw new Error("Dossier introuvable");

  try {
    // Guard: a company-bound token ignores X-Company-Id, so it must match this dossier.
    const me = await pl<{ company?: { id: number } | null }>("/me", dossier.company_id, token);
    if (me.company?.id && String(me.company.id) !== String(dossier.company_id).trim())
      throw new Error(
        `Le jeton Pennylane est lié à l'entreprise ${me.company.id}, pas au company_id ${dossier.company_id} de ce dossier.`,
      );

    // 1. Outgoing transactions requiring a document
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
    const filter = encodeURIComponent(JSON.stringify([{ field: "date", operator: "gteq", value: since }]));
    const candidates: PlTx[] = [];
    let cursor: string | null = null;
    do {
      const page: { items: PlTx[]; has_more: boolean; next_cursor: string | null } = await pl(
        `/transactions?limit=100&filter=${filter}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        dossier.company_id,
        token,
      );
      for (const t of page.items)
        if (t.attachment_required && !t.archived_at && Number(t.amount) < 0) candidates.push(t);
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor);

    // 2. Keep only those without a matched supplier invoice
    const needed: PlTx[] = [];
    for (const t of candidates) {
      const m = await pl<{ items: { type: string }[] }>(`/transactions/${t.id}/matched_invoices`, dossier.company_id, token);
      if (!m.items.some((i) => i.type === "supplier")) needed.push(t);
      await sleep(220); // stay under Pennylane rate limit
    }

    // 3. Upsert into the database, reapplying cabinet supplier corrections
    const { data: aliases } = await db.from("supplier_aliases").select("detected_name, display_name").eq("dossier_id", dossierId);
    const aliasMap = new Map((aliases ?? []).map((a) => [a.detected_name, a.display_name]));
    const { data: existing } = await db.from("transactions").select("id, pennylane_id, is_open").eq("dossier_id", dossierId);
    const byPl = new Map((existing ?? []).map((e) => [e.pennylane_id, e]));
    const neededIds = new Set(needed.map((t) => String(t.id)));

    const inserts = needed
      .filter((t) => !byPl.has(String(t.id)))
      .map((t) => {
        const detected = normalizeSupplier(t.label ?? "");
        return {
          dossier_id: dossierId,
          pennylane_id: String(t.id),
          date: t.date,
          amount: Number(t.amount),
          label: t.label ?? "",
          supplier_detected: detected,
          supplier: aliasMap.get(detected) ?? detected,
        };
      });
    if (inserts.length) {
      const { error } = await db.from("transactions").insert(inserts);
      if (error) throw error;
    }
    const reopen = (existing ?? []).filter((e) => !e.is_open && neededIds.has(e.pennylane_id)).map((e) => e.id);
    if (reopen.length) await db.from("transactions").update({ is_open: true }).in("id", reopen);
    const close = (existing ?? []).filter((e) => e.is_open && !neededIds.has(e.pennylane_id)).map((e) => e.id);
    if (close.length) await db.from("transactions").update({ is_open: false }).in("id", close);

    await db.from("dossiers").update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq("id", dossierId);
    return { added: inserts.length, closed: close.length, open: needed.length };
  } catch (e) {
    const msg = (e as Error).message;
    await db.from("dossiers").update({ last_sync_error: msg }).eq("id", dossierId);
    throw new Error(msg);
  }
}

export async function syncAllDossiers() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data } = await db.from("dossiers").select("id");
  const results: Record<string, unknown> = {};
  for (const d of data ?? []) {
    try {
      results[d.id] = await syncDossier(d.id);
    } catch (e) {
      results[d.id] = { error: (e as Error).message };
    }
  }
  return results;
}
