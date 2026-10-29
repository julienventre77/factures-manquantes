// Server-only: sends a validated saisie to Pennylane through the MCP, as a supplier invoice with its PDF.
// Hackathon demo dossiers only (priority rule, also enforced by mcpCallAllowed on every call).
// Steps, as tested on the demo dossier on 29/10/2026: upload the PDF (storage slot, PUT of the file, completion),
// create the supplier invoice from it, wait for Pennylane's reading, then replace the lines it read by the
// validated ones (account, VAT, amounts, line label).
import { createHash } from "node:crypto";
import { isDemoCompany } from "./demo-dossiers";
import { openMcp } from "./mcp.server";
import { blocagesEnvoi, choisirPlanItem, clePlanItem, codeTva, corpsMiseAJour, type PlanItem } from "./pennylane-import";
import type { Facture } from "./ventilation";

export const ENVOI_DEMO_ONLY_MSG = "L'envoi vers Pennylane est réservé aux dossiers démo du hackathon.";
const PAS_DE_DROIT_MSG = "La connexion Pennylane (MCP) de PBC List n'a pas encore le droit d'utiliser les opérations : reconnectez Pennylane depuis l'écran de connexion, puis réessayez.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Facture_PL = { id: number; is_waiting_for_ocr: boolean; invoice_lines: { id: number }[] };

export async function envoyerFacture(opts: {
  companyId: string;
  facture: Facture;
  pdf: Blob;
  fileName: string;
  // Called as soon as the invoice exists in Pennylane, so a later failure never leads to a second invoice.
  onCreated: (invoiceId: string) => Promise<void>;
}) {
  const { companyId, facture: f } = opts;
  if (!isDemoCompany(companyId)) throw new Error(ENVOI_DEMO_ONLY_MSG);
  // Every check is done before the first write.
  const avant = blocagesEnvoi(f);
  if (avant.length) throw new Error(avant.join(" "));

  const s = await openMcp();
  const run = <T>(operation_id: string, intent: string, extra: Record<string, unknown> = {}, path: Record<string, unknown> = {}) =>
    s.call<T>("run_operations", { operation_id, path_params: { company_id: Number(companyId), ...path }, ...extra }, intent);
  try {
    // 1. Pennylane account of each line, for its VAT rate.
    const numeros = [...new Set(f.lignes.map((l) => l.compte))];
    const items: PlanItem[] = [];
    for (let page = 1; page <= 10; page++) {
      // First call to the operations: a connection without the operations scope fails here, before any write.
      const r = await run<{ plan_items: PlanItem[]; pagination?: { hasNextPage?: boolean } }>(
        "getListCompanyPlanItems", "Looking up the company's expense accounts used by a supplier invoice before importing it.",
        { query_params: { page, per_page: 100, filter: JSON.stringify([{ field: "number", operator: "in", value: numeros }]) } },
      ).catch((e: Error) => {
        console.error("pennylane-import operations", e.message);
        throw new Error(PAS_DE_DROIT_MSG);
      });
      items.push(...(r.plan_items ?? []));
      if (!r.pagination?.hasNextPage) break;
    }
    const planItems = new Map<string, number>();
    for (const l of f.lignes) {
      const code = codeTva(l.tauxTva)!;
      const id = choisirPlanItem(items, l.compte, code);
      if (id) planItems.set(clePlanItem(l.compte, code), id);
    }
    const blocages = blocagesEnvoi(f, planItems);
    if (blocages.length) throw new Error(blocages.join(" "));

    // 2. PDF upload: storage slot, file sent to the storage address, completion.
    const bytes = new Uint8Array(await opts.pdf.arrayBuffer());
    const checksum = createHash("md5").update(bytes).digest("base64");
    const slot = await run<{ signed_id: string; upload_id: string }>(
      "postCreateMultipartUploadCompanyDirectUploadsMultipartUploads", "Uploading a validated supplier invoice PDF to the company.",
      { request_body: { filename: opts.fileName, byte_size: bytes.length, checksum, content_type: "application/pdf", service_name: "amazon" } },
    );
    const { presigned_urls } = await run<{ presigned_urls: { part_number: number; presigned_url: string }[] }>(
      "postGeneratePresignedUrlsCompanyDirectUploadsMultipartUploads", "Uploading a validated supplier invoice PDF to the company.",
      { request_body: { signed_id: slot.signed_id, upload_id: slot.upload_id, number_of_parts: 1 } },
    );
    const put = await fetch(presigned_urls[0]!.presigned_url, { method: "PUT", body: bytes });
    const etag = put.headers.get("etag");
    if (!put.ok || !etag) throw new Error("Le dépôt du PDF dans Pennylane a échoué. Réessayez plus tard.");
    await run("postCompleteMultipartUploadCompanyDirectUploadsMultipartUploads", "Uploading a validated supplier invoice PDF to the company.",
      { request_body: { signed_id: slot.signed_id, upload_id: slot.upload_id, uploaded_parts: [{ etag, part_number: 1 }] } });

    // 3. Supplier invoice created from the PDF.
    const { invoices } = await run<{ invoices: { id: number }[] }>(
      "postBatchCreateCompanySupplierInvoices", "Creating a supplier invoice from a validated PDF in the company.",
      { request_body: { upload: { signed_ids: [slot.signed_id] } } },
    );
    const invoiceId = String(invoices[0]!.id);
    await opts.onCreated(invoiceId);

    // 4. Pennylane reads the PDF first; its lines are replaced only once that reading is over.
    let inv: Facture_PL | null = null;
    for (let essai = 0; essai < 8; essai++) {
      inv = await run<Facture_PL>("getCompanySupplierInvoice", "Checking that the new supplier invoice has been read before setting its lines.", {}, { id: Number(invoiceId) });
      if (!inv.is_waiting_for_ocr) break;
      await sleep(3000);
    }
    if (!inv || inv.is_waiting_for_ocr)
      throw new Error(`Facture créée dans Pennylane avec son PDF (n° ${invoiceId}), mais Pennylane la lit encore : ses comptes n'ont pas été mis à jour.`);

    // 5. Validated lines, accounts and VAT.
    try {
      await run("putCompanyAccountantsInvoice", "Setting the validated accounts, VAT and labels of a new supplier invoice.",
        { request_body: corpsMiseAJour(f, planItems, inv.invoice_lines.map((l) => l.id)) }, { id: Number(invoiceId) });
    } catch (e) {
      console.error("pennylane-import update", (e as Error).message);
      throw new Error(`Facture créée dans Pennylane avec son PDF (n° ${invoiceId}), mais ses lignes n'ont pas pu être mises à jour.`);
    }
    return { invoiceId };
  } finally {
    await s.close();
  }
}
