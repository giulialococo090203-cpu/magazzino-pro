// ============================================================
// SUPABASECLIENT.JS
//
// Firebase Auth gestisce il login.
// Ogni richiesta Supabase riceve esplicitamente il Firebase
// ID Token nell'header Authorization.
//
// Questo permette alle policy RLS di leggere:
//   role: "authenticated"
//   azienda_id
//   app_role
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { firebaseAuth } from './firebaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configurazione Supabase mancante: controlla VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  );
}

const nativeFetch = globalThis.fetch.bind(globalThis);

async function firebaseAuthenticatedFetch(input, init = {}) {
  const firebaseUser = firebaseAuth.currentUser;

  let token = null;

  if (firebaseUser) {
    try {
      token = await firebaseUser.getIdToken();
    } catch (error) {
      console.error(
        'Impossibile recuperare il token Firebase per Supabase:',
        error
      );
    }
  }

  const sourceHeaders =
    init.headers ||
    (input instanceof Request ? input.headers : undefined);

  const headers = new Headers(sourceHeaders);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${supabaseAnonKey}`);
  }

  return nativeFetch(input, {
    ...init,
    headers,
  });
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    global: {
      fetch: firebaseAuthenticatedFetch,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
