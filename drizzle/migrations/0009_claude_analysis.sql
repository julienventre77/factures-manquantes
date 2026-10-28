-- Lot 6 : analyse des lignes d'un dossier par Claude, suggestions validées par le cabinet.
alter table public.transactions add column ai_analyzed_at timestamptz;

-- Singleton : plafond mensuel des analyses Claude (en dollars US, facturation API Anthropic).
create table public.ai_settings (
  id int primary key default 1 check (id = 1),
  monthly_cap_usd numeric(10,2) not null default 10 check (monthly_cap_usd >= 0),
  updated_at timestamptz not null default now()
);
insert into public.ai_settings (id) values (1);
grant select, update on public.ai_settings to authenticated;
grant all on public.ai_settings to service_role;
alter table public.ai_settings enable row level security;
create policy "cabinet reads ai settings" on public.ai_settings for select to authenticated
using (public.has_role(auth.uid(),'cabinet'));
create policy "cabinet updates ai settings" on public.ai_settings for update to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));

create table public.ai_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  model text not null,
  lines_analyzed int not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10,4) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.ai_analysis_runs (created_at);
create index on public.ai_analysis_runs (dossier_id, created_at);
grant select, insert on public.ai_analysis_runs to authenticated;
grant all on public.ai_analysis_runs to service_role;
alter table public.ai_analysis_runs enable row level security;
create policy "cabinet all ai runs" on public.ai_analysis_runs for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_analysis_runs(id) on delete cascade,
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  kind text not null check (kind in ('group','duplicate','personal','skip')),
  transaction_ids uuid[] not null,
  target_supplier text,
  reason text not null,
  state text not null default 'open' check (state in ('open','applied','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.ai_suggestions (dossier_id, state);
grant select, insert, update on public.ai_suggestions to authenticated;
grant all on public.ai_suggestions to service_role;
alter table public.ai_suggestions enable row level security;
create policy "cabinet all ai suggestions" on public.ai_suggestions for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));
