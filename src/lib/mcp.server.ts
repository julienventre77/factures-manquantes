// Server-only: Pennylane MCP OAuth (DCR + PKCE), encrypted token storage and MCP tool calls.
// Tokens never leave the server and are never logged.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker-provider.js";
import { isDemoCompany, mcpCallAllowed, MCP_DEMO_ONLY_MSG } from "./demo-dossiers";

export const MCP_URL = "https://mcp.pennylane.com/mcp";
const AUTH_BASE = "https://mcp.pennylane.com/oauth";
export const MCP_SCOPES = [
  "mcp:transaction:read",
  "mcp:ledger_entry:read",
  "mcp:ledger_entry_line:read",
  "mcp:supplier:read",
  "mcp:customer:read",
  "mcp:company:read", // get_context
  "mcp:companies:read", // list_companies (firm portfolio)
].join(" ");

// The "saisie augmentée" sends invoices through run_operations (demo dossiers only). Pennylane does not publish the
// name of the scope it needs, so it is read from the server's OAuth metadata (RFC 8414, scopes_supported): the
// scopes about operations are added to the read scopes above. Without the metadata, only the read scopes are asked.
const METADATA_URL = "https://mcp.pennylane.com/.well-known/oauth-authorization-server";
let scopesCache: string | null = null;
export async function mcpScopes(): Promise<string> {
  if (scopesCache) return scopesCache;
  try {
    const res = await fetch(METADATA_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) return MCP_SCOPES;
    const meta = (await res.json()) as { scopes_supported?: string[] };
    const base = MCP_SCOPES.split(" ");
    const operations = (meta.scopes_supported ?? []).filter((sc) => /operation/i.test(sc) && !base.includes(sc));
    scopesCache = [...base, ...operations].join(" ");
    return scopesCache;
  } catch {
    return MCP_SCOPES;
  }
}
export const MCP_REAUTH_MSG = "Nouvelle autorisation nécessaire : veuillez reconnecter Pennylane (MCP)";
export const MCP_EXPIRED_MSG = "Connexion Pennylane (MCP) expirée : veuillez reconnecter";
export const CALLBACK_PATH = "/api/public/pennylane-mcp/callback";

type Secrets = {
  client_id: string;
  client_secret?: string | undefined;
  redirect_uri: string;
  access_token?: string;
  refresh_token?: string | undefined;
  expires_at?: number; // ms
  scopes?: string; // scopes requested when this token was granted
};

const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

