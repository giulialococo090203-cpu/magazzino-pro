-- ============================================================
-- TOGLIE I DATI DI PROVA creati da test-carico.sql
-- Cancella solo ciò che è marcato come prova (TEST-xxxxxx,
-- "DATI_DI_TEST", "[TEST]"). Il resto del magazzino resta.
-- ============================================================

delete from public.notifiche
where messaggio like '[TEST]%'
   or materiale_id in (select id from public.materiali where note = 'DATI_DI_TEST');

delete from public.movimenti
where note = 'DATI_DI_TEST'
   or materiale_id in (select id from public.materiali where note = 'DATI_DI_TEST');

delete from public.righe_proposta_ordine
where materiale_id in (select id from public.materiali where note = 'DATI_DI_TEST');

delete from public.righe_inventario
where materiale_id in (select id from public.materiali where note = 'DATI_DI_TEST');

delete from public.materiali where note = 'DATI_DI_TEST' or codice like 'TEST-%';

delete from public.categorie where descrizione = 'DATI_DI_TEST' or nome like '[TEST]%';

delete from public.log_modifiche where descrizione like 'DATI_DI_TEST%';

select 'materiali di prova rimasti' controllo, count(*) from public.materiali where codice like 'TEST-%'
union all select 'movimenti di prova rimasti', count(*) from public.movimenti where note = 'DATI_DI_TEST';
