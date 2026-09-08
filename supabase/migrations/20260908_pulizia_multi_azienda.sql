-- ============================================================
-- WorkSpace - PULIZIA FINALE MULTI-AZIENDA
-- ------------------------------------------------------------
-- Da eseguire DOPO 20260908_azienda_unica.sql.
--
-- COME SI ESEGUE
--   Apri l'SQL editor di Supabase, incolla tutto il file e premi Run.
--   Le sezioni sono in ordine: si puo' anche eseguire una sezione
--   alla volta.
--
-- COSA FA
--   1. l'accesso ai dati non dipende piu' dai claim Firebase
--   2. la tabella aziende contiene ed espone solo l'azienda unica
--   3. elimina definitivamente i dati delle aziende di test  (IRREVERSIBILE)
--   4. rimuove le colonne dell'abbonamento
--   5. verifica finale
-- ============================================================


-- ============================================================
-- 1. ACCESSO AI DATI SENZA CLAIM (azienda unica)
-- ------------------------------------------------------------
-- Prima: current_company_id() leggeva il claim 'azienda_id' scritto
-- sull'utente Firebase. Se il claim mancava o era vecchio, l'utente
-- non vedeva piu' nulla e serviva risincronizzare i claim a mano.
--
-- Adesso: l'azienda e' una sola, quindi la funzione restituisce
-- cl_thermoservice se il token Firebase appartiene a un utente attivo
-- dell'azienda (verificato sulla tabella utenti). Il vecchio claim
-- resta accettato come alternativa, per non rompere le sessioni aperte.
--
-- SECURITY DEFINER e' necessario: la tabella utenti non e' leggibile
-- direttamente dal client.
-- ============================================================

create or replace function public.current_company_id()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select case
    when exists (
      select 1
      from public.utenti u
      where u.azienda_id = 'cl_thermoservice'
        and coalesce(u.attivo, true) = true
        and lower(coalesce(u.email, u.username)) = lower(nullif(auth.jwt() ->> 'email', ''))
    )
    then 'cl_thermoservice'
    when coalesce(
      auth.jwt() ->> 'azienda_id',
      auth.jwt() -> 'app_metadata' ->> 'azienda_id',
      auth.jwt() -> 'user_metadata' ->> 'azienda_id'
    ) = 'cl_thermoservice'
    then 'cl_thermoservice'
  end;
$fn$;

comment on function public.current_company_id() is
  'Azienda unica: restituisce cl_thermoservice se il token Firebase appartiene a un utente attivo dell azienda.';

create or replace function public.is_programmer()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select
    lower(nullif(auth.jwt() ->> 'email', '')) in (
      'giulialococo090203@gmail.com',
      'giulia@gmail.com'
    )
    or exists (
      select 1
      from public.utenti u
      where u.azienda_id = 'cl_thermoservice'
        and coalesce(u.attivo, true) = true
        and lower(coalesce(u.email, u.username)) = lower(nullif(auth.jwt() ->> 'email', ''))
        and lower(coalesce(u.ruolo, '')) in (
          'sviluppatore', 'super_admin', 'admin_tecnico', 'programmatore'
        )
    );
$fn$;

comment on function public.is_programmer() is
  'Vero per le email del programmatore o per gli utenti attivi con ruolo tecnico.';


-- ============================================================
-- 2. TABELLA AZIENDE: solo l'azienda unica, solo utenti autenticati
-- ============================================================

drop policy if exists "aziende_select_pubblico" on aziende;
drop policy if exists "aziende_anon_read" on aziende;
drop policy if exists "aziende_auth_read" on aziende;
drop policy if exists "aziende_select_unica" on aziende;
drop policy if exists "aziende_update_ultimo_accesso" on aziende;

alter table aziende enable row level security;

create policy "aziende_select_unica"
  on aziende for select
  to authenticated
  using (id = 'cl_thermoservice');

create policy "aziende_update_unica"
  on aziende for update
  to authenticated
  using (id = 'cl_thermoservice')
  with check (id = 'cl_thermoservice');


-- ============================================================
-- 3. DATI DELLE ALTRE AZIENDE   *** IRREVERSIBILE ***
-- ------------------------------------------------------------
-- Elimina i dati di cl_test, cl_test2, cl_test3 e dell'ambiente
-- tecnico 'programmatore'. I dati di Thermoservice non vengono
-- toccati da nessuna di queste istruzioni.
-- ============================================================

delete from righe_inventario      where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from sessioni_inventario   where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from righe_proposta_ordine where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from proposte_ordine       where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from storico_prezzi        where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from fatture_importate     where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from log_modifiche         where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from notifiche             where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from movimenti             where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from materiali             where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from categorie             where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from impostazioni          where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from utenti                where azienda_id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');
delete from aziende               where id in ('cl_test', 'cl_test2', 'cl_test3', 'programmatore');

-- Nota: i 14 file delle fatture di test restano nello Storage.
-- Supabase non permette di cancellarli via SQL: l'elenco e' in
-- _archivio_multi_azienda/file_storage_da_rimuovere.txt e si eliminano
-- dal pannello Storage > fatture.


-- ============================================================
-- 4. COLONNE DELL'ABBONAMENTO (non piu' usate dall'app)
-- ============================================================

alter table aziende drop column if exists piano;
alter table aziende drop column if exists stato_abbonamento;
alter table aziende drop column if exists data_inizio_abbonamento;
alter table aziende drop column if exists data_scadenza_abbonamento;
alter table aziende drop column if exists max_utenti;
alter table aziende drop column if exists sospesa_motivo;


-- ============================================================
-- 5. VERIFICA FINALE
-- ============================================================

select
  (select count(*) from aziende) as aziende_rimaste,
  (select count(*) from utenti) as utenti,
  (select count(*) from materiali) as materiali,
  (select count(*) from movimenti) as movimenti,
  (select count(*) from fatture_importate) as fatture,
  (select count(*) from materiali where azienda_id <> 'cl_thermoservice') as materiali_estranei,
  (select count(*) from movimenti where azienda_id <> 'cl_thermoservice') as movimenti_estranei,
  pg_size_pretty(pg_database_size(current_database())) as dimensione_db;


-- ============================================================
-- FACOLTATIVO: recupero dello spazio su disco dopo la cancellazione.
-- Da lanciare uno alla volta, in una query separata.
--
--   vacuum (full, analyze) movimenti;
--   vacuum (full, analyze) materiali;
--   vacuum (full, analyze) storico_prezzi;
-- ============================================================


-- ============================================================
-- SE QUALCOSA VA STORTO: ritorno al comportamento precedente
-- (accesso ai dati di nuovo basato sul claim Firebase)
--
-- create or replace function public.current_company_id()
-- returns text language sql stable as $old$
--   select nullif(coalesce(
--     auth.jwt() ->> 'azienda_id',
--     auth.jwt() -> 'app_metadata' ->> 'azienda_id',
--     auth.jwt() -> 'user_metadata' ->> 'azienda_id'
--   ), '');
-- $old$;
-- ============================================================
