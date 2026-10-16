-- ============================================================
-- OTTIMIZZAZIONE REGOLE DI ACCESSO (RLS) - 16/10/2026
-- Le regole chiamavano is_programmer() e current_company_id()
-- per OGNI riga letta (es. 150.000 volte su movimenti).
-- Racchiudendole in (select ...) Postgres le calcola UNA volta
-- per richiesta. La logica di sicurezza resta identica.
-- ============================================================
do $$
declare
  p record;
  nuova_using text;
  nuova_check text;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') || coalesce(with_check,'')) ~ '(is_programmer|current_company_id)\(\)'
  loop
    nuova_using := regexp_replace(
      regexp_replace(p.qual, '(?<!SELECT )(?<!select )is_programmer\(\)', '(select is_programmer())', 'g'),
      '(?<!SELECT )(?<!select )current_company_id\(\)', '(select current_company_id())', 'g');
    nuova_check := regexp_replace(
      regexp_replace(p.with_check, '(?<!SELECT )(?<!select )is_programmer\(\)', '(select is_programmer())', 'g'),
      '(?<!SELECT )(?<!select )current_company_id\(\)', '(select current_company_id())', 'g');

    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if nuova_using is not null then sql := sql || ' using (' || nuova_using || ')'; end if;
    if nuova_check is not null then sql := sql || ' with check (' || nuova_check || ')'; end if;
    execute sql;
  end loop;
end $$;

-- Controllo: tutte le regole devono ora usare (select ...)
select tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and (coalesce(qual,'') || coalesce(with_check,'')) ~ '(is_programmer|current_company_id)'
order by 1, 2;
