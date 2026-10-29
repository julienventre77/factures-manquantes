import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ANALYSIS_MODEL, DEFAULT_MONTHLY_CAP_USD, MAX_LINES_PER_RUN, OUTPUT_SCHEMA, SYSTEM,
  buildPrompt, costUsd, dismissable, estimateCost, monthStart, parseSuggestions,
  type AnalysisLine, type SuggestionKind,
} from "@/lib/analysis";

const LINE_COLUMNS = "id, date, amount, label, supplier, supplier_detected, direction, counterpart_accounts, review_state, ai_analyzed_at";
type Row = AnalysisLine & { ai_analyzed_at: string | null };

async function requireCabinetRole(db: any, userId: string) {
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: { role: string }) => r.role === "cabinet")) throw new Error("Analyse réservée au cabinet.");
}

// PostgREST returns at most 1000 rows per call: page through the open lines of the dossier.
async function openLines(db: any, dossierId: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("transactions").select(LINE_COLUMNS)
      .eq("dossier_id", dossierId).eq("is_open", true).order("date", { ascending: true }).range(from, from + 999);
    if (error) throw new Error("Lecture des lignes impossible.");
    all.push(...(data ?? []));
    if (!data || data.length < 1000) return all;
  }
}

async function budget(db: any) {
  const [{ data: s }, { data: runs }] = await Promise.all([
    db.from("ai_settings").select("monthly_cap_usd").eq("id", 1).maybeSingle(),
    db.from("ai_analysis_runs").select("cost_usd").gte("created_at", monthStart()),
  ]);
  const cap = s ? Number(s.monthly_cap_usd) : DEFAULT_MONTHLY_CAP_USD;
  const spent = (runs ?? []).reduce((sum: number, r: { cost_usd: number }) => sum + Number(r.cost_usd), 0);
  return { cap, spent };
}

// Everything the analysis needs: new lines (never analysed, still to review), reference lines and known suppliers.
async function prepare(db: any, dossierId: string) {
  const lines = await openLines(db, dossierId);
  const pending = lines.filter((t) => !t.ai_analyzed_at && t.review_state === "pending");
  const fresh = pending.slice(0, MAX_LINES_PER_RUN);
  const freshIds = new Set(fresh.map((t) => t.id));
  const older = lines.filter((t) => !freshIds.has(t.id));
  const known = [...new Set(lines.map((t) => t.supplier))].sort((a, b) => a.localeCompare(b, "fr")).slice(0, 400);
  return { fresh, waiting: pending.length - fresh.length, prompt: buildPrompt(fresh, older, known) };
}

async function client() {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("L'analyse n'est pas encore configurée : la clé ANTHROPIC_API_KEY manque.");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey, maxRetries: 1 });
}

const request = (text: string) => ({
  model: ANALYSIS_MODEL,
  system: SYSTEM,
  messages: [{ role: "user" as const, content: text }],
  output_config: { effort: "low" as const, format: { type: "json_schema" as const, schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
});

const DossierInput = z.object({ dossierId: z.string().uuid() });

// State shown in the panel: open suggestions with their lines, budget of the month, last runs.
export const getAnalysisState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DossierInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const [lines, { data: sugg }, { data: runs }, b] = await Promise.all([
      openLines(db, data.dossierId),
      db.from("ai_suggestions").select("id, kind, transaction_ids, target_supplier, reason, created_at")
        .eq("dossier_id", data.dossierId).eq("state", "open").order("created_at", { ascending: true }),
      db.from("ai_analysis_runs").select("id, created_at, lines_analyzed, cost_usd")
        .eq("dossier_id", data.dossierId).eq("kind", "analyse").order("created_at", { ascending: false }).limit(5),
      budget(db),
    ]);
    const byId = new Map(lines.map((t) => [t.id, t]));
    type View = { id: string; kind: SuggestionKind; target_supplier: string | null; reason: string; lines: AnalysisLine[] };
    const suggestions: View[] = (sugg ?? []).map((s: any): View => ({
      id: s.id as string,
      kind: s.kind as SuggestionKind,
      target_supplier: s.target_supplier as string | null,
      reason: s.reason as string,
      // Lines closed by a later sync (now justified) drop out of the suggestion.
      lines: (s.transaction_ids as string[]).map((id) => byId.get(id)).filter((t): t is Row => !!t)
        .map(({ ai_analyzed_at: _a, ...t }) => t),
    })).filter((s: View) => s.lines.length > 0);
    return {
      newLines: lines.filter((t) => !t.ai_analyzed_at && t.review_state === "pending").length,
      suggestions,
      runs: ((runs ?? []) as any[]).map((r): { id: string; created_at: string; lines: number; cost: number } => ({ id: r.id as string, created_at: r.created_at as string, lines: r.lines_analyzed as number, cost: Number(r.cost_usd) })),
      ...b,
    };
  });

