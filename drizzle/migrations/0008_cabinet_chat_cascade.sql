alter table public.cabinet_chat_messages
  drop constraint cabinet_chat_messages_dossier_id_fkey,
  add constraint cabinet_chat_messages_dossier_id_fkey
    foreign key (dossier_id) references public.dossiers(id) on delete cascade;