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

async function deleteByCompanyId(env, table, companyId) {
  try {
    const rows = await supabaseRequest(
      env,
      `${table}?azienda_id=eq.${encodeURIComponent(companyId)}`,
      {
        method: 'DELETE',
      }
    );

    return Array.isArray(rows) ? rows.length : 0;
  } catch (error) {
    console.warn(`Eliminazione ${table} non completata:`, error?.message || error);
    throw error;
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

    await verifyProgrammerFirebaseUser(env, token);

    const body = await request.json();
    const companyId = String(body?.id || body?.companyId || '').trim();

    if (!companyId) {
      return jsonResponse({ ok: false, message: 'ID azienda mancante.' }, 400);
    }

    if (companyId === 'programmatore') {
      return jsonResponse(
        { ok: false, message: 'L’ambiente programmatore non può essere eliminato.' },
        400
      );
    }

    const companyRows = await supabaseRequest(
      env,
      `aziende?id=eq.${encodeURIComponent(companyId)}&select=id,nome,codice`
    );

    const company = Array.isArray(companyRows) ? companyRows[0] : null;

    if (!company) {
      return jsonResponse({ ok: false, message: 'Azienda non trovata.' }, 404);
    }

    const deleted = {};

    const tables = [
      'notifiche',
      'movimenti',
      'fatture_importate',
      'log_modifiche',
      'materiali',
      'categorie',
      'impostazioni',
      'utenti',
    ];

    for (const table of tables) {
      deleted[table] = await deleteByCompanyId(env, table, companyId);
    }

    const deletedCompanyRows = await supabaseRequest(
      env,
      `aziende?id=eq.${encodeURIComponent(companyId)}`,
      {
        method: 'DELETE',
      }
    );

    return jsonResponse({
      ok: true,
      company,
      deleted,
      deletedCompany: Array.isArray(deletedCompanyRows) ? deletedCompanyRows[0] : null,
    });
  } catch (error) {
    console.error('Errore delete-company:', error);

    return jsonResponse(
      {
        ok: false,
        message: error?.message || 'Errore durante eliminazione azienda.',
      },
      500
    );
  }
}
