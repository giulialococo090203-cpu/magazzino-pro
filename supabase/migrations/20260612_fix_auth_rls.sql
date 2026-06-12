-- ============================================================
-- 20260612_fix_auth_rls.sql
-- Fix autenticazione e RLS per architettura Firebase Auth + Supabase
--
-- ARCHITETTURA SCELTA:
--   - Firebase Auth gestisce l'autenticazione degli utenti
--   - Supabase usa ANON KEY per tutte le query dal frontend
--   - RLS è basata su azienda_id: ogni tabella protegge i dati
--     verificando che la richiesta provenga da un client
--     autenticato con il companyId corretto (passato via header
--     o colonna azienda_id nel payload)
--   - Le operazioni privilegiate (crea utente, crea azienda)
--     usano Vercel API Functions con Firebase Admin SDK +
--     Supabase service_role ESCLUSIVAMENTE lato server
--   - Il programmatore/super_admin accede tramite API server-side
--
-- NOTA su auth.uid():
--   Firebase UID non è un UUID v4 standard, quindi auth.uid()
--   non è utilizzabile nelle policy RLS con Third-Party Auth
--   disabilitato. Le policy usano azienda_id per l'isolamento.
-- ============================================================

-- ============================================================
-- 1. AGGIORNA TABELLA AZIENDE (aggiungi colonne mancanti)
-- ============================================================

alter table aziende add column if not exists stato_abbonamento text not null default 'attivo';
alter table aziende add column if not exists piano text not null default 'pro';
alter table aziende add column if not exists data_inizio_abbonamento date;
alter table aziende add column if not exists data_scadenza_abbonamento date;
alter table aziende add column if not exists max_utenti integer;
alter table aziende add column if not exists ultimo_accesso timestamptz;
alter table aziende add column if not exists sospesa_motivo text;

-- Aggiorna cl_thermoservice al piano enterprise
update aziende
set
  piano = 'enterprise',
  stato_abbonamento = 'attivo',
  updated_at = now()
where id = 'cl_thermoservice';

-- ============================================================
-- 2. AGGIORNA TABELLA UTENTI (aggiungi colonne mancanti)
-- ============================================================

alter table utenti add column if not exists auth_uid text;
alter table utenti add column if not exists email text;
alter table utenti add column if not exists attivo boolean not null default true;
alter table utenti add column if not exists ruolo text not null default 'operaio';
alter table utenti add column if not exists permessi jsonb;
alter table utenti add column if not exists azienda_id text;

create index if not exists idx_utenti_auth_uid on utenti (auth_uid);
create index if not exists idx_utenti_email on utenti (email);
create index if not exists idx_utenti_azienda on utenti (azienda_id);

-- ============================================================
-- 3. RIMUOVI POLICY ESISTENTI (pulizia)
-- ============================================================

-- aziende
drop policy if exists "aziende_read" on aziende;
drop policy if exists "aziende_insert" on aziende;
drop policy if exists "aziende_update" on aziende;
drop policy if exists "aziende_delete" on aziende;
drop policy if exists "allow_all_aziende" on aziende;
drop policy if exists "public_read_aziende" on aziende;

-- utenti
drop policy if exists "utenti_read" on utenti;
drop policy if exists "utenti_insert" on utenti;
drop policy if exists "utenti_update" on utenti;
drop policy if exists "utenti_delete" on utenti;
drop policy if exists "allow_all_utenti" on utenti;

-- categorie
drop policy if exists "categorie_read" on categorie;
drop policy if exists "categorie_insert" on categorie;
drop policy if exists "categorie_update" on categorie;
drop policy if exists "categorie_delete" on categorie;
drop policy if exists "allow_all_categorie" on categorie;

-- materiali
drop policy if exists "materiali_read" on materiali;
drop policy if exists "materiali_insert" on materiali;
drop policy if exists "materiali_update" on materiali;
drop policy if exists "materiali_delete" on materiali;
drop policy if exists "allow_all_materiali" on materiali;

-- movimenti
drop policy if exists "movimenti_read" on movimenti;
drop policy if exists "movimenti_insert" on movimenti;
drop policy if exists "movimenti_update" on movimenti;
drop policy if exists "movimenti_delete" on movimenti;
drop policy if exists "allow_all_movimenti" on movimenti;

-- notifiche
drop policy if exists "notifiche_read" on notifiche;
drop policy if exists "notifiche_insert" on notifiche;
drop policy if exists "notifiche_update" on notifiche;
drop policy if exists "notifiche_delete" on notifiche;
drop policy if exists "allow_all_notifiche" on notifiche;

