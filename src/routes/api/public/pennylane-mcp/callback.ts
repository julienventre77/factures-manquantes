import { createFileRoute } from "@tanstack/react-router";

// OAuth return from Pennylane. Security: the one-time `state` (created by a verified
// cabinet user, valid 15 min) plus PKCE verifier stored server-side authenticate this call.
export const Route = createFileRoute("/api/public/pennylane-mcp/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const back = (r: string) => Response.redirect(`${url.origin}/cabinet?mcp=${r}`, 302);
        if (!state || !code) return back("error");
        try {
          const { finishOAuth } = await import("@/lib/mcp.server");
          await finishOAuth(state, code);
          return back("ok");
        } catch {
          console.error("MCP OAuth callback failed");
          return back("error");
        }
      },
    },
  },
});