// ---------- AES-GCM encryption (key derived from MCP_TOKEN_ENC_KEY) ----------
async function key() {
  const raw = process.env["MCP_TOKEN_ENC_KEY"];
  if (!raw) throw new Error("Clé de chiffrement manquante.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function encrypt(obj: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(JSON.stringify(obj))));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function decrypt<T>(blob: string): Promise<T> {
  const [iv = "", ct = ""] = blob.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
const b64url = (b: Uint8Array) => b64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// ---------- Connection row ----------
async function loadSecrets(): Promise<{ secrets: Secrets | null; status: string }> {
  const { data } = await (await db()).from("mcp_connection").select("secret_blob, status").eq("id", 1).maybeSingle();
  if (!data?.secret_blob) return { secrets: null, status: data?.status ?? "disconnected" };
  return { secrets: await decrypt<Secrets>(data.secret_blob), status: data.status };
}
async function saveSecrets(s: Secrets, status: string, lastError: string | null) {
  await (await db()).from("mcp_connection").upsert({
    id: 1,
    secret_blob: await encrypt(s),
    status,
    last_error: lastError,
    expires_at: s.expires_at ? new Date(s.expires_at).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
}
async function setStatus(status: string, lastError: string | null) {
  await (await db()).from("mcp_connection").update({ status, last_error: lastError, updated_at: new Date().toISOString() }).eq("id", 1);
}

export async function getMcpPublicStatus() {
  const { data } = await (await db()).from("mcp_connection").select("status, last_error, updated_at").eq("id", 1).maybeSingle();
  let needsReauth = false;
  if (data?.status === "connected") {
    const { secrets } = await loadSecrets().catch(() => ({ secrets: null }));
    needsReauth = !!secrets && secrets.scopes !== (await mcpScopes());
  }
  return { status: data?.status ?? "disconnected", error: data?.last_error ?? null, updatedAt: data?.updated_at ?? null, needsReauth };
}

// ---------- OAuth: start (DCR + PKCE) ----------
export async function startOAuth(origin: string, userId: string) {
  const redirect_uri = `${origin}${CALLBACK_PATH}`;
  const { secrets } = await loadSecrets();
  const scopes = await mcpScopes();
  let client = secrets && secrets.redirect_uri === redirect_uri && secrets.scopes === scopes ? { client_id: secrets.client_id, client_secret: secrets.client_secret } : null;
  if (!client) {
    const res = await fetch(`${AUTH_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "PBC List",
        redirect_uris: [redirect_uri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: scopes,
      }),
    });
    if (!res.ok) throw new Error(`Pennylane a refusé l'enregistrement de l'application (${res.status}).`);
    const reg = (await res.json()) as { client_id: string; client_secret?: string };
    client = { client_id: reg.client_id, client_secret: reg.client_secret };
  }
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const d = await db();
  await d.from("mcp_oauth_states").delete().lt("created_at", new Date(Date.now() - 15 * 60000).toISOString());
  await d.from("mcp_oauth_states").insert({
    state,
    created_by: userId,
    secret_blob: await encrypt({ verifier, redirect_uri, scopes, ...client }),
  });
  const u = new URL(`${AUTH_BASE}/authorize`);
  u.search = new URLSearchParams({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri,
    scope: scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: MCP_URL,
  }).toString();
  return u.toString();
}

async function tokenRequest(params: Record<string, string>, client_secret?: string) {
  const body = new URLSearchParams({ ...params, resource: MCP_URL });
  if (client_secret) body.set("client_secret", client_secret);
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
}

// ---------- OAuth: callback ----------
export async function finishOAuth(state: string, code: string) {
  const d = await db();
  const { data: row } = await d.from("mcp_oauth_states").select("*").eq("state", state).maybeSingle();
  if (!row) throw new Error("state");
  await d.from("mcp_oauth_states").delete().eq("state", state);
  if (Date.now() - new Date(row.created_at).getTime() > 15 * 60000) throw new Error("state expired");
  const s = await decrypt<{ verifier: string; redirect_uri: string; scopes?: string; client_id: string; client_secret?: string }>(row.secret_blob);
  const tok = await tokenRequest(
    { grant_type: "authorization_code", code, redirect_uri: s.redirect_uri, client_id: s.client_id, code_verifier: s.verifier },
    s.client_secret,
  );
  await saveSecrets(
    {
      client_id: s.client_id,
      client_secret: s.client_secret,
      redirect_uri: s.redirect_uri,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: Date.now() + (tok.expires_in ?? 3600) * 1000,
      scopes: s.scopes ?? MCP_SCOPES,
    },
    "connected",
    null,
  );
}

// ---------- Access token with auto refresh ----------
export class McpUnavailable extends Error {}

async function accessToken(force = false): Promise<string> {
  const { secrets, status } = await loadSecrets();
  if (!secrets?.access_token || status === "disconnected") throw new McpUnavailable("Pennylane (MCP) n'est pas connecté.");
  if (status === "expired") throw new McpUnavailable(MCP_EXPIRED_MSG);
  if (!force && secrets.expires_at && secrets.expires_at - 120000 > Date.now()) return secrets.access_token;
  if (!secrets.refresh_token) {
    await setStatus("expired", MCP_EXPIRED_MSG);
    throw new McpUnavailable(MCP_EXPIRED_MSG);
  }
  try {
    const tok = await tokenRequest(
      { grant_type: "refresh_token", refresh_token: secrets.refresh_token, client_id: secrets.client_id },
      secrets.client_secret,
    );
    await saveSecrets(
      {
        ...secrets,
        access_token: tok.access_token,
        refresh_token: tok.refresh_token ?? secrets.refresh_token,
        expires_at: Date.now() + (tok.expires_in ?? 3600) * 1000,
      },
      "connected",
      null,
    );
    return tok.access_token;
  } catch {
    await setStatus("expired", MCP_EXPIRED_MSG);
    throw new McpUnavailable(MCP_EXPIRED_MSG);
  }
}

// ---------- MCP session ----------
export type McpSession = { call: <T>(tool: string, args: Record<string, unknown>, intent?: string) => Promise<T>; close: () => Promise<void> };

async function connect(token: string) {
  const client = new Client({ name: "pbc-list", version: "1.0.0" }, { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

export class McpToolError extends Error {}
// A dossier outside the hackathon demo list: the sync falls back to the API, like an unavailable MCP.
export class McpNotDemo extends McpUnavailable {
  constructor() {
    super(MCP_DEMO_ONLY_MSG);
  }
}

export async function openMcp(): Promise<McpSession> {
  let client: Client;
  try {
    client = await connect(await accessToken());
  } catch (e) {
    if (e instanceof McpUnavailable) throw e;
    // 401 → force one refresh then retry
    client = await connect(await accessToken(true));
  }
  const conversation_id = crypto.randomUUID();
  return {
    async call<T>(tool: string, args: Record<string, unknown>, intent = "Synchronizing the company's unlettered bank payments for document collection.") {
      // Single gate for the demo-only rule: nothing reaches Pennylane for another company.
      if (!mcpCallAllowed(tool, args)) throw new McpNotDemo();
      const res = (await client.callTool({
        name: tool,
        arguments: { ...args, conversation_id, intent },
      })) as { isError?: boolean; content?: { type: string; text?: string }[]; structuredContent?: unknown };
      const text = (res.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
      if (res.isError) throw new McpToolError(text.slice(0, 300) || `Erreur de l'outil ${tool}`);
      if (res.structuredContent) return res.structuredContent as T;
      return JSON.parse(text) as T;
    },
    close: () => client.close(),
  };
}

// ---------- Data fetch for detection (same output shape as the API path) ----------
export type McpTx = { id: string; date: string; description: string; amount: string; direction: string; status: string };
export type McpLine = { journal_entry_id: string; journal_code: string; account_number: string; lettering_id: string | null };

async function allPages<T>(s: McpSession, tool: string, args: Record<string, unknown>, key: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 500; page++) {
    const r = await s.call<Record<string, T[]>>(tool, { ...args, page });
    const items = r[key] ?? [];
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

export async function mcpFetch(companyId: string, since: string) {
  if (!isDemoCompany(companyId)) throw new McpNotDemo();
  const s = await openMcp();
  try {
    const company_id = Number(companyId);
    // Access probe for this dossier's company
    try {
      await s.call("list_transactions", { company_id, period_start: new Date().toISOString().slice(0, 10), page: 1 });
    } catch (e) {
      if (e instanceof McpToolError) throw new McpNoAccess(companyId);
      throw e;
    }
    const txs = (await allPages<McpTx>(s, "list_transactions", { company_id, period_start: since }, "transactions")).filter(
      (t) => t.status !== "rejected" && Number(t.amount) !== 0,
    );
    // Bank journals = journals of 512 lines; then all lines of those journals
    const bankLines = await allPages<McpLine>(s, "list_ledger_entry_lines", { company_id, period_start: since, account_filter: "512" }, "ledger_entry_lines");
    const journals = [...new Set(bankLines.map((l) => l.journal_code).filter(Boolean))];
    const lines: McpLine[] = [];
    for (const j of journals)
      lines.push(...(await allPages<McpLine>(s, "list_ledger_entry_lines", { company_id, period_start: since, journal_filter: j }, "ledger_entry_lines")));
    return { txs, lines };
  } finally {
    await s.close().catch(() => {});
  }
}

export class McpNoAccess extends Error {
  constructor(companyId: string) {
    super(`La connexion Pennylane (MCP) ne donne pas accès à l'entreprise ${companyId} : synchronisation bloquée pour ce dossier.`);
  }
}

// ---------- Company listing for import ----------
export type McpCompany = { company_id: string; name: string };

export const MCP_IMPORT_FAILED_MSG =
  "Impossible de récupérer la liste de vos entreprises Pennylane. Reconnectez Pennylane (MCP), puis réessayez.";

export async function mcpListCompanies(): Promise<McpCompany[]> {
  try {
    return await listCompaniesRaw();
  } catch (e) {
    const detail = e instanceof Error ? `${e.message} ${JSON.stringify((e as { data?: unknown }).data ?? null)}` : String(e);
    await setStatus("connected", `Import des dossiers : ${detail}`.slice(0, 500));
    throw new Error(e instanceof McpUnavailable ? e.message : MCP_IMPORT_FAILED_MSG);
  }
}

async function listCompaniesRaw(): Promise<McpCompany[]> {
  const s = await openMcp();
  try {
    const ctx = await s.call<{ companies?: { id: number; name: string }[]; firms?: { id: number; name?: string }[] }>("get_context", {});
    const map = new Map<string, string>();
    for (const c of ctx.companies ?? []) map.set(String(c.id), c.name);
    // Firm portfolios (only present with a firm-level connection) are enumerated via list_companies.
    for (const f of ctx.firms ?? []) {
      for (let page = 1; page <= 100; page++) {
        let r: { companies?: { id: number; name: string }[] };
        try {
          r = await s.call("list_companies", { firm_id: f.id, page });
        } catch {
          break;
        }
        const items = r.companies ?? [];
        for (const c of items) map.set(String(c.id), c.name);
        if (items.length < 100) break;
      }
    }
    // Demo-only rule: other companies of the account are never offered for import through the MCP.
    return [...map].filter(([company_id]) => isDemoCompany(company_id)).map(([company_id, name]) => ({ company_id, name })).sort((a, b) => a.name.localeCompare(b.name));
  } finally {
    await s.close().catch(() => {});
  }
}
