-- ============================================================
-- WorkSpace - CONTROLLO IDENTITA' DELLA SESSIONE
-- ------------------------------------------------------------
-- A COSA SERVE
--   Quando l'app apre una pagina, Supabase deve capire CHI sta
--   chiedendo i dati. Lo capisce leggendo il token di Firebase.
--   Se in quel token manca l'informazione "role", Supabase tratta
--   la richiesta come se arrivasse da un visitatore anonimo:
--   non da errore, risponde con elenchi vuoti.
--
--   E' il motivo per cui la giacenza appariva a zero pur essendo
--   dentro l'applicazione.
--
--   Questa funzione risponde alla domanda "chi sono, secondo il
--   database?" e viene mostrata nella diagnostica della console
--   programmatore, cosi' il problema si vede subito invece di
--   sembrare un magazzino vuoto.
--
-- SICUREZZA
--   Restituisce solo cio' che il chiamante gia' sa di se stesso.
--   Nessun dato di altri utenti.
-- ============================================================

create or replace function public.identita_sessione()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'ruolo_database',   current_user,
    'ruolo_token',      coalesce(auth.jwt() ->> 'role', ''),
    'email_token',      coalesce(auth.jwt() ->> 'email', ''),
    'token_presente',   (auth.jwt() is not null),
    'e_programmatore',  public.is_programmer(),
    'azienda_risolta',  coalesce(public.current_company_id(), '')
  );
$fn$;

comment on function public.identita_sessione() is
  'Diagnostica: come il database vede la sessione che sta chiamando.';

grant execute on function public.identita_sessione() to anon, authenticated;


-- ------------------------------------------------------------
-- VERIFICA (eseguita come postgres: mostra il caso "senza token")
-- ------------------------------------------------------------

select public.identita_sessione();
