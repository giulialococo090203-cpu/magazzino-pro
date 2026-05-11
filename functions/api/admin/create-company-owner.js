const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'admin') return 'datore';
  if (normalized === 'controllo') return 'datore';
  if (normalized === 'segreteria') return 'segretaria';
  if (normalized === 'operatore') return 'magazziniere';

  return normalized || 'datore';
}

async function verifyProgrammerFirebaseUser(env, token) {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY non configurata nel backend.');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  );

  const payload = await response.json();

  if (!response.ok || !payload?.users?.[0]) {
    throw new Error('Token Firebase non valido o scaduto.');
  }

  const firebaseUser = payload.users[0];

  const programmerEmail = normalizeEmail(env.PROGRAMMER_EMAIL);
  const userEmail = normalizeEmail(firebaseUser.email);

  if (!programmerEmail) {
    throw new Error('PROGRAMMER_EMAIL non configurata nel backend.');
  }

  if (!userEmail || userEmail !== programmerEmail) {
    throw new Error('Operazione riservata al programmatore.');
  }

  return firebaseUser;
}

async function firebaseCreateOrSignInUser(env, { email, password, fullName }) {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY;

  const signUpResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        displayName: fullName,
        returnSecureToken: true,
      }),
    }
  );

  const signUpPayload = await signUpResponse.json();

  if (signUpResponse.ok) {
    return signUpPayload;
  }

  const code = signUpPayload?.error?.message || '';

  if (code.includes('EMAIL_EXISTS')) {
    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const signInPayload = await signInResponse.json();

    if (!signInResponse.ok) {
      throw new Error(
        'Esiste già un utente Firebase con questa email, ma la password inserita non coincide.'
      );
    }

    return signInPayload;
  }

  if (code.includes('WEAK_PASSWORD')) {
    throw new Error('Password troppo debole. Usa almeno 6 caratteri.');
  }

  if (code.includes('INVALID_EMAIL')) {
    throw new Error('Email non valida.');
  }

  throw new Error(code || 'Errore creazione utente Firebase.');
}

async function firestoreSetUser(env, uid, profile, idToken) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID non configurato nel backend.');
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=active&updateMask.fieldPaths=companyId&updateMask.fieldPaths=company_id&updateMask.fieldPaths=email&updateMask.fieldPaths=fullName&updateMask.fieldPaths=nome&updateMask.fieldPaths=role&updateMask.fieldPaths=ruolo&updateMask.fieldPaths=permissions&updateMask.fieldPaths=permessi&updateMask.fieldPaths=createdAt&updateMask.fieldPaths=updatedAt`;

  const now = new Date().toISOString();

  const body = {
    fields: {
      active: { booleanValue: true },
      companyId: { stringValue: profile.companyId },
      company_id: { stringValue: profile.companyId },
      email: { stringValue: profile.email },
      fullName: { stringValue: profile.fullName },
      nome: { stringValue: profile.fullName },
      role: { stringValue: profile.role },
      ruolo: { stringValue: profile.role },
      permissions: { mapValue: { fields: {} } },
      permessi: { mapValue: { fields: {} } },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
    },
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Errore salvataggio profilo Firestore.');
  }

  return payload;
}

async function supabaseRequest(env, path, options = {}) {
  const url = `${env.VITE_SUPABASE_URL}/rest/v1/${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      text ||
      `Errore Supabase (${response.status})`;

    throw new Error(message);
  }

  return data;
}

async function assertCompanyExists(env, companyId) {
  const rows = await supabaseRequest(
    env,
    `aziende?id=eq.${encodeURIComponent(companyId)}&select=id,nome,codice,max_utenti`
  );

  const company = Array.isArray(rows) ? rows[0] : null;

  if (!company) {
    throw new Error('Azienda non trovata.');
  }

  return company;
}

async function assertCompanyLimitNotReached(env, companyId) {
  const company = await assertCompanyExists(env, companyId);
  const maxUsers = Number(company.max_utenti || 0);

  if (!maxUsers || maxUsers <= 0) return company;

  const rows = await supabaseRequest(
    env,
    `utenti?azienda_id=eq.${encodeURIComponent(companyId)}&attivo=eq.true&select=id`
  );

  const count = Array.isArray(rows) ? rows.length : 0;

  if (count >= maxUsers) {
    throw new Error(
      `Non è possibile aggiungere nuovi utenti: è stato raggiunto il limite consentito dall’abbonamento attivo (${count}/${maxUsers}).`
    );
  }

  return company;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(
        { ok: false, message: 'Configurazione Supabase backend mancante.' },
        500
      );
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return jsonResponse({ ok: false, message: 'Token autorizzazione mancante.' }, 401);
    }

    await verifyProgrammerFirebaseUser(env, token);

    const body = await request.json();

    const companyId = String(body?.companyId || body?.company_id || '').trim();
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || '').trim();
    const fullName = String(body?.fullName || body?.nome || '').trim();

    if (!companyId) {
      return jsonResponse({ ok: false, message: 'ID azienda mancante.' }, 400);
    }

    if (companyId === 'programmatore') {
      return jsonResponse({ ok: false, message: 'Non puoi creare un datore per l’ambiente programmatore.' }, 400);
    }

    if (!email) {
      return jsonResponse({ ok: false, message: 'Email datore obbligatoria.' }, 400);
    }

    if (!password) {
      return jsonResponse({ ok: false, message: 'Password iniziale obbligatoria.' }, 400);
    }

    if (!fullName) {
      return jsonResponse({ ok: false, message: 'Nome completo datore obbligatorio.' }, 400);
    }

    const company = await assertCompanyLimitNotReached(env, companyId);

    const role = normalizeRole('datore');

    const firebaseUser = await firebaseCreateOrSignInUser(env, {
      email,
      password,
      fullName,
    });

    const uid = firebaseUser.localId;
    const newUserIdToken = firebaseUser.idToken;

    // Non scrivo il profilo Firestore da qui: alcune regole Firestore lo bloccano.
    // La fonte compatibile per l'app resta Supabase "utenti", collegata al Firebase uid.
    console.log('Profilo Firestore saltato per primo datore:', uid);

    const supabasePayload = {
      username: email,
      email,
      nome: fullName,
      ruolo: role,
      attivo: true,
      permessi: {},
      azienda_id: companyId,
      company_id: companyId,
      auth_uid: uid,
    };

    let supabaseUser = null;

    try {
      const rows = await supabaseRequest(env, 'utenti', {
        method: 'POST',
        body: JSON.stringify(supabasePayload),
      });

      supabaseUser = Array.isArray(rows) ? rows[0] : rows;
    } catch (error) {
      console.warn('Utente creato in Firebase/Firestore ma non copiato in Supabase:', error);
    }

    return jsonResponse({
      ok: true,
      user: {
        uid,
        authUid: uid,
        id: supabaseUser?.id || uid,
        email,
        fullName,
        role,
        companyId,
        company_id: companyId,
      },
      company,
    });
  } catch (error) {
    console.error('Errore create-company-owner:', error);

    return jsonResponse(
      {
        ok: false,
        message: error?.message || 'Errore durante creazione datore.',
      },
      500
    );
  }
}
