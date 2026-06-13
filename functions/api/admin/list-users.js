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

async function supabaseRequest(env, path, options = {}) {
  const response = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }
  );

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      text ||
      `Errore Supabase (${response.status})`
    );
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

async function assertUserCanManageCompany(env, firebaseUser, companyId) {
  const userEmail = normalizeEmail(firebaseUser?.email);
  const programmerEmail = normalizeEmail(env.PROGRAMMER_EMAIL);

  if (programmerEmail && userEmail === programmerEmail) {
    return;
  }

  const rows = await supabaseRequest(
    env,
    `utenti?azienda_id=eq.${encodeURIComponent(companyId)}` +
      `&email=eq.${encodeURIComponent(userEmail)}` +
      `&attivo=eq.true&select=id,ruolo`
  );

  const user = Array.isArray(rows) ? rows[0] : null;
  const role = String(user?.ruolo || '').trim().toLowerCase();

  if (!user || !['datore', 'admin'].includes(role)) {
    throw new Error('Operazione non autorizzata per questa azienda.');
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

    const token = String(
      request.headers.get('Authorization') || ''
    )
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!token) {
      return jsonResponse(
        { ok: false, message: 'Token autorizzazione mancante.' },
        401
      );
    }

    const body = await request.json();
    const companyId = String(
      body?.companyId || body?.company_id || ''
    ).trim();

    if (!companyId) {
      return jsonResponse(
        { ok: false, message: 'ID azienda mancante.' },
        400
      );
    }

    const firebaseUser = await verifyFirebaseUser(env, token);
    await assertUserCanManageCompany(env, firebaseUser, companyId);

    const users = await supabaseRequest(
      env,
      `utenti?azienda_id=eq.${encodeURIComponent(companyId)}` +
        `&select=id,username,nome,email,ruolo,attivo,permessi,azienda_id,created_at` +
        `&order=nome.asc`
    );

    return jsonResponse({
      ok: true,
      users: Array.isArray(users) ? users : [],
    });
  } catch (error) {
    console.error('Errore list-users:', error);

    return jsonResponse(
      {
        ok: false,
        message: error?.message || 'Errore caricamento utenti.',
      },
      500
    );
  }
}