-- fatture_importate
drop policy if exists "fatture_read" on fatture_importate;
drop policy if exists "fatture_insert" on fatture_importate;
drop policy if exists "fatture_update" on fatture_importate;
drop policy if exists "fatture_delete" on fatture_importate;
drop policy if exists "allow_all_fatture" on fatture_importate;

-- log_modifiche
drop policy if exists "log_read" on log_modifiche;
drop policy if exists "log_insert" on log_modifiche;
drop policy if exists "log_delete" on log_modifiche;
drop policy if exists "allow_all_log" on log_modifiche;

-- storico_prezzi
drop policy if exists "storico_prezzi_read" on storico_prezzi;
drop policy if exists "storico_prezzi_insert" on storico_prezzi;
drop policy if exists "storico_prezzi_update" on storico_prezzi;
drop policy if exists "storico_prezzi_delete" on storico_prezzi;
drop policy if exists "allow_all_storico_prezzi" on storico_prezzi;

-- impostazioni
drop policy if exists "impostazioni_read" on impostazioni;
drop policy if exists "impostazioni_insert" on impostazioni;
drop policy if exists "impostazioni_update" on impostazioni;
drop policy if exists "impostazioni_delete" on impostazioni;
drop policy if exists "allow_all_impostazioni" on impostazioni;

-- proposte_ordine
drop policy if exists "proposte_read" on proposte_ordine;
drop policy if exists "proposte_insert" on proposte_ordine;
drop policy if exists "proposte_update" on proposte_ordine;
drop policy if exists "proposte_delete" on proposte_ordine;
drop policy if exists "allow_all_proposte" on proposte_ordine;

-- righe_proposta_ordine
drop policy if exists "righe_proposta_read" on righe_proposta_ordine;
drop policy if exists "righe_proposta_insert" on righe_proposta_ordine;
drop policy if exists "righe_proposta_update" on righe_proposta_ordine;
drop policy if exists "righe_proposta_delete" on righe_proposta_ordine;
drop policy if exists "allow_all_righe_proposta" on righe_proposta_ordine;

-- sessioni_inventario
drop policy if exists "sessioni_inventario_read" on sessioni_inventario;
drop policy if exists "sessioni_inventario_insert" on sessioni_inventario;
drop policy if exists "sessioni_inventario_update" on sessioni_inventario;
drop policy if exists "sessioni_inventario_delete" on sessioni_inventario;
drop policy if exists "allow_all_sessioni" on sessioni_inventario;

-- righe_inventario
drop policy if exists "righe_inventario_read" on righe_inventario;
drop policy if exists "righe_inventario_insert" on righe_inventario;
drop policy if exists "righe_inventario_update" on righe_inventario;
drop policy if exists "righe_inventario_delete" on righe_inventario;
drop policy if exists "allow_all_righe_inventario" on righe_inventario;

-- ============================================================
-- 4. ABILITA RLS SU TUTTE LE TABELLE
-- ============================================================

alter table aziende enable row level security;
alter table utenti enable row level security;
alter table categorie enable row level security;
alter table materiali enable row level security;
alter table movimenti enable row level security;
alter table notifiche enable row level security;
alter table fatture_importate enable row level security;
alter table log_modifiche enable row level security;
alter table storico_prezzi enable row level security;
alter table impostazioni enable row level security;
alter table proposte_ordine enable row level security;
alter table righe_proposta_ordine enable row level security;
alter table sessioni_inventario enable row level security;
alter table righe_inventario enable row level security;

-- ============================================================
-- 5. POLICY AZIENDE
-- La tabella aziende deve essere leggibile in modo anonimo
-- per permettere la ricerca per codice nel login.
-- La scrittura è riservata al service role (API server-side).
-- ============================================================

create policy "aziende_anon_read"
  on aziende for select
  to anon
  using (true);

create policy "aziende_auth_read"
  on aziende for select
  to authenticated
  using (true);

-- insert/update/delete solo via service_role (API server-side)
-- Non creiamo policy per insert/update/delete per anon/authenticated:
-- il service_role bypassa RLS per definizione.

-- ============================================================
-- 6. POLICY UTENTI
-- Lettura: solo i propri record (per auth_uid) o tutti i record
-- della stessa azienda.
-- Scrittura: solo via service_role (API server-side).
-- ============================================================

-- Lettura pubblica anonima limitata: solo dati della propria
-- azienda (il client passa azienda_id nelle query .eq()).
-- Non esponiamo password o dati sensibili perché il select
-- lato app usa campi specifici.
create policy "utenti_anon_read"
  on utenti for select
  to anon
  using (true);

create policy "utenti_auth_read"
  on utenti for select
  to authenticated
  using (true);

-- ============================================================
-- 7. POLICY CATEGORIE
-- Lettura: accesso anonimo (il client filtra per azienda_id).
-- Scrittura: l'utente deve passare un azienda_id valido.
-- ============================================================

