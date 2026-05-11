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

function normalizeMaxUsers(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const text = String(value).trim();
  if (!text) return null;

  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0) return null;

  return Math.floor(number);
}

function sanitizeCompanyCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '');
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

async function verifyFirebaseUser(env, token) {
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

  return payload.users[0];
}

async function getFirestoreUserProfile(env, uid) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID non configurato nel backend.');
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Profilo programmatore non trovato in Firestore.');
  }

  const doc = await response.json();
  const fields = doc.fields || {};

  const getString = (name) => fields[name]?.stringValue || '';
  const getBoolean = (name) => fields[name]?.booleanValue;

  return {
    uid,
    email: getString('email'),
    role: getString('role') || getString('ruolo'),
    companyId: getString('companyId') || getString('company_id'),
    active:
      getBoolean('active') !== undefined
        ? Boolean(getBoolean('active'))
        : true,
  };
}

function assertProgrammer(profile) {
  const role = String(profile?.role || '').trim().toLowerCase();
  const companyId = String(profile?.companyId || '').trim().toLowerCase();

  const allowedRole =
    role === 'sviluppatore' ||
    role === 'super_admin' ||
    role === 'admin_tecnico';

  if (!profile?.active) {
    throw new Error('Account programmatore non attivo.');
  }

  if (!allowedRole || companyId !== 'programmatore') {
    throw new Error('Operazione riservata al programmatore.');
  }
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
        { message: 'Configurazione Supabase backend mancante.' },
        500
      );
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return jsonResponse({ message: 'Token autorizzazione mancante.' }, 401);
    }

    const firebaseUser = await verifyFirebaseUser(env, token);
    const profile = await getFirestoreUserProfile(env, firebaseUser.localId);

    assertProgrammer(profile);

    const body = await request.json();
    const id = String(body?.id || '').trim();
    const updates = body?.updates || {};

    if (!id) {
      return jsonResponse({ message: 'ID azienda mancante.' }, 400);
    }

    if (id === 'programmatore') {
      return jsonResponse(
        { message: 'L’ambiente programmatore non può essere modificato da questa schermata.' },
        400
      );
    }

    const payload = {};

    if (updates.nome !== undefined) payload.nome = String(updates.nome || '').trim();
    if (updates.codice !== undefined) payload.codice = sanitizeCompanyCode(updates.codice);
    if (updates.logo_url !== undefined) payload.logo_url = updates.logo_url || null;
    if (updates.attiva !== undefined) payload.attiva = Boolean(updates.attiva);
    if (updates.stato_abbonamento !== undefined) payload.stato_abbonamento = String(updates.stato_abbonamento || 'attivo');
    if (updates.piano !== undefined) payload.piano = String(updates.piano || 'base');
    if (updates.data_inizio_abbonamento !== undefined) payload.data_inizio_abbonamento = updates.data_inizio_abbonamento || null;
    if (updates.data_scadenza_abbonamento !== undefined) payload.data_scadenza_abbonamento = updates.data_scadenza_abbonamento || null;
    if (updates.max_utenti !== undefined) payload.max_utenti = normalizeMaxUsers(updates.max_utenti);
    if (updates.sospesa_motivo !== undefined) payload.sospesa_motivo = updates.sospesa_motivo || null;
    if (updates.note !== undefined) payload.note = updates.note || null;

    payload.updated_at = new Date().toISOString();

    const updatedRows = await supabaseRequest(
      env,
      `aziende?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );

    const updatedCompany = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;

    if (!updatedCompany) {
      return jsonResponse({ message: 'Azienda non trovata o non aggiornata.' }, 404);
    }

    return jsonResponse({
      ok: true,
      company: updatedCompany,
    });
  } catch (error) {
    console.error('Errore update-company:', error);

    return jsonResponse(
      {
        ok: false,
        message: error?.message || 'Errore durante aggiornamento azienda.',
      },
      500
    );
  }
}
