// ============================================================
// AUTHSTORE.JS - Firebase Auth + profilo utente Firestore/Supabase
// ============================================================

import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '../firebaseClient';
import { supabase } from '../supabaseClient';
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

async function getSupabaseUserProfile(firebaseUser) {
  if (!firebaseUser) return null;

  const token = await firebaseUser.getIdToken(true);
  const selectedCompany = readSelectedCompany();
  const companyId = readString(
    selectedCompany?.id ||
    selectedCompany?.companyId ||
    selectedCompany?.company_id
  );

  const response = await fetch('/api/auth/profile', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId }),
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

async function getSupabaseCompanyProfile(companyId) {
  const cleanCompanyId = readString(companyId);

  if (!cleanCompanyId) return null;

  const { data, error } = await supabase
    .from('aziende')
    .select('id, nome, codice, piano, attiva, stato_abbonamento')
    .eq('id', cleanCompanyId)
    .maybeSingle();

  if (error) {
    console.warn('Profilo azienda Supabase non leggibile:', error);
    return null;
  }

  return data || null;
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

    let profile = null;

    if (userSnap.exists()) {
      profile = userSnap.data() || {};
    } else {
      profile = await getSupabaseUserProfile(firebaseUser);

      if (!profile) {
        await signOut(firebaseAuth);
        localStorage.removeItem(CURRENT_USER_KEY);

        throw new Error(
          `Utente autenticato, ma profilo applicazione non trovato né in Firestore né in Supabase. UID: ${firebaseUser.uid}`
        );
      }
    }

    let appUser = normalizeUserProfile(firebaseUser, profile);

    const companyProfile = await getSupabaseCompanyProfile(appUser.companyId);

    const companyPlan =
      companyProfile?.piano ||
      profile?.subscriptionPlan ||
      profile?.subscription_plan ||
      profile?.plan ||
      profile?.piano ||
      'base';

    appUser = {
      ...appUser,
      azienda_id: appUser.companyId,
      plan: companyPlan,
      piano: companyPlan,
      subscriptionPlan: companyPlan,
      company: companyProfile
        ? {
            id: companyProfile.id,
            name: companyProfile.nome,
            nome: companyProfile.nome,
            code: companyProfile.codice,
            codice: companyProfile.codice,
            plan: companyPlan,
            piano: companyPlan,
          }
        : null,
    };

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

      throw new Error('Questo utente non appartiene all\u2019azienda selezionata.');
    }

    const effectiveSelectedCompany = selectedCompany
      ? {
          ...selectedCompany,
          plan: selectedCompany.plan || selectedCompany.piano || companyPlan,
          piano: selectedCompany.piano || selectedCompany.plan || companyPlan,
        }
      : companyProfile
        ? {
            id: companyProfile.id,
            companyId: companyProfile.id,
            company_id: companyProfile.id,
            name: companyProfile.nome,
            nome: companyProfile.nome,
            code: companyProfile.codice,
            codice: companyProfile.codice,
            plan: companyPlan,
            piano: companyPlan,
          }
        : null;

    const userWithCompany = {
      ...appUser,
      selectedCompany: effectiveSelectedCompany,
      programmerMode: isProgrammerCompany(effectiveSelectedCompany),
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