import { createClient } from '@supabase/supabase-js';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from './firebaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configurazione Supabase mancante.');
}

const nativeFetch = globalThis.fetch.bind(globalThis);

const LIMITE_LETTURA_MS = 30000;

/*
 * Contatore che aumenta a ogni scrittura sul database (inserimento,
 * modifica, cancellazione, caricamento file). Le letture memorizzate
 * in store.js lo usano per sapere quando i dati vanno riletti.
 */
let versioneDatiCorrente = 0;

export function versioneDati() {
  return versioneDatiCorrente;
}

export function segnaDatiModificati() {
  versioneDatiCorrente += 1;
}

let firebaseAuthReadyPromise = null;

function waitForFirebaseAuthReady() {
  if (firebaseAuth.currentUser) {
    return Promise.resolve(firebaseAuth.currentUser);
  }

  if (!firebaseAuthReadyPromise) {
    firebaseAuthReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(
        firebaseAuth,
        (user) => {
          unsubscribe();
          // Se il primo stato arriva "vuoto" non lo consideriamo
          // definitivo: la sessione potrebbe essere ancora in ripristino
          // e altrimenti resteremmo senza token per tutta la visita.
          if (!user) {
            firebaseAuthReadyPromise = null;
          }

          resolve(user);
        },
        (error) => {
          console.error('Errore inizializzazione Firebase Auth:', error);
          unsubscribe();
          firebaseAuthReadyPromise = null;
          resolve(null);
        }
      );
    });
  }

  return firebaseAuthReadyPromise;
}

async function getFirebaseToken() {
  const user = firebaseAuth.currentUser || await waitForFirebaseAuthReady();

  if (!user) {
    return null;
  }

  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Errore recupero token Firebase:', error);
    return null;
  }
}

async function firebaseAuthenticatedFetch(input, init = {}) {
  const token = await getFirebaseToken();

  const sourceHeaders =
    init.headers ||
    (input instanceof Request ? input.headers : undefined);

  const headers = new Headers(sourceHeaders);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${supabaseAnonKey}`);
  }

  const url = typeof input === 'string' ? input : input?.url || String(input);
  const method = String(init.method || 'GET').toUpperCase();

  /*
   * Le letture dal database non possono restare in attesa per sempre:
   * con la rete del cellulare instabile la pagina restava su
   * "Caricamento..." senza mai finire. Dopo 30 secondi la richiesta
   * viene interrotta e la pagina puo' mostrare l'errore o riprovare.
   * Caricamenti di file e scritture non hanno questo limite.
   */
  const lettura = (method === 'GET' || method === 'HEAD') && url.includes('/rest/v1/');

  if (method !== 'GET' && method !== 'HEAD') {
    segnaDatiModificati();
  }

  if (!lettura || init.signal) {
    return nativeFetch(input, {
      ...init,
      headers,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITE_LETTURA_MS);

  try {
    return await nativeFetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
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
