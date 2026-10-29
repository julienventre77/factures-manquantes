import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ANALYSIS_MODEL, DEFAULT_MONTHLY_CAP_USD, costUsd, monthStart } from "@/lib/analysis";
import {
  LigneSaisie, MAX_FICHIER_OCTETS, OUTPUT_SCHEMA_LECTURE, RESERVE_LECTURE_USD, SYSTEM_LECTURE,
  parseLecture, proposer, reglesAEnregistrer, typeMedia, type RegleFournisseur, type SaisieState,
} from "@/lib/saisie";
import { controle, type Facture, type Ligne } from "@/lib/ventilation";
import { isDemoCompany } from "@/lib/demo-dossiers";

// Saisie augmentée (lot C): Claude reads an invoice uploaded by the client, the firm validates the split.
// A validated entry feeds the supplier memory; on a hackathon demo dossier the firm can then send it to
// Pennylane as a supplier invoice with its PDF (envoyerPennylane, one click per invoice).

const UNAVAILABLE = "Saisie augmentée indisponible : la base de données n'est pas encore à jour.";
const SAISIE_COLUMNS =
  "id, upload_id, transaction_id, tiers, fournisseur, numero, date_facture, total_ht, total_tva, total_ttc, libelle_ecriture, lignes, state, cost_usd, lu_le, decided_at, pennylane_invoice_id, envoye_le";

async function requireCabinetRole(db: any, userId: string) {
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: { role: string }) => r.role === "cabinet")) throw new Error("Saisie réservée au cabinet.");
}

// The uploaded file and the bank payment it justifies.
async function loadUpload(db: any, uploadId: string) {
  const { data: u } = await db.from("uploads").select("id, dossier_id, transaction_id, storage_path, file_name").eq("id", uploadId).maybeSingle();
  if (!u) throw new Error("Pièce introuvable.");
  const { data: t } = await db.from("transactions").select("id, date, amount, supplier, direction").eq("id", u.transaction_id).maybeSingle();
  if (!t) throw new Error("Paiement introuvable.");
  return { upload: u, tx: t };
}

// Same monthly cap as the dossier analysis: every Claude call of the app is logged in ai_analysis_runs.
async function budget(db: any) {
  const [{ data: s }, { data: runs }] = await Promise.all([
    db.from("ai_settings").select("monthly_cap_usd").eq("id", 1).maybeSingle(),
    db.from("ai_analysis_runs").select("cost_usd").gte("created_at", monthStart()),
  ]);
  const cap = s ? Number(s.monthly_cap_usd) : DEFAULT_MONTHLY_CAP_USD;
  const spent = (runs ?? []).reduce((sum: number, r: { cost_usd: number }) => sum + Number(r.cost_usd), 0);
  return { cap, spent };
}

export type SaisieView = {
  id: string; state: SaisieState; fournisseur: string; numero: string; date: string | null;
  totalHt: number; totalTva: number; totalTtc: number; libelleEcriture: string; lignes: Ligne[];
  cost: number; luLe: string; decidedAt: string | null;
  pennylaneInvoiceId: string | null; envoyeLe: string | null;
};

const toView = (s: any): SaisieView | null => s && {
  id: s.id as string,
  state: s.state as SaisieState,
  fournisseur: s.fournisseur as string,
  numero: (s.numero ?? "") as string,
  date: (s.date_facture ?? null) as string | null,
  totalHt: Number(s.total_ht),
  totalTva: Number(s.total_tva),
  totalTtc: Number(s.total_ttc),
  libelleEcriture: (s.libelle_ecriture ?? "") as string,
  lignes: (s.lignes ?? []) as Ligne[],
  cost: Number(s.cost_usd),
  luLe: s.lu_le as string,
  decidedAt: (s.decided_at ?? null) as string | null,
  pennylaneInvoiceId: (s.pennylane_invoice_id ?? null) as string | null,
  envoyeLe: (s.envoye_le ?? null) as string | null,
};

const UploadInput = z.object({ uploadId: z.string().uuid() });

export const getSaisie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UploadInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const { upload, tx } = await loadUpload(db, data.uploadId);
    const { data: s, error } = await db.from("saisies").select(SAISIE_COLUMNS).eq("upload_id", data.uploadId).maybeSingle();
    if (error) throw new Error(UNAVAILABLE);
    const { data: d } = await db.from("dossiers").select("company_id").eq("id", upload.dossier_id).maybeSingle();
    return {
      // Sending to Pennylane is offered on hackathon demo dossiers only, and only for a PDF.
      envoiPossible: isDemoCompany(String(d?.company_id ?? "")) && typeMedia(upload.file_name) === "application/pdf",
      fileName: upload.file_name as string,
      lisible: typeMedia(upload.file_name) !== null,
      paiement: { date: tx.date as string, montant: Number(tx.amount), tiers: tx.supplier as string, achat: tx.direction === "out" },
      saisie: toView(s),
      ...(await budget(db)),
    };
  });

