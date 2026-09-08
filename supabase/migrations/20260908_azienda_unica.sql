-- ============================================================
-- WorkSpace - Passaggio ad AZIENDA UNICA + area programmatore
-- ------------------------------------------------------------
-- 1. Tabella di configurazione dell'app (codice d'accesso
--    programmatore + modalita' manutenzione)
-- 2. Vista pubblica con il solo stato di manutenzione
-- 3. Pulizia (opzionale) dei dati multi-azienda residui
-- ============================================================

-- ------------------------------------------------------------
-- 1. CONFIGURAZIONE APP
-- ------------------------------------------------------------

create table if not exists configurazione_app (
  id text primary key default 'app',
  codice_accesso_hash text,
  codice_aggiornato_at timestamptz,
  manutenzione_attiva boolean not null default false,
  manutenzione_messaggio text,
  manutenzione_da timestamptz,
  note_supporto text,
  updated_at timestamptz not null default now()
);

insert into configurazione_app (id, manutenzione_attiva)
values ('app', false)
on conflict (id) do nothing;

-- RLS: nessun accesso diretto dal client.
-- Solo la service role (usata da /api/programmer/config) puo' leggere
-- e scrivere questa tabella: l'hash del codice d'accesso non viene
-- mai esposto al browser.
alter table configurazione_app enable row level security;

drop policy if exists "configurazione_app_anon_read" on configurazione_app;
drop policy if exists "configurazione_app_auth_read" on configurazione_app;

-- ------------------------------------------------------------
-- 2. VISTA PUBBLICA: solo lo stato di manutenzione
-- ------------------------------------------------------------

drop view if exists stato_app_pubblico;

create view stato_app_pubblico as
select
  manutenzione_attiva,
  manutenzione_messaggio,
  manutenzione_da,
  updated_at
from configurazione_app
where id = 'app';

grant select on stato_app_pubblico to anon, authenticated;

-- ------------------------------------------------------------
-- 3. AZIENDA UNICA
-- ------------------------------------------------------------

-- L'azienda gestita dall'app resta cl_thermoservice.
update aziende
set
  attiva = true,
  updated_at = now()
where id = 'cl_thermoservice';

-- Recupera eventuali record rimasti senza azienda.
update categorie            set azienda_id = 'cl_thermoservice' where azienda_id is null;
update materiali            set azienda_id = 'cl_thermoservice' where azienda_id is null;
update movimenti            set azienda_id = 'cl_thermoservice' where azienda_id is null;
update notifiche            set azienda_id = 'cl_thermoservice' where azienda_id is null;
update log_modifiche        set azienda_id = 'cl_thermoservice' where azienda_id is null;
update fatture_importate    set azienda_id = 'cl_thermoservice' where azienda_id is null;
update storico_prezzi       set azienda_id = 'cl_thermoservice' where azienda_id is null;
update proposte_ordine      set azienda_id = 'cl_thermoservice' where azienda_id is null;
update righe_proposta_ordine set azienda_id = 'cl_thermoservice' where azienda_id is null;
update sessioni_inventario  set azienda_id = 'cl_thermoservice' where azienda_id is null;
update righe_inventario     set azienda_id = 'cl_thermoservice' where azienda_id is null;
update utenti               set azienda_id = 'cl_thermoservice' where azienda_id is null;
update impostazioni         set azienda_id = 'cl_thermoservice' where azienda_id is null;

-- ------------------------------------------------------------
-- 4. PULIZIA DEI DATI DI ALTRE AZIENDE  (OPZIONALE)
-- ------------------------------------------------------------
-- ATTENZIONE: le istruzioni qui sotto ELIMINANO definitivamente
-- i dati delle aziende di test/demo. Esegui questo blocco solo
-- dopo aver fatto un backup e solo se sei sicura.
-- Togli i commenti per eseguirlo.
--
-- delete from righe_inventario      where azienda_id <> 'cl_thermoservice';
-- delete from sessioni_inventario   where azienda_id <> 'cl_thermoservice';
-- delete from righe_proposta_ordine where azienda_id <> 'cl_thermoservice';
-- delete from proposte_ordine       where azienda_id <> 'cl_thermoservice';
-- delete from storico_prezzi        where azienda_id <> 'cl_thermoservice';
-- delete from fatture_importate     where azienda_id <> 'cl_thermoservice';
-- delete from log_modifiche         where azienda_id <> 'cl_thermoservice';
-- delete from notifiche             where azienda_id <> 'cl_thermoservice';
-- delete from movimenti             where azienda_id <> 'cl_thermoservice';
-- delete from materiali             where azienda_id <> 'cl_thermoservice';
-- delete from categorie             where azienda_id <> 'cl_thermoservice';
-- delete from impostazioni          where azienda_id <> 'cl_thermoservice';
-- delete from utenti                where azienda_id <> 'cl_thermoservice';
-- delete from aziende               where id <> 'cl_thermoservice';

-- ============================================================
-- FINE MIGRATION
-- ============================================================
