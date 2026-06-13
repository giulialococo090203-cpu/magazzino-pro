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

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'admin' || role === 'controllo') return 'datore';
  if (role === 'segreteria') return 'segretaria';
  if (role === 'operatore') return 'magazziniere';

  return role || 'operaio';
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
        Prefer: 'return=representation',
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

async function assertCompanyLimit(env, companyId) {
  const companies = await supabaseRequest(
    env,
    `aziende?id=eq.${encodeURIComponent(companyId)}` +
      `&select=id,max_utenti`
  );

  const company = Array.isArray(companies) ? companies[0] : null;

  if (!company) {
    throw new Error('Azienda non trovata.');
  }

  const maxUsers = Number(company.max_utenti || 0);

  if (!maxUsers) return;

  const users = await supabaseRequest(
    env,
    `utenti?azienda_id=eq.${encodeURIComponent(companyId)}` +
      `&attivo=eq.true&select=id`
  );

  const currentCount = Array.isArray(users) ? users.length : 0;

  if (currentCount >= maxUsers) {
    throw new Error(
      `Limite utenti raggiunto (${currentCount}/${maxUsers}).`
    );
  }
}

async function createFirebaseUser(env, email, password, fullName) {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY;

  const response = await fetch(
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

  const payload = await response.json();

  if (!response.ok) {
    const code = String(payload?.error?.message || '');

    if (code.includes('EMAIL_EXISTS')) {
      throw new Error('Esiste già un utente Firebase con questa email.');
    }

    if (code.includes('WEAK_PASSWORD')) {
      throw new Error('Password troppo debole. Usa almeno 6 caratteri.');
    }

    if (code.includes('INVALID_EMAIL')) {
      throw new Error('Email non valida.');
    }

    throw new Error(code || 'Errore creazione account Firebase.');
  }

  return payload;
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

    if (
      !env.VITE_SUPABASE_URL ||
      !env.SUPABASE_SERVICE_ROLE_KEY ||
      !(env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY)
    ) {
      return jsonResponse(
        { ok: false, message: 'Configurazione backend incompleta.' },
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

    const email = normalizeEmail(body?.email);
    const password = String(body?.password || '').trim();
    const fullName = String(body?.fullName || body?.nome || '').trim();
    const role = normalizeRole(body?.role || body?.ruolo);
    const active = body?.active !== false;
    const permissions =
      body?.permissions && typeof body.permissions === 'object'
        ? body.permissions
        : {};

    if (!companyId || !email || !password || !fullName) {
      return jsonResponse(
        {
          ok: false,
          message:
            'Azienda, email, password e nome completo sono obbligatori.',
        },
        400
      );
    }

    const firebaseCaller = await verifyFirebaseUser(env, token);
    await assertUserCanManageCompany(env, firebaseCaller, companyId);
    await assertCompanyLimit(env, companyId);

    const firebaseCreated = await createFirebaseUser(
      env,
      email,
      password,
      fullName
    );

    const existingRows = await supabaseRequest(
      env,
      `utenti?azienda_id=eq.${encodeURIComponent(companyId)}` +
        `&username=eq.${encodeURIComponent(email)}` +
        `&select=id`
    );

    const existing = Array.isArray(existingRows)
      ? existingRows[0]
      : null;

    const row = {
      username: email,
      nome: fullName,
      email,
      ruolo: role,
      attivo: active,
      permessi: permissions,
      azienda_id: companyId,
    };

    let savedRows;

    if (existing?.id) {
      savedRows = await supabaseRequest(
        env,
        `utenti?id=eq.${encodeURIComponent(existing.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(row),
        }
      );
    } else {
      savedRows = await supabaseRequest(env, 'utenti', {
        method: 'POST',
        body: JSON.stringify(row),
      });
    }

    const savedUser = Array.isArray(savedRows)
      ? savedRows[0]
      : savedRows;

    return jsonResponse({
      ok: true,
      uid: firebaseCreated.localId,
      authUid: firebaseCreated.localId,
      email,
      fullName,
      role,
      active,
      permissions,
      companyId,
      company_id: companyId,
      user: savedUser,
    });
  } catch (error) {
    console.error('Errore create-user:', error);

    return jsonResponse(
      {
        ok: false,
        message: error?.message || 'Errore creazione utente.',
      },
      500
    );
  }
}
