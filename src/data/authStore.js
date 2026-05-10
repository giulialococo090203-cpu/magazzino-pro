// ============================================================
// AUTHSTORE.JS - Firebase Auth + profilo utente Firestore
// ============================================================

import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '../firebaseClient';
import { normalizeRole } from './permissions';

const CURRENT_USER_KEY = 'wm_current_user';
const SELECTED_COMPANY_KEY = 'wm_selected_company';

// Per ora abbiamo una sola azienda iniziale.
// Quando aggiungeremo altre aziende, questo valore verrà sempre letto dal profilo utente.
const DEFAULT_COMPANY_ID = 'cl_thermoservice';

function readString(value) {
  return String(value || '').trim();
}

function readSelectedCompany() {
  try {
    const raw = localStorage.getItem(SELECTED_COMPANY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(SELECTED_COMPANY_KEY);
    return null;
  }
}

function isProgrammerCompany(company = {}) {
  const id = String(company.id || '').trim().toLowerCase();
  const code = String(company.code || company.codice || '').trim().toUpperCase();

  return id === 'programmatore' || code === 'PROGRAMMATORE';
}

function isSuperAdminUser(user = {}) {
  const role = String(user.role || '').trim().toLowerCase();
  const email = String(user.email || '').trim().toLowerCase();

  return (
    role === 'sviluppatore' ||
    role === 'super_admin' ||
    role === 'admin_tecnico' ||
    email === 'giulia@gmail.com'
  );
}

function getCompanyIdFromProfile(profile = {}) {
  return (
    readString(profile.companyId) ||
    readString(profile.company_id) ||
    readString(profile.company) ||
    readString(profile.aziendaId) ||
    readString(profile.azienda_id) ||
    readString(profile.idAzienda) ||
    readString(profile.companyID)
  );
}

function normalizeUserProfile(firebaseUser, profile = {}) {
  const companyId = getCompanyIdFromProfile(profile) || DEFAULT_COMPANY_ID;

  const email = readString(profile.email) || readString(firebaseUser.email);

  const fullName =
    readString(profile.fullName) ||
    readString(profile.nome) ||
    readString(profile.name) ||
    readString(firebaseUser.displayName) ||
    email ||
    'Utente';

  const username =
    readString(profile.username) ||
    email ||
    firebaseUser.uid;

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
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    authUid: firebaseUser.uid,

    companyId,
    company_id: companyId,

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

export const authStore = {
  async authenticate(email, password) {
    const cleanEmail = readString(email);

    if (!cleanEmail || !password) {
      throw new Error('Email e password sono obbligatorie.');
    }

    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      cleanEmail,
      password
    );

    const firebaseUser = credential.user;

    const userRef = doc(firebaseDb, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await signOut(firebaseAuth);
      localStorage.removeItem(CURRENT_USER_KEY);

      throw new Error(
        `Utente autenticato, ma profilo applicazione non trovato in Firestore. UID: ${firebaseUser.uid}`
      );
    }

    const profile = userSnap.data() || {};

    console.log('Profilo utente Firestore:', {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      profile,
      companyIdLetto: getCompanyIdFromProfile(profile),
    });

    const appUser = normalizeUserProfile(firebaseUser, profile);

    if (!appUser.active) {
      await signOut(firebaseAuth);
      localStorage.removeItem(CURRENT_USER_KEY);

      throw new Error('Account non attivo.');
    }

    const selectedCompany = readSelectedCompany();

    if (isProgrammerCompany(selectedCompany)) {
      if (!isSuperAdminUser(appUser)) {
        await signOut(firebaseAuth);
        localStorage.removeItem(CURRENT_USER_KEY);

        throw new Error('Accesso programmatore non autorizzato.');
      }
    } else if (selectedCompany?.id && appUser.companyId !== selectedCompany.id) {
      await signOut(firebaseAuth);
      localStorage.removeItem(CURRENT_USER_KEY);

      throw new Error('Questo utente non appartiene all’azienda selezionata.');
    }

    const userWithCompany = {
      ...appUser,
      selectedCompany: selectedCompany || null,
      programmerMode: isProgrammerCompany(selectedCompany),
    };

    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithCompany));

    return userWithCompany;
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
    localStorage.removeItem(SELECTED_COMPANY_KEY);

    try {
      await signOut(firebaseAuth);
    } catch {
      // Non bloccare il logout locale se Firebase non risponde.
    }
  },
};