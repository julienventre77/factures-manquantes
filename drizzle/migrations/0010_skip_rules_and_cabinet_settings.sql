-- Lot 3 : règles « ne plus demander » par dossier.
create table public.skip_rules (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  kind text not null check (kind in ('label','supplier')),
  pattern text not null,
  direction text check (direction in ('out','in')),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.skip_rules (dossier_id);
grant select, insert, update, delete on public.skip_rules to authenticated;
grant all on public.skip_rules to service_role;
alter table public.skip_rules enable row level security;
create policy "cabinet all skip rules" on public.skip_rules for all to authenticated
  using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));

alter table public.transactions add column skip_rule_id uuid references public.skip_rules(id) on delete set null;

-- Identité du cabinet affichée aux clients (page de connexion, en-tête, écran de fin).
create table public.cabinet_settings (
  id int primary key default 1 check (id = 1),
  name text not null default '',
  email text,
  phone text,
  logo_path text,
  updated_at timestamptz not null default now()
);
insert into public.cabinet_settings (id) values (1);
grant select on public.cabinet_settings to anon;
grant select, update on public.cabinet_settings to authenticated;
grant all on public.cabinet_settings to service_role;
alter table public.cabinet_settings enable row level security;
create policy "anyone reads cabinet settings" on public.cabinet_settings for select to anon, authenticated
  using (true);
create policy "cabinet updates cabinet settings" on public.cabinet_settings for update to authenticated
  using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));

-- Le garde-fou client protège aussi skip_rule_id.
create or replace function public.guard_tx_update() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if not public.has_role(auth.uid(),'cabinet') and auth.uid() is not null then
    if new.dossier_id <> old.dossier_id or new.pennylane_id <> old.pennylane_id or new.date <> old.date
       or new.amount <> old.amount or new.label <> old.label or new.supplier <> old.supplier
       or new.supplier_detected <> old.supplier_detected or new.is_open <> old.is_open
       or new.review_state <> old.review_state or new.direction <> old.direction
       or new.skip_rule_id is distinct from old.skip_rule_id then
      raise exception 'Modification non autorisée';
    end if;
  end if;
  return new;
end
$$;

-- Stockage du logo du cabinet (bucket « logos »).
create policy "cabinet manages logos" on storage.objects for all to authenticated
  using (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'))
  with check (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'));
create policy "anyone can view logos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'logos');