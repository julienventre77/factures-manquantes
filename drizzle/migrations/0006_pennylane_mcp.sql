CREATE TABLE public.mcp_connection (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret_blob text,
  status text NOT NULL DEFAULT 'disconnected',
  last_error text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mcp_connection TO service_role;
REVOKE ALL ON public.mcp_connection FROM anon, authenticated;
ALTER TABLE public.mcp_connection ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mcp_oauth_states (
  state text PRIMARY KEY,
  secret_blob text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mcp_oauth_states TO service_role;
REVOKE ALL ON public.mcp_oauth_states FROM anon, authenticated;
ALTER TABLE public.mcp_oauth_states ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dossiers ADD COLUMN IF NOT EXISTS last_sync_source text;
ALTER TABLE public.dossiers ADD COLUMN IF NOT EXISTS last_mcp_error text;