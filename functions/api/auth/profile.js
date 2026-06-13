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

async function supabaseRequest(env, path) {
  const response = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/${path}`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
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

    const token = String(request.headers.get('Authorization') || '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!token) {
      return jsonResponse(
        { ok: false, message: 'Token autorizzazione mancante.' },
        401
      );
    }

    const firebaseUser = await verifyFirebaseUser(env, token);
    const firebaseEmail = normalizeEmail(firebaseUser.email);

    if (!firebaseEmail) {
      return jsonResponse(
        { ok: false, message: 'Email Firebase non disponibile.' },
        400
      );
    }

    const body = await request.json().catch(() => ({}));
    const companyId = String(
      body?.companyId || body?.company_id || ''
    ).trim();

    let path =
      `utenti?or=(email.eq.${encodeURIComponent(firebaseEmail)},` +
      `username.eq.${encodeURIComponent(firebaseEmail)})` +
      `&select=id,username,nome,email,ruolo,attivo,permessi,azienda_id,created_at`;

    if (companyId) {
      path += `&azienda_id=eq.${encodeURIComponent(companyId)}`;
    }

    const rows = await supabaseRequest(env, path);
    const profiles = Array.isArray(rows) ? rows : [];

    if (profiles.length === 0) {
      return jsonResponse(
        {
          ok: false,
          message: 'Profilo applicazione non trovato.',
        },
        404
      );
    }

    if (profiles.length > 1 && !companyId) {
      return jsonResponse(
        {
          ok: false,
          message: 'Utente associato a più aziende. Seleziona prima l’azienda.',
        },
        409
      );
    }

    const profile = profiles[0];

    if (profile.attivo === false) {
      return jsonResponse(
        {
          ok: false,
          message: 'Account non attivo.',
        },
        403
      );
    }

    return jsonResponse({
      ok: true,
      profile,
    });
  } catch (error) {
    console.error('Errore auth profile:', error);

    return jsonResponse(
      {
        ok: false,
        message: error?.message || 'Errore recupero profilo utente.',
      },
      500
    );
  }
}