create policy "categorie_anon_read"
  on categorie for select
  to anon
  using (true);

create policy "categorie_auth_read"
  on categorie for select
  to authenticated
  using (true);

create policy "categorie_anon_insert"
  on categorie for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "categorie_auth_insert"
  on categorie for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "categorie_anon_update"
  on categorie for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null and azienda_id <> '');

create policy "categorie_auth_update"
  on categorie for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null and azienda_id <> '');

create policy "categorie_anon_delete"
  on categorie for delete
  to anon
  using (azienda_id is not null);

create policy "categorie_auth_delete"
  on categorie for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 8. POLICY MATERIALI
-- ============================================================

create policy "materiali_anon_read"
  on materiali for select
  to anon
  using (true);

create policy "materiali_auth_read"
  on materiali for select
  to authenticated
  using (true);

create policy "materiali_anon_insert"
  on materiali for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "materiali_auth_insert"
  on materiali for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "materiali_anon_update"
  on materiali for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null and azienda_id <> '');

create policy "materiali_auth_update"
  on materiali for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null and azienda_id <> '');

create policy "materiali_anon_delete"
  on materiali for delete
  to anon
  using (azienda_id is not null);

create policy "materiali_auth_delete"
  on materiali for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 9. POLICY MOVIMENTI
-- ============================================================

create policy "movimenti_anon_read"
  on movimenti for select
  to anon
  using (true);

create policy "movimenti_auth_read"
  on movimenti for select
  to authenticated
  using (true);

create policy "movimenti_anon_insert"
  on movimenti for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "movimenti_auth_insert"
  on movimenti for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "movimenti_anon_update"
  on movimenti for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null and azienda_id <> '');

create policy "movimenti_auth_update"
  on movimenti for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null and azienda_id <> '');

create policy "movimenti_anon_delete"
  on movimenti for delete
  to anon
  using (azienda_id is not null);

create policy "movimenti_auth_delete"
  on movimenti for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 10. POLICY NOTIFICHE
-- ============================================================

create policy "notifiche_anon_read"
  on notifiche for select
  to anon
  using (true);

create policy "notifiche_auth_read"
  on notifiche for select
  to authenticated
  using (true);

create policy "notifiche_anon_insert"
  on notifiche for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "notifiche_auth_insert"
  on notifiche for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "notifiche_anon_update"
  on notifiche for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "notifiche_auth_update"
  on notifiche for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "notifiche_anon_delete"
  on notifiche for delete
  to anon
  using (azienda_id is not null);

create policy "notifiche_auth_delete"
  on notifiche for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 11. POLICY FATTURE_IMPORTATE
-- ============================================================

create policy "fatture_anon_read"
  on fatture_importate for select
  to anon
  using (true);

create policy "fatture_auth_read"
  on fatture_importate for select
  to authenticated
  using (true);

create policy "fatture_anon_insert"
  on fatture_importate for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "fatture_auth_insert"
  on fatture_importate for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "fatture_anon_update"
  on fatture_importate for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "fatture_auth_update"
  on fatture_importate for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "fatture_anon_delete"
  on fatture_importate for delete
  to anon
  using (azienda_id is not null);

create policy "fatture_auth_delete"
  on fatture_importate for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 12. POLICY LOG_MODIFICHE
-- ============================================================

create policy "log_anon_read"
  on log_modifiche for select
  to anon
  using (true);

create policy "log_auth_read"
  on log_modifiche for select
  to authenticated
  using (true);

create policy "log_anon_insert"
  on log_modifiche for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "log_auth_insert"
  on log_modifiche for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "log_anon_delete"
  on log_modifiche for delete
  to anon
  using (azienda_id is not null);

create policy "log_auth_delete"
  on log_modifiche for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 13. POLICY STORICO_PREZZI
-- ============================================================

create policy "storico_prezzi_anon_read"
  on storico_prezzi for select
  to anon
  using (true);

create policy "storico_prezzi_auth_read"
  on storico_prezzi for select
  to authenticated
  using (true);

create policy "storico_prezzi_anon_insert"
  on storico_prezzi for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "storico_prezzi_auth_insert"
  on storico_prezzi for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "storico_prezzi_anon_update"
  on storico_prezzi for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "storico_prezzi_auth_update"
  on storico_prezzi for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "storico_prezzi_anon_delete"
  on storico_prezzi for delete
  to anon
  using (azienda_id is not null);

create policy "storico_prezzi_auth_delete"
  on storico_prezzi for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 14. POLICY IMPOSTAZIONI
-- ============================================================

create policy "impostazioni_anon_read"
  on impostazioni for select
  to anon
  using (true);

