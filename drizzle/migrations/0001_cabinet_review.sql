alter table public.transactions add column review_state text not null default 'sent'
  check (review_state in ('pending','sent','dismissed'));
create index on public.transactions (dossier_id, review_state);

drop policy "client reads own tx" on public.transactions;
drop policy "client updates own tx" on public.transactions;
create policy "client reads own sent tx" on public.transactions for select to authenticated
using (public.is_member(dossier_id) and review_state = 'sent');
create policy "client updates own sent tx" on public.transactions for update to authenticated
using (public.is_member(dossier_id) and review_state = 'sent')
with check (public.is_member(dossier_id) and review_state = 'sent');

create or replace function public.guard_tx_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.has_role(auth.uid(),'cabinet') and auth.uid() is not null then
    if new.dossier_id <> old.dossier_id or new.pennylane_id <> old.pennylane_id or new.date <> old.date
       or new.amount <> old.amount or new.label <> old.label or new.supplier <> old.supplier
       or new.supplier_detected <> old.supplier_detected or new.is_open <> old.is_open
       or new.review_state <> old.review_state then
      raise exception 'Modification non autorisée';
    end if;
  end if;
  return new;
end $$;