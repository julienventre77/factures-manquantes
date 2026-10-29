// Priority rule (Julien, 29/10/2026): the Pennylane MCP is used ONLY on the hackathon demo companies.
// Any other dossier is synced through the API and never reaches the MCP. Only Julien extends this list.
export const DEMO_COMPANY_IDS: readonly string[] = [
  "276211", // Dossier Demo Hackathon - Comptabilité Augmentée
];

export const MCP_DEMO_ONLY_MSG = "Le MCP Pennylane est réservé aux dossiers démo du hackathon : ce dossier passe par l'API.";

export function isDemoCompany(companyId: string | number | null | undefined) {
  return companyId !== null && companyId !== undefined && DEMO_COMPANY_IDS.includes(String(companyId).trim());
}

// MCP tools allowed without a company_id: they read the connected account or the operation catalog,
// not a company's books.
const ACCOUNT_TOOLS = new Set(["get_context", "list_companies", "search_operations"]);

// Checked on every MCP call: a tool that targets a company must target a demo one. run_operations carries the
// company in its path parameters; an operation without a company is refused.
export function mcpCallAllowed(tool: string, args: Record<string, unknown>) {
  if (tool === "run_operations") {
    const path = args["path_params"] as Record<string, unknown> | undefined;
    return !!path && "company_id" in path && isDemoCompany(path["company_id"] as string | number);
  }
  if ("company_id" in args) return isDemoCompany(args["company_id"] as string | number);
  return ACCOUNT_TOOLS.has(tool);
}
