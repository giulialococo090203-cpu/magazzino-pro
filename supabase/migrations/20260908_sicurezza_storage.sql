-- ============================================================
-- WorkSpace - SICUREZZA ARCHIVIO FATTURE
-- ------------------------------------------------------------
-- Da eseguire DOPO 20260908_pulizia_multi_azienda.sql.
--
-- PROBLEMA
--   Il bucket "fatture" era accessibile al ruolo anonimo: chiunque
--   conoscesse la chiave pubblica del sito (che e' inclusa nel codice
--   dell'applicazione, quindi leggibile da chiunque) poteva scaricare,
--   sostituire o cancellare le fatture dell'azienda senza fare login.
--
-- SOLUZIONE
--   Le stesse operazioni restano possibili solo agli utenti
--   autenticati con Firebase, come gia' avviene per tutti gli altri
--   dati. L'applicazione continua a funzionare senza modifiche:
--   apre i documenti con link firmati, generati da utente autenticato.
-- ============================================================

drop policy if exists "fatture_storage_read"        on storage.objects;
drop policy if exists "fatture_storage_select"      on storage.objects;
drop policy if exists "fatture_storage_insert"      on storage.objects;
drop policy if exists "fatture_storage_update"      on storage.objects;
drop policy if exists "fatture_storage_delete"      on storage.objects;
drop policy if exists "fatture_storage_auth_read"   on storage.objects;
drop policy if exists "fatture_storage_auth_insert" on storage.objects;
drop policy if exists "fatture_storage_auth_delete" on storage.objects;
drop policy if exists "fatture_select_autenticati"  on storage.objects;
drop policy if exists "fatture_insert_autenticati"  on storage.objects;
drop policy if exists "fatture_update_autenticati"  on storage.objects;
drop policy if exists "fatture_delete_autenticati"  on storage.objects;

create policy "fatture_select_autenticati"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fatture');

create policy "fatture_insert_autenticati"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fatture');

create policy "fatture_update_autenticati"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fatture')
  with check (bucket_id = 'fatture');

create policy "fatture_delete_autenticati"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fatture');

-- Il bucket non deve essere pubblico.
update storage.buckets set public = false where id = 'fatture';

-- ------------------------------------------------------------
-- VERIFICA
-- ------------------------------------------------------------

select
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and 'anon' = any(roles)) as policy_anonime_rimaste,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and 'authenticated' = any(roles)) as policy_autenticate,
  (select public from storage.buckets where id = 'fatture') as bucket_pubblico;
