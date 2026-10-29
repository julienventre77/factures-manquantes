// Server-only: sends a validated saisie to Pennylane as a supplier invoice with its PDF (API v2).
// Hackathon demo dossiers only (same list as the MCP guard). The token is a separate secret with the
// write scopes supplier_invoices:all and file_attachments:all, so the sync token stays read-only.
import { isDemoCompany } from "./demo-dossiers";
import { blocagesEnvoi, corpsImport } from "./pennylane-import";
import { BASE, plAll } from "./sync.server";
import type { Facture } from "./ventilation";

export const ENVOI_DEMO_ONLY_MSG = "L'envoi vers Pennylane est réservé aux dossiers démo du hackathon.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type PlAccount = { id: number; number: string };
type PlSupplier = { id: number; name: string };

async function post(path: string, companyId: string, token: string, body: BodyInit, json: boolean) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "X-Company-Id": companyId, Accept: "application/json" };
  if (json) headers["Content-Type"] = "application/json";
  return fetch(`${BASE}${path}`, { method: "POST", headers, body });
}

async function erreur(res: Response, quoi: string) {
  const text = await res.text();
  console.error("pennylane-import", quoi, res.status, text.slice(0, 500));
  if (res.status === 401 || res.status === 403) return new Error(`Pennylane refuse ${quoi} : le jeton d'écriture n'a pas les droits nécessaires.`);
  if (res.status === 422) return new Error(`Pennylane refuse ${quoi} (facture déjà importée, ou montants incohérents).`);
  return new Error(`Erreur Pennylane pendant ${quoi} (${res.status}).`);
}

// Ledger account id of each account number used by the entry, in this Pennylane company.
async function comptesDuDossier(numeros: string[], companyId: string, token: string) {
  const out = new Map<string, number>();
  for (const n of new Set(numeros)) {
    const items = await plAll<PlAccount>("/ledger_accounts", [{ field: "number", operator: "start_with", value: n }], companyId, token);
    const exact = items.find((a) => a.number === n);
    if (exact) out.set(n, exact.id);
  }
  return out;
}

// The supplier of the invoice in Pennylane, by name. Never created here: an unknown supplier stops the sending.
async function fournisseur(nom: string, companyId: string, token: string) {
  const debut = nom.trim().slice(0, 30);
  const items = await plAll<PlSupplier>("/suppliers", [{ field: "name", operator: "start_with", value: debut }], companyId, token);
  const exacts = items.filter((s) => norm(s.name) === norm(nom));
  const choix = exacts.length === 1 ? exacts[0] : exacts.length === 0 && items.length === 1 ? items[0] : null;
  if (!choix) throw new Error(items.length
    ? `Plusieurs fournisseurs « ${debut} » dans Pennylane : précisez le nom du fournisseur sur la saisie.`
    : `Fournisseur « ${nom} » introuvable dans Pennylane : créez-le d'abord dans le dossier.`);
  return choix.id;
}

export async function envoyerFacture(opts: { companyId: string; facture: Facture; pdf: Blob; fileName: string; reference: string }) {
  const { companyId, facture: f } = opts;
  if (!isDemoCompany(companyId)) throw new Error(ENVOI_DEMO_ONLY_MSG);
  const token = process.env["PENNYLANE_API_TOKEN_ECRITURE"];
  if (!token) throw new Error("Envoi vers Pennylane non configuré : le jeton PENNYLANE_API_TOKEN_ECRITURE manque.");

  // Every check is done before the first write.
  const avant = blocagesEnvoi(f);
  if (avant.length) throw new Error(avant.join(" "));
  const comptes = await comptesDuDossier(f.lignes.map((l) => l.compte), companyId, token);
  const blocages = blocagesEnvoi(f, new Set(comptes.keys()));
  if (blocages.length) throw new Error(blocages.join(" "));
  const supplierId = await fournisseur(f.fournisseur, companyId, token);

  const form = new FormData();
  form.append("file", opts.pdf, opts.fileName);
  const up = await post("/file_attachments", companyId, token, form, false);
  if (!up.ok) throw await erreur(up, "le dépôt du PDF");
  const { id: fileAttachmentId } = (await up.json()) as { id: number };

  const body = JSON.stringify(corpsImport(f, { fileAttachmentId, supplierId, comptes }, opts.reference));
  // 409: the uploaded file is not ready yet, the documentation says to retry after a few seconds.
  for (let essai = 0; essai < 4; essai++) {
    const res = await post("/supplier_invoices/import", companyId, token, body, true);
    if (res.status === 409) {
      await sleep(2000 * (essai + 1));
      continue;
    }
    if (!res.ok) throw await erreur(res, "l'import de la facture");
    const inv = (await res.json()) as { id: number };
    return { invoiceId: String(inv.id) };
  }
  throw new Error("Pennylane n'a pas fini de traiter le PDF : réessayez dans une minute.");
}
