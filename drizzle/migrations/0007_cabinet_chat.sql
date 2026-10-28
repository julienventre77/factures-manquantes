create table public.cabinet_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  dossier_id uuid references public.dossiers(id) on delete set null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index on public.cabinet_chat_messages (user_id, created_at);
grant select, insert on public.cabinet_chat_messages to authenticated;
grant all on public.cabinet_chat_messages to service_role;
alter table public.cabinet_chat_messages enable row level security;
create policy "cabinet own chat read" on public.cabinet_chat_messages for select to authenticated
using (user_id = auth.uid() and public.has_role(auth.uid(), 'cabinet'));
create policy "cabinet own chat insert" on public.cabinet_chat_messages for insert to authenticated
with check (user_id = auth.uid() and public.has_role(auth.uid(), 'cabinet'));