export const lireFacture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UploadInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const { upload, tx } = await loadUpload(db, data.uploadId);
    if (tx.direction !== "out") throw new Error("La saisie augmentée ne traite que les factures d'achat.");
    const { data: prev, error: e0 } = await db.from("saisies").select("id, state, cost_usd").eq("upload_id", upload.id).maybeSingle();
    if (e0) throw new Error(UNAVAILABLE);
    if (prev?.state === "validee") throw new Error("Cette saisie est déjà validée.");
    const media = typeMedia(upload.file_name);
    if (!media) throw new Error("Seuls les PDF et les images (PNG, JPEG, WebP, GIF) peuvent être lus.");

    const { cap, spent } = await budget(db);
    if (spent + RESERVE_LECTURE_USD > cap)
      throw new Error(`Plafond mensuel Claude atteint : ${spent.toFixed(2)} $ dépensés sur ${cap.toFixed(2)} $. Vous pouvez le relever dans le panneau « Analyser avec Claude ».`);

    const { data: blob, error: e1 } = await db.storage.from("factures").download(upload.storage_path);
    if (e1 || !blob) throw new Error("Pièce illisible dans le stockage.");
    if (blob.size > MAX_FICHIER_OCTETS) throw new Error("Pièce trop lourde (plus de 10 Mo) pour être lue.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const source = { type: "base64" as const, media_type: media, data: btoa(bin) };
    const piece = media === "application/pdf" ? { type: "document" as const, source } : { type: "image" as const, source };

    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) throw new Error("La saisie augmentée n'est pas encore configurée : la clé ANTHROPIC_API_KEY manque.");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey, maxRetries: 1 });
    let final: any;
    try {
      final = await client.messages.stream({
        model: ANALYSIS_MODEL,
        max_tokens: 16000,
        system: SYSTEM_LECTURE,
        messages: [{ role: "user", content: [piece, { type: "text", text: "Lis cette facture." }] }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA_LECTURE as unknown as Record<string, unknown> } },
      } as any).finalMessage();
    } catch (err: any) {
      console.error("saisie-lecture", err?.status, err?.message);
      throw new Error("Claude est momentanément indisponible. Réessayez plus tard.");
    }
    const cost = costUsd(final.usage);
    // Logged with the analyses so the monthly cap covers both.
    await db.from("ai_analysis_runs").insert({
      dossier_id: upload.dossier_id, user_id: context.userId, model: ANALYSIS_MODEL, kind: "saisie", lines_analyzed: 0,
      input_tokens: final.usage.input_tokens, output_tokens: final.usage.output_tokens, cost_usd: Number(cost.toFixed(4)),
    });

    const text = final.stop_reason === "end_turn" ? final.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("") : "";
    const lecture = parseLecture(text);
    const base = {
      dossier_id: upload.dossier_id, upload_id: upload.id, transaction_id: tx.id, tiers: tx.supplier,
      model: ANALYSIS_MODEL, cost_usd: Number((Number(prev?.cost_usd ?? 0) + cost).toFixed(4)),
      lu_par: context.userId, lu_le: new Date().toISOString(), decided_by: null, decided_at: null,
    };
    if (!lecture) {
      await db.from("saisies").upsert({ ...base, state: "echec", fournisseur: tx.supplier, lignes: [], lecture: null }, { onConflict: "upload_id" });
      throw new Error(final.stop_reason === "max_tokens"
        ? "Facture trop longue : la lecture a été interrompue."
        : "Claude n'a pas reconnu de facture lisible dans cette pièce.");
    }
    const { data: regles } = await db.from("regles_fournisseur").select("cle, compte, compte_libelle")
      .eq("dossier_id", upload.dossier_id).eq("tiers", tx.supplier);
    const f = proposer(lecture, { regles: (regles ?? []) as RegleFournisseur[], dateRepli: tx.date, fournisseur: tx.supplier });
    const { error: e2 } = await db.from("saisies").upsert({
      ...base, state: "proposee", fournisseur: f.fournisseur, numero: f.numero || null, date_facture: f.date,
      total_ht: f.totalHt, total_tva: f.totalTva, total_ttc: f.totalTtc, libelle_ecriture: f.libelleEcriture,
      lignes: f.lignes, lecture,
    }, { onConflict: "upload_id" });
    if (e2) throw new Error("Impossible d'enregistrer la proposition.");
    return { cost, lignes: f.lignes.length };
  });

