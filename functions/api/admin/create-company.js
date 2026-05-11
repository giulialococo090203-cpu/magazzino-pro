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
  if (value === undefined) return null;
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

function buildCompanyId(code) {
  const safeCode = String(code || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  return safeCode || '';
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

function assertProgrammer(firebaseUser, env) {
  const programmerEmail = String(env.PROGRAMMER_EMAIL || '').trim().toLowerCase();
  const userEmail = String(firebaseUser?.email || '').trim().toLowerCase();

  if (!programmerEmail) {
    throw new Error('PROGRAMMER_EMAIL non configurata nel backend.');
  }

  if (!userEmail || userEmail !== programmerEmail) {
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
        { ok: false, message: 'Configurazione Supabase backend mancante.' },
        500
      );
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return jsonResponse({ ok: false, message: 'Token autorizzazione mancante.' }, 401);
    }

    const firebaseUser = await verifyFirebaseUser(env, token);
    assertProgrammer(firebaseUser, env);

    const body = await request.json();
    const company = body?.company || body || {};

    const nome = String(company.nome || company.name || '').trim();
    const codice = sanitizeCompanyCode(company.codice || company.code);

    if (!nome) {
      return jsonResponse({ ok: false, message: 'Nome azienda obbligatorio.' }, 400);
    }

    if (!codice) {
      return jsonResponse({ ok: false, message: 'Codice accesso obbligatorio.' }, 400);
    }

    if (codice === 'PROGRAMMATORE') {
      return jsonResponse(
        { ok: false, message: 'Il codice PROGRAMMATORE è riservato.' },
        400
      );
    }

    const id = String(company.id || buildCompanyId(codice)).trim();

    if (!id) {
      return jsonResponse({ ok: false, message: 'ID azienda non generabile.' }, 400);
    }

    if (id === 'programmatore') {
      return jsonResponse(
        { ok: false, message: 'ID programmatore riservato.' },
        400
      );
    }

    const payload = {
      id,
      nome,
      codice,
      logo_url: company.logo_url || company.logoUrl || null,
      attiva:
        company.attiva !== undefined
          ? Boolean(company.attiva)
          : company.active !== undefined
            ? Boolean(company.active)
            : true,
      stato_abbonamento:
        company.stato_abbonamento ||
        company.subscriptionStatus ||
        'attivo',
      piano:
        company.piano ||
        company.plan ||
        'base',
      data_inizio_abbonamento:
        company.data_inizio_abbonamento ||
        company.subscriptionStartDate ||
        null,
      data_scadenza_abbonamento:
        company.data_scadenza_abbonamento ||
        company.subscriptionEndDate ||
        null,
      max_utenti: normalizeMaxUsers(
        company.max_utenti !== undefined ? company.max_utenti : company.maxUsers
      ),
      sospesa_motivo:
        company.sospesa_motivo ||
        company.suspensionReason ||
        null,
      note:
        company.note ||
        company.notes ||
        null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const insertedRows = await supabaseRequest(env, 'aziende', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const insertedCompany = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;

    if (!insertedCompany) {
      return jsonResponse({ ok: false, message: 'Azienda non creata.' }, 500);
    }

    return jsonResponse({
      ok: true,
      company: insertedCompany,
    });
  } catch (error) {
    console.error('Errore create-company:', error);

    const message = error?.message || 'Errore durante creazione azienda.';

    if (
      message.toLowerCase().includes('duplicate') ||
      message.includes('23505')
    ) {
      return jsonResponse(
        { ok: false, message: 'Esiste già un’azienda con questo codice o ID.' },
        409
      );
    }

    return jsonResponse(
      {
        ok: false,
        message,
      },
      500
    );
  }
}
