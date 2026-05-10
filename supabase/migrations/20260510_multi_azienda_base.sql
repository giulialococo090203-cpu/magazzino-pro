-- ============================================================
-- WorkSpace - Multi azienda base
-- Dati beta attuali assegnati a THERMOSERVICE
-- ============================================================

create table if not exists aziende (
  id text primary key,
  nome text not null,
  codice text unique not null,
  logo_url text,
  attiva boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into aziende (id, nome, codice, attiva, note)
values (
  'cl_thermoservice',
  'Thermoservice',
  'THERMOSERVICE',
  true,
  'Azienda principale associata al dataset beta/stress test iniziale.'
)
on conflict (id) do update set
  nome = excluded.nome,
  codice = excluded.codice,
  attiva = excluded.attiva,
  updated_at = now();

alter table categorie add column if not exists azienda_id text;
alter table materiali add column if not exists azienda_id text;
alter table movimenti add column if not exists azienda_id text;
alter table notifiche add column if not exists azienda_id text;
alter table log_modifiche add column if not exists azienda_id text;
alter table fatture_importate add column if not exists azienda_id text;
alter table storico_prezzi add column if not exists azienda_id text;
alter table proposte_ordine add column if not exists azienda_id text;
alter table righe_proposta_ordine add column if not exists azienda_id text;
alter table sessioni_inventario add column if not exists azienda_id text;
alter table righe_inventario add column if not exists azienda_id text;
alter table utenti add column if not exists azienda_id text;
alter table impostazioni add column if not exists azienda_id text;

update categorie set azienda_id = 'cl_thermoservice' where azienda_id is null;
update materiali set azienda_id = 'cl_thermoservice' where azienda_id is null;
update movimenti set azienda_id = 'cl_thermoservice' where azienda_id is null;
update notifiche set azienda_id = 'cl_thermoservice' where azienda_id is null;
update log_modifiche set azienda_id = 'cl_thermoservice' where azienda_id is null;
update fatture_importate set azienda_id = 'cl_thermoservice' where azienda_id is null;
update storico_prezzi set azienda_id = 'cl_thermoservice' where azienda_id is null;
update proposte_ordine set azienda_id = 'cl_thermoservice' where azienda_id is null;
update righe_proposta_ordine set azienda_id = 'cl_thermoservice' where azienda_id is null;
update sessioni_inventario set azienda_id = 'cl_thermoservice' where azienda_id is null;
update righe_inventario set azienda_id = 'cl_thermoservice' where azienda_id is null;
update utenti set azienda_id = 'cl_thermoservice' where azienda_id is null;
update impostazioni set azienda_id = 'cl_thermoservice' where azienda_id is null;

alter table categorie alter column azienda_id set default 'cl_thermoservice';
alter table materiali alter column azienda_id set default 'cl_thermoservice';
alter table movimenti alter column azienda_id set default 'cl_thermoservice';
alter table notifiche alter column azienda_id set default 'cl_thermoservice';
alter table log_modifiche alter column azienda_id set default 'cl_thermoservice';
alter table fatture_importate alter column azienda_id set default 'cl_thermoservice';
alter table storico_prezzi alter column azienda_id set default 'cl_thermoservice';
alter table proposte_ordine alter column azienda_id set default 'cl_thermoservice';
alter table righe_proposta_ordine alter column azienda_id set default 'cl_thermoservice';
alter table sessioni_inventario alter column azienda_id set default 'cl_thermoservice';
alter table righe_inventario alter column azienda_id set default 'cl_thermoservice';
alter table utenti alter column azienda_id set default 'cl_thermoservice';
alter table impostazioni alter column azienda_id set default 'cl_thermoservice';

create index if not exists idx_categorie_azienda_nome on categorie (azienda_id, nome);
create index if not exists idx_materiali_azienda_codice on materiali (azienda_id, codice);
create index if not exists idx_materiali_azienda_categoria on materiali (azienda_id, categoria_id);
create index if not exists idx_materiali_azienda_stato on materiali (azienda_id, stato_disponibilita);
create index if not exists idx_materiali_azienda_fornitore on materiali (azienda_id, fornitore);

create index if not exists idx_movimenti_azienda_data on movimenti (azienda_id, data_movimento desc);
create index if not exists idx_movimenti_azienda_materiale on movimenti (azienda_id, materiale_id);
create index if not exists idx_movimenti_azienda_tipo on movimenti (azienda_id, tipo_movimento);
create index if not exists idx_movimenti_azienda_operatore on movimenti (azienda_id, operatore_nome);
create index if not exists idx_movimenti_azienda_cliente on movimenti (azienda_id, cliente_nome);

create index if not exists idx_fatture_azienda_created on fatture_importate (azienda_id, created_at desc);
create index if not exists idx_fatture_azienda_fornitore on fatture_importate (azienda_id, fornitore);

create index if not exists idx_storico_prezzi_azienda_materiale on storico_prezzi (azienda_id, materiale_id);
create index if not exists idx_storico_prezzi_azienda_fornitore on storico_prezzi (azienda_id, fornitore);

create index if not exists idx_notifiche_azienda_letta on notifiche (azienda_id, letta, created_at desc);
create index if not exists idx_log_azienda_created on log_modifiche (azienda_id, created_at desc);

create index if not exists idx_proposte_azienda_created on proposte_ordine (azienda_id, created_at desc);
create index if not exists idx_righe_proposte_azienda_proposta on righe_proposta_ordine (azienda_id, proposta_id);

create index if not exists idx_utenti_azienda_email on utenti (azienda_id, email);
create index if not exists idx_utenti_azienda_username on utenti (azienda_id, username);
create index if not exists idx_impostazioni_azienda on impostazioni (azienda_id);