// Cost estimate before running: exact input tokens (token counting is free), output guessed as a range.
export const estimateAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DossierInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const { fresh, waiting, prompt } = await prepare(db, data.dossierId);
    const b = await budget(db);
    if (fresh.length === 0) return { lines: 0, waiting, low: 0, high: 0, ...b };
    let inputTokens: number;
    try {
      const c = await client();
      inputTokens = (await c.messages.countTokens(request(prompt.text) as any)).input_tokens;
    } catch (err: any) {
      if (err instanceof Error && err.message.includes("ANTHROPIC_API_KEY")) throw err;
      console.error("analysis-count-tokens", err?.status, err?.message);
      // Rough fallback: about 3.5 characters per token for French bank labels.
      inputTokens = Math.ceil((SYSTEM.length + prompt.text.length) / 3.5);
    }
    return { lines: fresh.length, waiting, ...estimateCost(inputTokens, fresh.length), ...b };
  });

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dossierId: z.string().uuid(), maxCostUsd: z.number().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const { fresh, prompt } = await prepare(db, data.dossierId);
    if (fresh.length === 0) return { lines: 0, suggestions: 0, cost: 0 };

    // The high estimate shown to the user must fit in what is left of the monthly cap.
    // The client sends the high estimate it showed; the server never accepts less than its own rough one.
    const rough = estimateCost(Math.ceil((SYSTEM.length + prompt.text.length) / 3.5), fresh.length).high;
    const { cap, spent } = await budget(db);
    if (spent + Math.max(data.maxCostUsd, rough) > cap)
      throw new Error(`Plafond mensuel atteint : ${spent.toFixed(2)} $ dépensés sur ${cap.toFixed(2)} $. Vous pouvez relever le plafond dans le panneau.`);

    const c = await client();
    let final: any;
    try {
      final = await c.messages.stream({ ...request(prompt.text), max_tokens: 32000 } as any).finalMessage();
    } catch (err: any) {
      console.error("analysis-run", err?.status, err?.message);
      throw new Error("Claude est momentanément indisponible. Réessayez plus tard.");
    }
    const cost = costUsd(final.usage);
    const { data: run, error: e1 } = await db.from("ai_analysis_runs").insert({
      dossier_id: data.dossierId, user_id: context.userId, model: ANALYSIS_MODEL, lines_analyzed: fresh.length,
      input_tokens: final.usage.input_tokens, output_tokens: final.usage.output_tokens, cost_usd: Number(cost.toFixed(4)),
    }).select("id").single();
    if (e1) throw new Error("Impossible d'enregistrer l'analyse.");

    if (final.stop_reason === "refusal") throw new Error("Claude n'a pas pu analyser ces lignes.");
    if (final.stop_reason === "max_tokens") throw new Error("Réponse de Claude incomplète : réessayez, les lignes seront analysées à nouveau.");
    const text = final.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const suggestions = parseSuggestions(text, prompt.refs);

    if (suggestions.length) {
      const { error: e2 } = await db.from("ai_suggestions").insert(
        suggestions.map((s) => ({ ...s, run_id: run.id, dossier_id: data.dossierId })),
      );
      if (e2) throw new Error("Impossible d'enregistrer les suggestions.");
    }
    // Only now are the lines marked as analysed: a failed call leaves them for the next run.
    const now = new Date().toISOString();
    const ids = fresh.map((t) => t.id);
    for (let i = 0; i < ids.length; i += 200)
      await db.from("transactions").update({ ai_analyzed_at: now }).in("id", ids.slice(i, i + 200));
    return { lines: fresh.length, suggestions: suggestions.length, cost };
  });

export const decideSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    apply: z.boolean(),
    transactionIds: z.array(z.string().uuid()).max(MAX_LINES_PER_RUN * 2),
    targetSupplier: z.string().trim().max(120).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const { data: s } = await db.from("ai_suggestions").select("id, dossier_id, kind, transaction_ids, state").eq("id", data.id).maybeSingle();
    if (!s) throw new Error("Suggestion introuvable.");
    if (s.state !== "open") throw new Error("Suggestion déjà traitée.");
    let changed = 0;
    if (data.apply) {
      // Only lines that belong to the suggestion can be touched.
      const allowed = new Set<string>(s.transaction_ids);
      const ids = data.transactionIds.filter((id) => allowed.has(id));
      if (ids.length === 0) throw new Error("Cochez au moins une ligne.");
      const { data: lines } = await db.from("transactions").select("id, supplier_detected, review_state")
        .eq("dossier_id", s.dossier_id).in("id", ids);
      if (s.kind === "group") {
        const name = data.targetSupplier?.trim();
        if (!name) throw new Error("Indiquez le nom du tiers à retenir.");
        // Same mechanism as a manual rename: an alias per detected name, reapplied by every sync.
        const detected = [...new Set<string>((lines ?? []).map((t: { supplier_detected: string }) => t.supplier_detected))];
        const { error: ea } = await db.from("supplier_aliases").upsert(
          detected.map((d) => ({ dossier_id: s.dossier_id, detected_name: d, display_name: name })),
          { onConflict: "dossier_id,detected_name" },
        );
        if (ea) throw new Error("Regroupement impossible.");
        const { error: et, count } = await db.from("transactions").update({ supplier: name }, { count: "exact" })
          .eq("dossier_id", s.dossier_id).in("supplier_detected", detected);
        if (et) throw new Error("Regroupement impossible.");
        changed = count ?? 0;
      } else {
        const toDismiss = dismissable(lines ?? [], ids);
        if (toDismiss.length) {
          const { error: ed } = await db.from("transactions").update({ review_state: "dismissed" }).in("id", toDismiss);
          if (ed) throw new Error("Mise à jour impossible.");
        }
        changed = toDismiss.length;
      }
    }
    await db.from("ai_suggestions").update({ state: data.apply ? "applied" : "rejected", decided_by: context.userId, decided_at: new Date().toISOString() }).eq("id", data.id);
    return { changed };
  });

export const setMonthlyCap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cap: z.number().min(0).max(250) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const { error } = await db.from("ai_settings").update({ monthly_cap_usd: data.cap, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error("Plafond non enregistré.");
    return { cap: data.cap };
  });
