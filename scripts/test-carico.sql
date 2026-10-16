-- ============================================================
-- DATI DI PROVA PER I TEST DI VELOCITA' (16/10/2026)
-- Crea un magazzino "pesante" finto:
--   40 categorie · 20.000 materiali · 150.000 movimenti
--   3.000 notifiche · 20.000 righe di registro modifiche
-- Tutto è marcato come prova (codici TEST-xxxxxx, note e
-- descrizioni "DATI_DI_TEST"): si toglie con test-pulizia.sql
-- senza toccare nient'altro.
-- ============================================================

-- Categorie
insert into public.categorie (nome, descrizione, azienda_id)
select '[TEST] ' || n, 'DATI_DI_TEST', 'cl_thermoservice'
from unnest(array['Caldaie','Bruciatori','Pompe','Valvole','Sensori','Elettrodi','Ventilatori','Scambiatori','Vasi espansione','Termostati','Centraline','Guarnizioni','Raccordi','Tubi','Flessibili','Cavi','Schede elettroniche','Pressostati','Accenditori','Filtri','Condizionatori','Pompe di calore','Scaldabagni','Radiatori','Collettori','Rubinetteria','Isolanti','Fumisteria','Staffe','Viteria','Detergenti','Additivi','Contatori','Manometri','Termometri','Elettrovalvole','Motori','Trasformatori','Fusibili']) as n
where not exists (select 1 from public.categorie c where c.nome = '[TEST] ' || n);

-- Materiali
with cat as (
  select array_agg(id) ids from public.categorie where descrizione = 'DATI_DI_TEST'
), base as (
  select g,
    (array['POMPA','VALVOLA','SENSORE','ELETTRODO','VENTILATORE','SCAMBIATORE','VASO ESPANSIONE','TERMOSTATO','CENTRALINA','GUARNIZIONE','RACCORDO','TUBO','FLESSIBILE','CAVO','SCHEDA','PRESSOSTATO','ACCENDITORE','FILTRO','MANOMETRO','ELETTROVALVOLA','MOTORE','TRASFORMATORE','CONDOTTO FUMI','MANOPOLA','IDROMETRO','BRUCIATORE','KIT CONVERSIONE GPL'])[1 + (random()*26)::int] as nome,
    (array['DI SICUREZZA','3 BAR','D27MM','1/2"','3/4"','24 KW','230V','NERA','INOX','ERP','DI PORTATA','TERMOMETRICO','A CONDENSAZIONE','UNIVERSALE','COMPLETO','RICAMBIO ORIGINALE','PER CALDAIA MURALE','ALTA EFFICIENZA'])[1 + (random()*17)::int] as agg,
    case when random() < 0.06 then 0 else (random()*120)::int end as q,
    (random()*15)::int as s
  from generate_series(1, 20000) g
)
insert into public.materiali
  (codice, descrizione, marca, quantita, categoria_id, unita_misura, soglia_minima,
   stato_disponibilita, posizione_scaffale, fornitore, note, prezzo_netto, azienda_id)
select
  'TEST-' || lpad(g::text, 6, '0'),
  nome || ' ' || agg,
  (array['Ariston SpA','Bosch Professional','Caleffi','Vaillant','Baxi','Immergas','Riello','Beretta','Ferroli','Viessmann','KPL','Grundfos','Wilo','Honeywell','Siemens'])[1 + (random()*14)::int],
  q,
  cat.ids[1 + floor(random()*array_length(cat.ids,1))::int],
  case when random() < 0.8 then 'PZ' else 'ST' end,
  s,
  case when q <= 0 then 'esaurito' when q <= s then 'sotto_soglia' else 'disponibile' end,
  (array['A','B','C','D','E','F'])[1 + (random()*5)::int] || '-' || lpad((1 + (random()*39)::int)::text, 2, '0'),
  (array['Termoidraulica Sud','Centro Ricambi Nord','Caleffi Distribuzione','Bosch Professional','Ariston SpA','EdilPro Supply','ClimaService Parts','Fantini Cosmi Service','ElettroLinea Group','Gewiss Impianti','Fischer Edilizia','Cantieri Supply Toscana','Ferramenta Centrale','Btcino Distribuzione','Idrotherm Palermo'])[1 + (random()*14)::int],
  'DATI_DI_TEST',
  round((random()*900)::numeric, 2),
  'cl_thermoservice'
from base, cat;

-- Movimenti (ultimi 12 mesi)
with m as (
  select array_agg(id) ids from public.materiali where note = 'DATI_DI_TEST'
)
insert into public.movimenti
  (materiale_id, tipo_movimento, quantita, motivo, note, data_movimento,
   operatore_nome, cliente_nome, previous_qty, new_qty, azienda_id)
select
  m.ids[1 + floor(random()*array_length(m.ids,1))::int],
  (array['entrata','uscita','uscita','reintegro','rettifica'])[1 + (random()*4)::int],
  1 + (random()*19)::int,
  (array['uso_interno','cliente','reso','manutenzione','altro'])[1 + (random()*4)::int],
  'DATI_DI_TEST',
  now() - (random() * interval '365 days'),
  (array['Roberto Lo Coco','Operatore Test 1','Operatore Test 2','Operatore Test 3'])[1 + (random()*3)::int],
  case when random() < 0.3 then 'Cliente prova ' || (1 + (random()*200)::int) else null end,
  (random()*100)::int,
  (random()*100)::int,
  'cl_thermoservice'
from m, generate_series(1, 150000);

-- Notifiche (materiali sotto soglia / esauriti)
insert into public.notifiche (materiale_id, tipo, messaggio, letta, azienda_id)
select id,
  case when stato_disponibilita = 'esaurito' then 'esaurito' else 'sotto_soglia' end,
  '[TEST] ' || codice || ' - ' || descrizione || ': ' || upper(replace(stato_disponibilita, '_', ' ')),
  random() < 0.5,
  'cl_thermoservice'
from public.materiali
where note = 'DATI_DI_TEST' and stato_disponibilita <> 'disponibile'
limit 3000;

-- Registro modifiche
insert into public.log_modifiche (entita, azione, descrizione, azienda_id)
select (array['materiale','movimento','categoria','fattura'])[1 + (random()*3)::int],
  (array['creazione','modifica','eliminazione'])[1 + (random()*2)::int],
  'DATI_DI_TEST - operazione di prova n. ' || g,
  'cl_thermoservice'
from generate_series(1, 20000) g;

-- Riepilogo
select 'materiali' tabella, count(*) from public.materiali where note = 'DATI_DI_TEST'
union all select 'movimenti', count(*) from public.movimenti where note = 'DATI_DI_TEST'
union all select 'categorie', count(*) from public.categorie where descrizione = 'DATI_DI_TEST'
union all select 'notifiche', count(*) from public.notifiche where messaggio like '[TEST]%'
union all select 'log_modifiche', count(*) from public.log_modifiche where descrizione like 'DATI_DI_TEST%';