export const validerSaisie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    libelleEcriture: z.string().trim().min(1, "Libellé d'écriture manquant.").max(200),
    lignes: z.array(LigneSaisie).min(1, "Ajoutez au moins une ligne.").max(200),
    forcer: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const { data: s, error } = await db.from("saisies").select(SAISIE_COLUMNS + ", dossier_id").eq("id", data.id).maybeSingle();
    if (error) throw new Error(UNAVAILABLE);
    if (!s) throw new Error("Saisie introuvable.");
    if (s.state !== "proposee") throw new Error("Cette proposition a déjà été traitée.");
    const lignes = data.lignes as Ligne[];
    const f: Facture = {
      id: s.id, numero: s.numero ?? "", fournisseur: s.fournisseur, date: s.date_facture,
      totalHt: Number(s.total_ht), totalTva: Number(s.total_tva), totalTtc: Number(s.total_ttc),
      libelleGenerique: "", libelleEcriture: data.libelleEcriture, lignes,
    };
    if (!controle(f).ok && !data.forcer) throw new Error("Les totaux ne retombent pas sur le pied de facture : corrigez les lignes ou cochez « Valider malgré l'écart ».");
    const { error: e1 } = await db.from("saisies").update({
      state: "validee", lignes, libelle_ecriture: data.libelleEcriture, decided_by: context.userId, decided_at: new Date().toISOString(),
    }).eq("id", s.id).eq("state", "proposee");
    if (e1) throw new Error("Validation impossible.");
    // The supplier memory follows the firm's choice: the next invoice of this tiers gets the same accounts.
    const regles = reglesAEnregistrer(lignes);
    if (regles.length) {
      const now = new Date().toISOString();
      const { error: e2 } = await db.from("regles_fournisseur").upsert(
        regles.map((r) => ({ ...r, dossier_id: s.dossier_id, tiers: s.tiers, updated_at: now })),
        { onConflict: "dossier_id,tiers,cle" },
      );
      if (e2) throw new Error("Saisie validée, mais la mémoire du fournisseur n'a pas été mise à jour.");
    }
    return { regles: regles.length };
  });

export const rejeterSaisie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const { error } = await db.from("saisies").update({ state: "rejetee", decided_by: context.userId, decided_at: new Date().toISOString() })
      .eq("id", data.id).eq("state", "proposee");
    if (error) throw new Error("Rejet impossible.");
    return { ok: true };
  });

export const envoyerPennylane = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await requireCabinetRole(db, context.userId);
    const { data: s, error } = await db.from("saisies").select(SAISIE_COLUMNS + ", dossier_id").eq("id", data.id).maybeSingle();
    if (error) throw new Error(UNAVAILABLE);
    if (!s) throw new Error("Saisie introuvable.");
    if (s.state !== "validee") throw new Error("Validez d'abord la saisie.");
    if (s.pennylane_invoice_id) throw new Error("Cette facture est déjà dans Pennylane.");
    const { upload } = await loadUpload(db, s.upload_id);
    if (typeMedia(upload.file_name) !== "application/pdf") throw new Error("Pennylane n'importe que les factures en PDF.");
    const { data: d } = await db.from("dossiers").select("company_id").eq("id", s.dossier_id).maybeSingle();
    const { data: blob, error: e1 } = await db.storage.from("factures").download(upload.storage_path);
    if (e1 || !blob) throw new Error("Pièce illisible dans le stockage.");

    const v = toView(s)!;
    const { envoyerFacture } = await import("@/lib/pennylane-import.server");
    const { invoiceId } = await envoyerFacture({
      companyId: String(d?.company_id ?? ""),
      facture: { id: v.id, numero: v.numero, fournisseur: v.fournisseur, date: v.date ?? "", totalHt: v.totalHt, totalTva: v.totalTva, totalTtc: v.totalTtc, libelleGenerique: "", libelleEcriture: v.libelleEcriture, lignes: v.lignes },
      pdf: blob, fileName: upload.file_name,
      // Noted as soon as the invoice exists, so a failure afterwards never sends it twice.
      onCreated: async (id) => {
        const { error: e2 } = await db.from("saisies").update({ pennylane_invoice_id: id, envoye_par: context.userId, envoye_le: new Date().toISOString() }).eq("id", s.id);
        if (e2) throw new Error(`Facture créée dans Pennylane (n° ${id}), mais l'appli n'a pas pu le noter : ne la renvoyez pas.`);
      },
    });
    return { invoiceId };
  });
