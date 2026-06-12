// ============================================================
// SUPABASECLIENT.JS
//
// ARCHITETTURA AUTH:
//   Firebase Auth gestisce l'autenticazione degli utenti.
//   Supabase usa la ANON KEY standard per tutte le query.
//   L'isolamento dei dati è garantito dall'azienda_id nelle
//   policy RLS e nei filtri .eq('azienda_id', ...) nelle query.
//
//   Non si usa accessToken con Firebase ID Token perché
//   Supabase Third-Party Auth con Firebase non è configurato
//   e causerebbe 401 su ogni richiesta.
//
//   Le operazioni privilegiate (crea utente, crea/elimina
//   azienda) usano le API server-side Vercel con Firebase
//   Admin SDK + service_role ESCLUSIVAMENTE lato server.
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configurazione Supabase mancante: controlla VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
