create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index on public.chat_messages (user_id, created_at);
grant select, insert on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "own chat read" on public.chat_messages for select to authenticated using (user_id = auth.uid());
create policy "own chat insert" on public.chat_messages for insert to authenticated
with check (user_id = auth.uid() and public.is_member(dossier_id));

create table public.cabinet_questions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  user_email text,
  question text not null,
  context text,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.cabinet_questions to authenticated;
grant all on public.cabinet_questions to service_role;
alter table public.cabinet_questions enable row level security;
create policy "cabinet all questions" on public.cabinet_questions for all to authenticated
using (public.has_role(auth.uid(),'cabinet')) with check (public.has_role(auth.uid(),'cabinet'));
create policy "client inserts own question" on public.cabinet_questions for insert to authenticated
with check (user_id = auth.uid() and public.is_member(dossier_id));
create policy "client reads own questions" on public.cabinet_questions for select to authenticated
using (user_id = auth.uid());