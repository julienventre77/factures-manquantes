import { normalizeSupplier } from "./supplier";
import { findRule, type SkipRule } from "./skip-rules";

const BASE = "https://app.pennylane.com/api/external/v2";
const LOOKBACK_DAYS = 365;

type PlTx = {
  id: number;
  label: string | null;
  date: string;
  amount: string;
  attachment_required: boolean;
  archived_at: string | null;
  journal?: { id: number } | null;
};

type PlLine = {
  ledger_entry: { id: number };
  ledger_account: { number: string };
  lettered_ledger_entry_lines?: { ids: number[] };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const NO_ACCESS_MSG = "Le jeton Pennylane actuel ne donne pas accès à ce dossier. Un jeton cabinet est nécessaire.";

// Lightweight access check with the dossier's X-Company-Id (company or firm token).
async function checkAccess(companyId: string, token: string) {
  const headers = { Authorization: `Bearer ${token}`, "X-Company-Id": companyId, Accept: "application/json" };
  const me = await fetch(`${BASE}/me`, { headers });
  if (me.status === 403 || me.status === 404) throw new Error(NO_ACCESS_MSG);
  if (me.ok) {
    const body = (await me.json()) as { company?: { id: number } | null };
    if (body.company?.id && String(body.company.id) !== String(companyId).trim()) throw new Error(NO_ACCESS_MSG);
  }
  const probe = await fetch(`${BASE}/transactions?limit=1`, { headers });
  if (probe.status === 403 || probe.status === 404) throw new Error(NO_ACCESS_MSG);
}

export const DEFAULT_PREFIXES = "401, 411, 471";
export function parsePrefixes(s: string | null | undefined): string[] {
  const list = (s ?? DEFAULT_PREFIXES).split(/[,;\s]+/).map((p) => p.trim()).filter((p) => /^\d+$/.test(p));
  return list.length ? list : parsePrefixes(DEFAULT_PREFIXES);
}
export function matchesPrefix(account: string, prefixes: string[]) {
  return prefixes.some((p) => account.startsWith(p));
}

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

async function plAll<T>(path: string, filter: unknown[], companyId: string, token: string): Promise<T[]> {
  const out: T[] = [];
  const f = encodeURIComponent(JSON.stringify(filter));
  let cursor: string | null = null;
  do {
    const page: { items: T[]; has_more: boolean; next_cursor: string | null } = await pl(
      `${path}?limit=100&filter=${f}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      companyId,
      token,
    );
    out.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return out;
}

// Shared detection: same rule for MCP and API data.
type NTx = { id: string; label: string; date: string; amount: string };
type NLine = { entry: string; account: string; lettered: boolean };
function detect(txs: NTx[], lines: NLine[], prefixesStr: string | null) {
  const counterparts = new Map<string, string[]>();
  const unletteredElsewhere = new Set<string>();
  const byEntry = new Map<string, NLine[]>();
  for (const l of lines) byEntry.set(l.entry, [...(byEntry.get(l.entry) ?? []), l]);
  const prefixes = parsePrefixes(prefixesStr);
  const needed = txs.filter((t) => {
    const cp = (byEntry.get(t.id) ?? []).filter((l) => !l.account.startsWith("512"));
    counterparts.set(t.id, [...new Set(cp.map((l) => l.account))]);
    if (cp.length === 0) return true; // no accounting entry yet: still needs follow-up
    const unlettered = cp.filter((l) => !l.lettered);
    if (unlettered.length) unletteredElsewhere.add(t.id);
    return unlettered.some((l) => matchesPrefix(l.account, prefixes));
  });
  return { needed, counterparts, unletteredElsewhere };
}

async function fetchViaApi(dossier: { company_id: string; detect_prefixes: string | null }, since: string) {
  const token = process.env["PENNYLANE_API_TOKEN"];
  if (!token) throw new Error("Jeton Pennylane manquant.");
  await checkAccess(dossier.company_id, token);
  const outgoing = (
    await plAll<PlTx>("/transactions", [{ field: "date", operator: "gteq", value: since }], dossier.company_id, token)
  ).filter((t) => !t.archived_at && Number(t.amount) !== 0);
  try {
    const journals = [...new Set(outgoing.map((t) => t.journal?.id).filter(Boolean).map(String))];
    const lines = journals.length
      ? await plAll<PlLine>(
          "/ledger_entry_lines",
          [
            { field: "journal_id", operator: "in", value: journals },
            { field: "date", operator: "gteq", value: since },
          ],
          dossier.company_id,
          token,
        )
      : [];
    return detect(
      outgoing.map((t) => ({ id: String(t.id), label: t.label ?? "", date: t.date, amount: t.amount })),
      lines.map((l) => ({
        entry: String(l.ledger_entry.id),
        account: l.ledger_account.number,
        lettered: (l.lettered_ledger_entry_lines?.ids ?? []).length > 0,
      })),
      dossier.detect_prefixes,
    );
  } catch (e) {
    // Fallback to the previous criterion if accounting lines are unavailable.
    console.error("Lettering unavailable, fallback", (e as Error).message);
    const needed: NTx[] = [];
    for (const t of outgoing.filter((x) => x.attachment_required && Number(x.amount) < 0)) {
      const m = await pl<{ items: { type: string }[] }>(`/transactions/${t.id}/matched_invoices`, dossier.company_id, token);
      if (!m.items.some((i) => i.type === "supplier")) needed.push({ id: String(t.id), label: t.label ?? "", date: t.date, amount: t.amount });
      await sleep(220);
    }
    return { needed, counterparts: new Map<string, string[]>(), unletteredElsewhere: new Set<string>() };
  }
}

export async function syncDossier(dossierId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const { data: dossier, error: dErr } = await db.from("dossiers").select("*").eq("id", dossierId).single();
  if (dErr || !dossier) throw new Error("Dossier introuvable");

  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
    const mcp = await import("./mcp.server");
    let source = "MCP";
    let mcpError: string | null = null;
    let result: ReturnType<typeof detect>;
    try {
      const { txs, lines } = await mcp.mcpFetch(dossier.company_id, since);
      result = detect(
        txs.map((t) => ({ id: String(t.id), label: t.description ?? "", date: t.date, amount: t.amount })),
        lines.map((l) => ({ entry: String(l.journal_entry_id), account: l.account_number, lettered: !!l.lettering_id })),
        dossier.detect_prefixes,
      );
    } catch (e) {
      if (e instanceof mcp.McpNoAccess) {
        await db.from("dossiers").update({ last_mcp_error: e.message }).eq("id", dossierId);
        throw e;
      }
      if (e instanceof mcp.McpNotDemo) {
        // Expected for every non-demo dossier: the API is its normal source, not a fallback.
        source = "API";
      } else {
        mcpError = e instanceof mcp.McpUnavailable ? (e as Error).message : (e as Error).message.slice(0, 200);
        console.error("MCP sync failed, API fallback");
        source = "API (secours)";
      }
      result = await fetchViaApi(dossier, since);
    }
    const { needed, counterparts, unletteredElsewhere } = result;

    // 3. Upsert into the database, reapplying cabinet supplier corrections
    const { data: aliases } = await db.from("supplier_aliases").select("detected_name, display_name").eq("dossier_id", dossierId);
    const aliasMap = new Map((aliases ?? []).map((a) => [a.detected_name, a.display_name]));
    const { data: existing } = await db
      .from("transactions")
      .select("id, pennylane_id, is_open, review_state, status")
      .eq("dossier_id", dossierId);
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
          review_state: "pending",
          direction: Number(t.amount) < 0 ? "out" : "in",
          counterpart_accounts: (counterparts.get(String(t.id)) ?? []).join(", ") || null,
        };
      });
    if (inserts.length) {
      const { error } = await db.from("transactions").insert(inserts);
      if (error) throw error;
    }
    const reopen = (existing ?? []).filter((e) => !e.is_open && neededIds.has(e.pennylane_id)).map((e) => e.id);
    if (reopen.length) await db.from("transactions").update({ is_open: true }).in("id", reopen);
    // Excluded only by the account filter (still unlettered): keep payments already sent with a client answer.
    const close = (existing ?? [])
      .filter((e) => e.is_open && !neededIds.has(e.pennylane_id))
      .filter((e) => !(unletteredElsewhere.has(e.pennylane_id) && e.review_state === "sent" && e.status !== "a_faire"))
      .map((e) => e.id);
    if (close.length) await db.from("transactions").update({ is_open: false }).in("id", close);
    const skipped = await applySkipRules(dossierId);

    await db
      .from("dossiers")
      .update({ last_sync_at: new Date().toISOString(), last_sync_error: null, last_sync_source: source, last_mcp_error: mcpError })
      .eq("id", dossierId);
    return { added: inserts.length, closed: close.length, open: needed.length, skipped, source };
  } catch (e) {
    const msg = (e as Error).message;
    await db.from("dossiers").update({ last_sync_error: msg }).eq("id", dossierId);
    throw new Error(msg);
  }
}

// Lot 3: open lines awaiting review that match a "ne plus demander" rule are set aside.
// Lines already sent to the client are left alone, and so are lines the cabinet
// reactivated after a rule dismissed them (skip_rule_id still set).
export async function applySkipRules(dossierId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: rules, error: rErr } = await db.from("skip_rules").select("id, kind, pattern, direction").eq("dossier_id", dossierId);
  if (rErr) {
    // Rules table not migrated yet: the sync must keep working without rules.
    console.error("Skip rules unavailable", rErr.message);
    return 0;
  }
  if (!rules?.length) return 0;
  const { data: pending, error: tErr } = await db
    .from("transactions")
    .select("id, label, supplier, supplier_detected, direction")
    .eq("dossier_id", dossierId)
    .eq("is_open", true)
    .eq("review_state", "pending")
    .is("skip_rule_id", null);
  if (tErr) throw tErr;
  const byRule = new Map<string, string[]>();
  for (const t of pending ?? []) {
    const r = findRule(rules as SkipRule[], { ...t, direction: t.direction === "in" ? "in" : "out" });
    if (r) byRule.set(r.id, [...(byRule.get(r.id) ?? []), t.id]);
  }
  let count = 0;
  for (const [ruleId, ids] of byRule) {
    const { error } = await db.from("transactions").update({ review_state: "dismissed", skip_rule_id: ruleId }).in("id", ids);
    if (error) throw error;
    count += ids.length;
  }
  return count;
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
