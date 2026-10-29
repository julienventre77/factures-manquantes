-- Saisie augmentée : Claude lit les factures déposées par le client, le cabinet valide la ventilation.
-- Rien n'est écrit dans Pennylane.

-- Les lectures de factures sont comptées avec les analyses dans le plafond mensuel Claude.
alter table public.ai_analysis_runs add column kind text not null default 'analyse' check (kind in ('analyse','saisie'));

create table public.saisies (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  upload_id uuid not null unique references public.uploads(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tiers text not null,
  fournisseur text not null,
  numero text,
  date_facture date,
  total_ht numeric(14,2) not null default 0,
  total_tva numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  libelle_ecriture text,
  lignes jsonb not null default '[]'::jsonb,
  lecture jsonb,
  state text not null default 'proposee' check (state in ('proposee','validee','rejetee','echec')),
  model text,
  cost_usd numeric(10,4) not null default 0,
  lu_par uuid,
  lu_le timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.saisies (dossier_id);
grant select, insert, update on public.saisies to authenticated;
grant all on public.saisies to service_role;
alter table public.saisies enable row level security;
create policy "cabinet all saisies" on public.saisies for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));

-- Mémoire par fournisseur : compte retenu pour une désignation, appris à chaque saisie validée.
create table public.regles_fournisseur (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  tiers text not null,
  cle text not null,
  compte text not null,
  compte_libelle text not null default '',
  updated_at timestamptz not null default now(),
  unique (dossier_id, tiers, cle)
);
grant select, insert, update, delete on public.regles_fournisseur to authenticated;
grant all on public.regles_fournisseur to service_role;
alter table public.regles_fournisseur enable row level security;
create policy "cabinet all regles fournisseur" on public.regles_fournisseur for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));
