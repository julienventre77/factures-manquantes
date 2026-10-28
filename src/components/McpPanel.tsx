import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMcpStatus, startMcpConnect } from "@/lib/mcp.functions";
import { ImportDossiers } from "@/components/ImportDossiers";

// Pennylane connection status, with the import of the firm's companies next to it.
export function McpPanel({ existing }: { existing: string[] }) {
  const fetchStatus = useServerFn(getMcpStatus);
  const start = useServerFn(startMcpConnect);
  const [busy, setBusy] = useState(false);
  const status = useQuery({ queryKey: ["mcp-status"], queryFn: () => fetchStatus() });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("mcp");
    if (p === "ok") toast.success("Pennylane (MCP) connecté");
    if (p === "error") toast.error("La connexion à Pennylane (MCP) a échoué. Réessayez.");
    if (p) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await start();
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  const s = status.data?.status;
  const ok = s === "connected" && !status.data?.needsReauth;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ok ? "bg-mint text-primary" : "bg-yellow-soft text-yellow-ink"}`}>
        <Plug className="h-5 w-5" />
      </span>
      <div className="min-w-[16rem] flex-1">
        <div className="font-bold text-primary">Pennylane (MCP)</div>
        {s === "connected" && status.data?.needsReauth && (
          <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> Nouvelle autorisation nécessaire : veuillez reconnecter Pennylane (MCP)</p>
        )}
        {ok && <p className="flex items-center gap-1.5 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> Connecté : la synchronisation passe par le MCP.</p>}
        {s === "expired" && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> Connexion Pennylane (MCP) expirée : veuillez reconnecter</p>}
        {(!s || s === "disconnected") && (
          <p className="text-sm text-muted-foreground">Non connecté : la synchronisation utilise l'API (secours).</p>
        )}
      </div>
      <Button variant={s === "connected" && !status.data?.needsReauth ? "outline" : "default"} onClick={connect} disabled={busy}>
        <Plug /> {s === "connected" ? "Reconnecter Pennylane (MCP)" : "Connecter Pennylane (MCP)"}
      </Button>
      <ImportDossiers existing={existing} />
    </div>
  );
}
