-- Alignement sur la PR #2 : vérification du motif, nom par défaut, politiques logos.
alter table public.skip_rules add constraint skip_rules_pattern_not_blank check (length(trim(pattern)) > 0);

alter table public.cabinet_settings alter column name set default 'Votre cabinet';
update public.cabinet_settings set name = 'Votre cabinet' where id = 1 and name = '';

drop policy "cabinet manages logos" on storage.objects;
drop policy "anyone can view logos" on storage.objects;
create policy "logos cabinet read" on storage.objects for select to authenticated
using (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'));
create policy "logos cabinet insert" on storage.objects for insert to authenticated
with check (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'));
create policy "logos cabinet update" on storage.objects for update to authenticated
using (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'));
create policy "logos cabinet delete" on storage.objects for delete to authenticated
using (bucket_id = 'logos' and public.has_role(auth.uid(),'cabinet'));