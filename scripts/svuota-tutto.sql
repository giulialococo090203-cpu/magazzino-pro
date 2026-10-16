-- ============================================================
-- SVUOTA TUTTO — riporta WorkSpace a vergine (16/10/2026)
-- Cancella TUTTI i dati del magazzino. Non si può annullare.
-- Restano: gli account (tabella utenti) e la configurazione
-- dell'app (codice d'accesso programmatore, manutenzione),
-- altrimenti nessuno potrebbe più entrare.
-- I file PDF delle fatture stanno nello Storage (bucket "fatture"):
-- si svuotano a parte da Storage › fatture › Empty bucket.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'righe_inventario',
    'sessioni_inventario',
    'righe_proposta_ordine',
    'proposte_ordine',
    'storico_prezzi',
    'fatture_importate',
    'log_modifiche',
    'notifiche',
    'movimenti',
    'materiali',
    'categorie',
    'fornitori',
    'impostazioni'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
      raise notice 'svuotata: %', t;
    end if;
  end loop;
end $$;

-- Controllo: tutte le righe devono risultare a zero.
select 'materiali' as tabella, count(*) from public.materiali
union all select 'movimenti', count(*) from public.movimenti
union all select 'categorie', count(*) from public.categorie
union all select 'fatture_importate', count(*) from public.fatture_importate
union all select 'notifiche', count(*) from public.notifiche
union all select 'proposte_ordine', count(*) from public.proposte_ordine;
