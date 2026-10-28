-- Lot 3: "ne plus demander" rules, per dossier, applied by every sync.
create table public.skip_rules (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  kind text not null check (kind in ('label','supplier')),
  pattern text not null check (length(trim(pattern)) > 0),
  direction text check (direction in ('out','in')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.skip_rules (dossier_id);
grant select, insert, update, delete on public.skip_rules to authenticated;
grant all on public.skip_rules to service_role;
alter table public.skip_rules enable row level security;
create policy "cabinet all skip rules" on public.skip_rules for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));

-- Rule that set the line aside. Kept after a manual reactivation so the next sync does not dismiss it again.
alter table public.transactions add column skip_rule_id uuid references public.skip_rules(id) on delete set null;

create or replace function public.guard_tx_update()
returns trigger language plpgsql security definer set search_path = public as $$
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
end $$;

-- Option C: identity of the firm shown to clients (single row).
create table public.cabinet_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'Votre cabinet',
  email text,
  phone text,
  logo_path text,
  updated_at timestamptz not null default now()
);
insert into public.cabinet_settings (id) values (1) on conflict (id) do nothing;
grant select on public.cabinet_settings to anon, authenticated;
grant update on public.cabinet_settings to authenticated;
grant all on public.cabinet_settings to service_role;
alter table public.cabinet_settings enable row level security;
-- Public on purpose: the client sign-in page shows the firm's name, logo and contact.
create policy "anyone reads cabinet identity" on public.cabinet_settings for select to anon, authenticated using (true);
create policy "cabinet updates identity" on public.cabinet_settings for update to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));

-- Public bucket for the firm logo (images only, 1 MB). Only the cabinet can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
-- Storage needs select on the object to replace or remove it.
create policy "logos cabinet read" on storage.objects for select to authenticated
using (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'));
create policy "logos cabinet insert" on storage.objects for insert to authenticated
with check (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'));
create policy "logos cabinet update" on storage.objects for update to authenticated
using (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'));
create policy "logos cabinet delete" on storage.objects for delete to authenticated
using (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'));
