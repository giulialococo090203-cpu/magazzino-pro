// ============================================================
// AUTHSTORE.JS - Firebase Auth + profilo utente (azienda unica)
// ------------------------------------------------------------
// Il login richiede solo email e password.
// Non esiste più la selezione dell'azienda: tutti gli utenti
// appartengono all'unica azienda configurata.
// ============================================================

import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '../firebaseClient';
import { normalizeRole, isSuperAdminUser } from './permissions';
import { AZIENDA_ID, AZIENDA_NOME } from '../config/azienda';

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
    fullName,
    role,
    active,
    permissions,

    createdAt: profile.createdAt || profile.created_at || null,
    updatedAt: profile.updatedAt || profile.updated_at || null,
  };
}

async function getSupabaseUserProfile(firebaseUser) {
  if (!firebaseUser) return null;

  const token = await firebaseUser.getIdToken(true);

  const response = await fetch('/api/auth/profile', {
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
      const userRef = doc(firebaseDb, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

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

  getCurrentUser() {
    try {
      const data = localStorage.getItem(CURRENT_USER_KEY);
      return data ? JSON.parse(data) : null;
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
