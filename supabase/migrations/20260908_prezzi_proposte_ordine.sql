-- ============================================================
-- WorkSpace - Prezzi nelle righe delle proposte d'ordine
-- ------------------------------------------------------------
-- Le righe salvate contenevano solo le quantita': senza il prezzo
-- l'archivio non puo' ristampare l'ordine inviato al fornitore.
-- Due colonne, nessun dato esistente viene toccato.
-- ============================================================

alter table righe_proposta_ordine add column if not exists prezzo_unitario numeric(12, 4);
alter table righe_proposta_ordine add column if not exists sconto_riga numeric(5, 2);

-- Verifica
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'righe_proposta_ordine'
  and column_name in ('prezzo_unitario', 'sconto_riga');
