// ============================================================
// AUTHSTORE.JS - Firebase Auth + profilo utente (azienda unica)
// ------------------------------------------------------------
// Il login richiede solo email e password.
// Non esiste più la selezione dell'azienda: tutti gli utenti
// appartengono all'unica azienda configurata.
// ============================================================

import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, caricaFirestore } from '../firebaseClient';
import { normalizeRole, isSuperAdminUser } from './permissions';
import { AZIENDA_ID, AZIENDA_NOME } from '../config/azienda';
import { nomeProprio } from '../utils/nomi';

const CURRENT_USER_KEY = 'wm_current_user';

// Chiavi di sessioni precedenti (multi-azienda) da ripulire.
const LEGACY_KEYS = ['wm_selected_company'];

function clearLegacyKeys() {
  LEGACY_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignora
    }
  });
}

/**
 * Promessa che si rifiuta dopo `ms` millisecondi: evita che una
 * richiesta senza risposta lasci il login bloccato per sempre.
 */
function conLimiteDiTempo(promessa, ms, messaggio) {
  let timer;

  const scadenza = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(messaggio)), ms);
  });

  return Promise.race([promessa, scadenza]).finally(() => clearTimeout(timer));
}

function readString(value) {
  return String(value || '').trim();
}

function normalizeUserProfile(firebaseUser, profile = {}) {
  const email = readString(profile.email) || readString(firebaseUser.email);

  const fullName =
    readString(profile.fullName) ||
    readString(profile.nome) ||
    readString(profile.name) ||
    readString(firebaseUser.displayName) ||
    email ||
    'Utente';

  const username = readString(profile.username) || email || firebaseUser.uid;

  const role = normalizeRole(profile.role || profile.ruolo || 'operaio');

  const active =
    profile.active !== undefined
      ? Boolean(profile.active)
      : profile.attivo !== undefined
        ? Boolean(profile.attivo)
        : true;

  const permissions =
    profile.permissions && typeof profile.permissions === 'object'
      ? profile.permissions
      : profile.permessi && typeof profile.permessi === 'object'
        ? profile.permessi
        : {};

  return {
    id: profile.id || firebaseUser.uid,
    uid: firebaseUser.uid,
    authUid: firebaseUser.uid,

    companyId: AZIENDA_ID,
    company_id: AZIENDA_ID,
    azienda_id: AZIENDA_ID,
    companyName: AZIENDA_NOME,

    username,
    email,
    // Iniziali maiuscole, anche se il nome è stato salvato tutto minuscolo.
    fullName: nomeProprio(fullName),
    role,
    active,
    permissions,

    createdAt: profile.createdAt || profile.created_at || null,
    updatedAt: profile.updatedAt || profile.updated_at || null,
  };
}

async function fetchConLimite(url, opzioni = {}, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, { ...opzioni, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getSupabaseUserProfile(firebaseUser) {
  if (!firebaseUser) return null;

  const token = await firebaseUser.getIdToken(true);

  const response = await fetchConLimite('/api/auth/profile', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId: AZIENDA_ID }),
  });

  const responseText = await response.text();

  let payload = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    console.warn(
      'Profilo Supabase non leggibile tramite API protetta:',
      payload?.message || responseText
    );

    return null;
  }

  return payload?.profile || null;
}

export const authStore = {
  async authenticate(email, password) {
    const cleanEmail = readString(email);

    if (!cleanEmail || !password) {
      throw new Error('Email e password sono obbligatorie.');
    }

    clearLegacyKeys();

    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      cleanEmail,
      password
    );

    const firebaseUser = credential.user;

    let profile = null;

    try {
      // Se Firestore non risponde entro 6 secondi si passa al profilo
      // su Supabase invece di lasciare il login in attesa.
      const userSnap = await conLimiteDiTempo(
        caricaFirestore().then(({ db, doc, getDoc }) =>
          getDoc(doc(db, 'users', firebaseUser.uid))
        ),
        6000,
        'Firestore non ha risposto in tempo'
      );

      if (userSnap.exists()) {
        profile = userSnap.data() || {};
      }
    } catch (error) {
      console.warn('Profilo Firestore non leggibile:', error);
    }

    if (!profile) {
      profile = await getSupabaseUserProfile(firebaseUser);
    }

    if (!profile) {
      await signOut(firebaseAuth);
      localStorage.removeItem(CURRENT_USER_KEY);

      throw new Error(
        `Utente autenticato, ma profilo applicazione non trovato. UID: ${firebaseUser.uid}`
      );
    }

    const appUser = normalizeUserProfile(firebaseUser, profile);

    if (!appUser.active) {
      await signOut(firebaseAuth);
      localStorage.removeItem(CURRENT_USER_KEY);

      throw new Error('Account non attivo.');
    }

    const finalUser = {
      ...appUser,
      isProgrammer: isSuperAdminUser(appUser),
    };

    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(finalUser));

    return finalUser;
  },

  /**
   * Controlla che la sessione Firebase esista ancora.
   *
   * L'utente salvato nel browser da solo non basta: se la sessione
   * Firebase e' scaduta o e' stata cancellata (Safari, ad esempio,
   * svuota i dati dei siti non aperti da qualche giorno) l'app si apriva
   * lo stesso, ma Supabase rispondeva come a un visitatore anonimo e
   * tutte le pagine restavano vuote, senza nessun messaggio.
   *
   * Restituisce 'valida', 'assente' (bisogna rifare il login) oppure
   * 'sconosciuta' se Firebase non risponde (rete lenta): in quel caso
   * non si butta fuori nessuno.
   */
  verificaSessione(utenteSalvato, timeoutMs = 10000) {
    return new Promise((resolve) => {
      let concluso = false;
      let smetti = () => {};

      const concludi = (esito) => {
        if (concluso) return;
        concluso = true;
        clearTimeout(timer);
        setTimeout(() => smetti(), 0);
        resolve(esito);
      };

      const timer = setTimeout(() => concludi('sconosciuta'), timeoutMs);

      smetti = onAuthStateChanged(
        firebaseAuth,
        (firebaseUser) => {
          if (!firebaseUser) {
            concludi('assente');
            return;
          }

          const uidSalvato = utenteSalvato?.authUid || utenteSalvato?.uid;

          if (uidSalvato && uidSalvato !== firebaseUser.uid) {
            concludi('assente');
            return;
          }

          concludi('valida');
        },
        () => concludi('sconosciuta')
      );
    });
  },

  getCurrentUser() {
    try {
      const data = localStorage.getItem(CURRENT_USER_KEY);
      const utente = data ? JSON.parse(data) : null;

      // Sessioni salvate prima della correzione: il nome si sistema qui.
      if (utente?.fullName) utente.fullName = nomeProprio(utente.fullName);

      return utente;
    } catch {
      localStorage.removeItem(CURRENT_USER_KEY);
      return null;
    }
  },

  setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
      return;
    }

    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  },

  async logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
    clearLegacyKeys();

    try {
      sessionStorage.removeItem('wm_programmer_unlocked');
    } catch {
      // ignora
    }

    try {
      await signOut(firebaseAuth);
    } catch {
      // Non bloccare il logout locale se Firebase non risponde.
    }
  },
};
