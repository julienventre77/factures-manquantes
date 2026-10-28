create type public.app_role as enum ('cabinet','client');
create type public.tx_status as enum ('a_faire','depose','email','sans_facture');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles or cabinet" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(),'cabinet'));

create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_id text not null,
  collect_email text,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.dossiers to authenticated;
grant all on public.dossiers to service_role;
alter table public.dossiers enable row level security;

create table public.dossier_members (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  user_id uuid not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique (dossier_id, user_id)
);
grant select, insert, update, delete on public.dossier_members to authenticated;
grant all on public.dossier_members to service_role;
alter table public.dossier_members enable row level security;

create or replace function public.is_member(_dossier_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dossier_members where dossier_id = _dossier_id and user_id = auth.uid())
$$;

create policy "cabinet all dossiers" on public.dossiers for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));
create policy "client reads own dossier" on public.dossiers for select to authenticated
using (public.is_member(id));

create policy "cabinet all members" on public.dossier_members for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));
create policy "client reads own membership" on public.dossier_members for select to authenticated
using (user_id = auth.uid());

create table public.supplier_aliases (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  detected_name text not null,
  display_name text not null,
  unique (dossier_id, detected_name)
);
grant select, insert, update, delete on public.supplier_aliases to authenticated;
grant all on public.supplier_aliases to service_role;
alter table public.supplier_aliases enable row level security;
create policy "cabinet all aliases" on public.supplier_aliases for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  pennylane_id text not null,
  date date not null,
  amount numeric(14,2) not null,
  label text not null,
  supplier_detected text not null,
  supplier text not null,
  status public.tx_status not null default 'a_faire',
  comment text,
  is_open boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (dossier_id, pennylane_id)
);
create index on public.transactions (dossier_id, is_open);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "cabinet all tx" on public.transactions for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));
create policy "client reads own tx" on public.transactions for select to authenticated
using (public.is_member(dossier_id));
create policy "client updates own tx" on public.transactions for update to authenticated
using (public.is_member(dossier_id)) with check (public.is_member(dossier_id));

-- Clients may only change status/comment
create or replace function public.guard_tx_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.has_role(auth.uid(),'cabinet') and auth.uid() is not null then
    if new.dossier_id <> old.dossier_id or new.pennylane_id <> old.pennylane_id or new.date <> old.date
       or new.amount <> old.amount or new.label <> old.label or new.supplier <> old.supplier
       or new.supplier_detected <> old.supplier_detected or new.is_open <> old.is_open then
      raise exception 'Modification non autorisée';
    end if;
  end if;
  return new;
end $$;
create trigger trg_guard_tx before update on public.transactions for each row execute function public.guard_tx_update();

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert on public.uploads to authenticated;
grant all on public.uploads to service_role;
alter table public.uploads enable row level security;
create policy "cabinet reads uploads" on public.uploads for select to authenticated
using (public.has_role(auth.uid(),'cabinet'));
create policy "client reads own uploads" on public.uploads for select to authenticated
using (public.is_member(dossier_id));
create policy "client inserts own uploads" on public.uploads for insert to authenticated
with check (public.is_member(dossier_id) and uploaded_by = auth.uid()
  and exists (select 1 from public.transactions t where t.id = transaction_id and t.dossier_id = uploads.dossier_id));

-- Storage: path = <dossier_id>/<transaction_id>/<file>
create policy "factures cabinet read" on storage.objects for select to authenticated
using (bucket_id = 'factures' and public.has_role(auth.uid(),'cabinet'));
create policy "factures client read" on storage.objects for select to authenticated
using (bucket_id = 'factures' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "factures client insert" on storage.objects for insert to authenticated
with check (bucket_id = 'factures' and public.is_member(((storage.foldername(name))[1])::uuid));