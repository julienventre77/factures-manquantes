import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMcpStatus, startMcpConnect } from "@/lib/mcp.functions";

export function McpPanel() {
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
      <div>
        <div className="font-semibold">Pennylane (MCP)</div>
        {s === "connected" && <p className="text-sm text-muted-foreground">Connecté — la synchronisation passe par le MCP.</p>}
        {s === "expired" && <p className="text-sm text-destructive">Connexion Pennylane (MCP) expirée : veuillez reconnecter</p>}
        {(!s || s === "disconnected") && (
          <p className="text-sm text-muted-foreground">Non connecté — la synchronisation utilise l'API (secours).</p>
        )}
      </div>
      <Button size="lg" variant={s === "connected" ? "outline" : "default"} onClick={connect} disabled={busy}>
        <Plug /> {s === "connected" ? "Reconnecter Pennylane (MCP)" : "Connecter Pennylane (MCP)"}
      </Button>
    </div>
  );
}
