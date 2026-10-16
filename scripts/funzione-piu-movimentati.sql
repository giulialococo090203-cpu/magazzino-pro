-- Materiali più movimentati: il conto lo fa il database (16/10/2026).
-- "security invoker": valgono le stesse regole di accesso delle tabelle.
create or replace function public.movimenti_piu_movimentati(giorni int default 30, limite int default 10)
returns table (materiale_id uuid, codice text, descrizione text, totale numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select m.materiale_id::uuid, mat.codice::text, mat.descrizione::text, sum(abs(m.quantita))::numeric as totale
  from public.movimenti m
  left join public.materiali mat on mat.id = m.materiale_id
  where m.data_movimento >= (current_date - giorni)
  group by m.materiale_id, mat.codice, mat.descrizione
  order by totale desc
  limit limite;
$$;

revoke all on function public.movimenti_piu_movimentati(int, int) from public, anon;
grant execute on function public.movimenti_piu_movimentati(int, int) to authenticated;

select * from public.movimenti_piu_movimentati(30, 8);
