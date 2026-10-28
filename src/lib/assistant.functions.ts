import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DAILY_LIMIT = 30;
const ESCALATE = "[TRANSMETTRE]";

const SYSTEM = `Tu es l'assistant de l'application « PBC List » d'un cabinet comptable. Tu parles à un client du cabinet (souvent non spécialiste). Réponds en français, avec un ton simple, poli et bref, sans jargon comptable.

Ton rôle est UNIQUEMENT :
- expliquer la procédure de l'application : pour chaque virement, le client peut (1) déposer la facture (PDF, JPG ou PNG) avec « Je dépose mes factures », (2) la transférer par e-mail à l'adresse de collecte indiquée avec « Je les envoie par e-mail », ou (3) choisir « Je n'ai pas de facture » et laisser un commentaire ;
- aider à retrouver une facture : espace client en ligne du fournisseur (rubrique commandes / factures), e-mails de confirmation reçus, demande de duplicata auprès du fournisseur ou du client.

Règles strictes :
- Pour toute question de conseil comptable, fiscal ou juridique (déductibilité, TVA, régime, etc.) ou toute question hors sujet, réponds poliment que le cabinet reviendra vers le client, sans donner d'avis, puis termine ta réponse par la balise exacte ${ESCALATE}.
- N'invente jamais de règle, de chiffre, de date ou de montant. Utilise seulement les données fournies ci-dessous.
- Ne demande jamais de mot de passe ni d'identifiant de compte fournisseur.`;

async function ctxFor(supabase: any, userId: string) {
  const { data: m } = await supabase.from("dossier_members").select("dossier_id").eq("user_id", userId).limit(1).maybeSingle();
  if (!m) throw new Error("Aucun dossier rattaché à votre compte.");
  return m.dossier_id as string;
}

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("chat_messages").select("id, role, content, created_at")
      .eq("user_id", userId).order("created_at", { ascending: true }).limit(200);
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const used = (data ?? []).filter((r) => r.role === "user" && r.created_at >= since.toISOString()).length;
    return { messages: data ?? [], remaining: Math.max(0, DAILY_LIMIT - used) };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ message: z.string().trim().min(1).max(2000), groupKey: z.string().max(300).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const dossierId = await ctxFor(supabase, userId);

    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { count } = await supabase.from("chat_messages").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("role", "user").gte("created_at", since.toISOString());
    if ((count ?? 0) >= DAILY_LIMIT) throw new Error(`Limite de ${DAILY_LIMIT} messages par jour atteinte. Réessayez demain.`);

    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) throw new Error("L'assistant n'est pas encore configuré par le cabinet.");

    // Context: only this client's dossier, only payments sent to the client, no bank details.
    let context_txt = "Le client est sur l'écran d'accueil de son espace.";
    if (data.groupKey) {
      const [kind, ...rest] = data.groupKey.split(":");
      const name = rest.join(":");
      const direction = kind === "vente" ? "in" : "out";
      const { data: txs } = await supabase.from("transactions")
        .select("date, amount, label, status")
        .eq("dossier_id", dossierId).eq("review_state", "sent").eq("is_open", true)
        .eq("direction", direction).eq("supplier", name).order("date").limit(100);
      const { data: d } = await supabase.from("dossiers").select("collect_email, collect_email_customers").eq("id", dossierId).maybeSingle();
      const email = direction === "in" ? d?.collect_email_customers : d?.collect_email;
      const strip = (s: string) => s.replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{10,30}\b/g, "[masqué]").replace(/\b\d{9,}\b/g, "[masqué]");
      const lines = (txs ?? []).map((t) => `- ${t.date} | ${Number(t.amount).toFixed(2)} € | ${strip(t.label ?? "")} | statut : ${t.status}`);
      context_txt = `Le client consulte les ${direction === "in" ? "encaissements de son client" : "paiements au fournisseur"} « ${name} » (${direction === "in" ? "factures de vente" : "factures d'achat"} manquantes).
Adresse de collecte par e-mail : ${email || "non renseignée"}.
Virements concernés (statuts : a_faire = à faire, depose = déposé, email = transféré par e-mail, sans_facture = sans facture) :
${lines.join("\n") || "(aucun)"}`;
    }

    const { data: hist } = await supabase.from("chat_messages").select("role, content")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    const messages = [...(hist ?? [])].reverse().map((h) => ({ role: h.role as "user" | "assistant", content: h.content }));
    while (messages.length && messages[0]!.role !== "user") messages.shift();
    messages.push({ role: "user", content: data.message });

    const { error: e1 } = await supabase.from("chat_messages").insert({ dossier_id: dossierId, user_id: userId, role: "user", content: data.message });
    if (e1) throw new Error("Impossible d'enregistrer votre message.");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey, maxRetries: 0 });
    let text = "";
    try {
      const stream = client.messages.stream({
        model: "claude-sonnet-5-5",
        max_tokens: 2000,
        system: `${SYSTEM}\n\nContexte :\n${context_txt}`,
        messages,
        output_config: { effort: "low" },
      } as any);
      const final = await stream.finalMessage();
      if ((final as any).stop_reason === "refusal") text = `Je ne peux pas répondre à cette question. Le cabinet reviendra vers vous. ${ESCALATE}`;
      else text = final.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    } catch (err: any) {
      console.error("assistant-chat", err?.status, err?.message);
      throw new Error("L'assistant est momentanément indisponible. Réessayez plus tard.");
    }
    const escalate = text.includes(ESCALATE);
    text = text.replaceAll(ESCALATE, "").trim();
    await supabase.from("chat_messages").insert({ dossier_id: dossierId, user_id: userId, role: "assistant", content: text });
    return { reply: text, escalate };
  });

export const forwardQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().trim().min(1).max(2000), groupKey: z.string().max(300).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const dossierId = await ctxFor(supabase, userId);
    const { error } = await supabase.from("cabinet_questions").insert({
      dossier_id: dossierId, user_id: userId, user_email: (claims as any)?.email ?? null,
      question: data.question, context: data.groupKey,
    });
    if (error) throw new Error("Impossible de transmettre la question.");
    return { ok: true };
  });
