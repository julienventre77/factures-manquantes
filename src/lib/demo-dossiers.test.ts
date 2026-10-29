import { describe, expect, it } from "vitest";
import { isDemoCompany, mcpCallAllowed } from "./demo-dossiers";

describe("dossiers démo hackathon", () => {
  it("reconnaît le dossier démo, en texte ou en nombre", () => {
    expect(isDemoCompany("276211")).toBe(true);
    expect(isDemoCompany(" 276211 ")).toBe(true);
    expect(isDemoCompany(276211)).toBe(true);
  });
  it("refuse tout autre dossier", () => {
    expect(isDemoCompany("123456")).toBe(false);
    expect(isDemoCompany("")).toBe(false);
    expect(isDemoCompany(null)).toBe(false);
    expect(isDemoCompany(undefined)).toBe(false);
  });
});

describe("appels MCP", () => {
  it("autorise un outil sur le dossier démo", () => {
    expect(mcpCallAllowed("list_transactions", { company_id: 276211, page: 1 })).toBe(true);
  });
  it("bloque un outil sur un autre dossier", () => {
    expect(mcpCallAllowed("list_transactions", { company_id: 999, page: 1 })).toBe(false);
    expect(mcpCallAllowed("list_transactions", { company_id: undefined })).toBe(false);
  });
  it("n'autorise sans company_id que les outils du compte connecté", () => {
    expect(mcpCallAllowed("get_context", {})).toBe(true);
    expect(mcpCallAllowed("list_companies", { firm_id: 1, page: 1 })).toBe(true);
    expect(mcpCallAllowed("list_transactions", {})).toBe(false);
  });
  it("vérifie le dossier d'une opération dans ses paramètres de chemin", () => {
    expect(mcpCallAllowed("run_operations", { operation_id: "x", path_params: { company_id: 276211 } })).toBe(true);
    expect(mcpCallAllowed("run_operations", { operation_id: "x", path_params: { company_id: 123 } })).toBe(false);
    expect(mcpCallAllowed("run_operations", { operation_id: "x", company_id: 276211 })).toBe(false);
    expect(mcpCallAllowed("run_operations", { operation_id: "x" })).toBe(false);
  });
});
