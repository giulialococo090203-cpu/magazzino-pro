import { createClient } from '@supabase/supabase-js';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from './firebaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configurazione Supabase mancante.');
}

const nativeFetch = globalThis.fetch.bind(globalThis);

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
          resolve(user);
        },
        (error) => {
          console.error('Errore inizializzazione Firebase Auth:', error);
          unsubscribe();
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