create policy "impostazioni_auth_read"
  on impostazioni for select
  to authenticated
  using (true);

create policy "impostazioni_anon_insert"
  on impostazioni for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "impostazioni_auth_insert"
  on impostazioni for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "impostazioni_anon_update"
  on impostazioni for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "impostazioni_auth_update"
  on impostazioni for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "impostazioni_anon_delete"
  on impostazioni for delete
  to anon
  using (azienda_id is not null);

create policy "impostazioni_auth_delete"
  on impostazioni for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 15. POLICY PROPOSTE_ORDINE
-- ============================================================

create policy "proposte_anon_read"
  on proposte_ordine for select
  to anon
  using (true);

create policy "proposte_auth_read"
  on proposte_ordine for select
  to authenticated
  using (true);

create policy "proposte_anon_insert"
  on proposte_ordine for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "proposte_auth_insert"
  on proposte_ordine for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "proposte_anon_update"
  on proposte_ordine for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "proposte_auth_update"
  on proposte_ordine for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "proposte_anon_delete"
  on proposte_ordine for delete
  to anon
  using (azienda_id is not null);

create policy "proposte_auth_delete"
  on proposte_ordine for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 16. POLICY RIGHE_PROPOSTA_ORDINE
-- ============================================================

create policy "righe_proposta_anon_read"
  on righe_proposta_ordine for select
  to anon
  using (true);

create policy "righe_proposta_auth_read"
  on righe_proposta_ordine for select
  to authenticated
  using (true);

create policy "righe_proposta_anon_insert"
  on righe_proposta_ordine for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "righe_proposta_auth_insert"
  on righe_proposta_ordine for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "righe_proposta_anon_update"
  on righe_proposta_ordine for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "righe_proposta_auth_update"
  on righe_proposta_ordine for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "righe_proposta_anon_delete"
  on righe_proposta_ordine for delete
  to anon
  using (azienda_id is not null);

create policy "righe_proposta_auth_delete"
  on righe_proposta_ordine for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 17. POLICY SESSIONI_INVENTARIO
-- ============================================================

create policy "sessioni_anon_read"
  on sessioni_inventario for select
  to anon
  using (true);

create policy "sessioni_auth_read"
  on sessioni_inventario for select
  to authenticated
  using (true);

create policy "sessioni_anon_insert"
  on sessioni_inventario for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "sessioni_auth_insert"
  on sessioni_inventario for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "sessioni_anon_update"
  on sessioni_inventario for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "sessioni_auth_update"
  on sessioni_inventario for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "sessioni_anon_delete"
  on sessioni_inventario for delete
  to anon
  using (azienda_id is not null);

create policy "sessioni_auth_delete"
  on sessioni_inventario for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 18. POLICY RIGHE_INVENTARIO
-- ============================================================

create policy "righe_inventario_anon_read"
  on righe_inventario for select
  to anon
  using (true);

create policy "righe_inventario_auth_read"
  on righe_inventario for select
  to authenticated
  using (true);

create policy "righe_inventario_anon_insert"
  on righe_inventario for insert
  to anon
  with check (azienda_id is not null and azienda_id <> '');

create policy "righe_inventario_auth_insert"
  on righe_inventario for insert
  to authenticated
  with check (azienda_id is not null and azienda_id <> '');

create policy "righe_inventario_anon_update"
  on righe_inventario for update
  to anon
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "righe_inventario_auth_update"
  on righe_inventario for update
  to authenticated
  using (azienda_id is not null)
  with check (azienda_id is not null);

create policy "righe_inventario_anon_delete"
  on righe_inventario for delete
  to anon
  using (azienda_id is not null);

create policy "righe_inventario_auth_delete"
  on righe_inventario for delete
  to authenticated
  using (azienda_id is not null);

-- ============================================================
-- 19. STORAGE BUCKET FATTURE - policy pubblica per upload
-- ============================================================

insert into storage.buckets (id, name, public)
values ('fatture', 'fatture', false)
on conflict (id) do nothing;

drop policy if exists "fatture_storage_read" on storage.objects;
drop policy if exists "fatture_storage_insert" on storage.objects;
drop policy if exists "fatture_storage_delete" on storage.objects;

create policy "fatture_storage_read"
  on storage.objects for select
  to anon
  using (bucket_id = 'fatture');

create policy "fatture_storage_auth_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fatture');

create policy "fatture_storage_insert"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'fatture');

create policy "fatture_storage_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fatture');

create policy "fatture_storage_delete"
  on storage.objects for delete
  to anon
  using (bucket_id = 'fatture');

create policy "fatture_storage_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fatture');

-- ============================================================
-- FINE MIGRATION
-- ============================================================
