import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function makeTempPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
    .slice(0, 16);
}

async function findUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find(item => normalizeEmail(item.email || '') === email && !item.deleted_at);
    if (user) return user;
    if (!data.nextPage) break;
  }
  return null;
}

async function findOrCreateUser(adminClient: ReturnType<typeof createClient>, email: string, displayName: string) {
  const existing = await findUserByEmail(adminClient, email);
  if (existing) {
    return { user: existing, created: false as const };
  }

  const tempPassword = makeTempPassword();
  const playerId = slugify(displayName || email.split('@')[0]) || `player-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      name: displayName,
      player_id: playerId,
      role: 'player'
    }
  });

  if (error) {
    const retry = await findUserByEmail(adminClient, email);
    if (retry) {
      return { user: retry, created: false as const };
    }
    throw error;
  }

  if (!data.user) {
    throw new Error('No se pudo crear el usuario de Auth.');
  }

  return { user: data.user, created: true as const, tempPassword };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase env vars' }, { status: 500 });
  }
  if (!authHeader) {
    return jsonResponse({ error: 'Debes iniciar sesión.' }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const userClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });

  try {
    const body = await req.json().catch(() => null) as {
      porra_id?: string;
      email?: string;
      display_name?: string;
    } | null;
    const porraId = String(body?.porra_id || '').trim();
    const email = normalizeEmail(String(body?.email || ''));
    const displayName = String(body?.display_name || '').trim();

    if (!porraId || !email || !displayName) {
      return jsonResponse({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Debes iniciar sesión.' }, { status: 401 });
    }

    const { data: owns, error: ownsError } = await userClient.rpc('pp_owns', { p_porra_id: porraId });
    if (ownsError) throw ownsError;
    if (!owns) {
      return jsonResponse({ error: 'No puedes modificar esta porra.' }, { status: 403 });
    }

    const [existingByEmail, existingByUserId] = await Promise.all([
      adminClient.from('porra_players')
        .select('player_id')
        .eq('porra_id', porraId)
        .eq('email', email),
      adminClient.from('porra_players')
        .select('player_id')
        .eq('porra_id', porraId)
        .eq('user_id', userData.user.id)
    ]);

    if (existingByEmail.data?.length || existingByUserId.data?.length) {
      return jsonResponse({ error: 'Ese usuario ya está añadido a esta porra.' }, { status: 409 });
    }

    const { user, created, tempPassword } = await findOrCreateUser(adminClient, email, displayName);
    const playerId = String(user.user_metadata?.player_id || slugify(displayName || email.split('@')[0]) || `player-${crypto.randomUUID().slice(0, 8)}`);

    const { data: inserted, error: insertError } = await adminClient
      .from('porra_players')
      .insert({
        porra_id: porraId,
        player_id: playerId,
        name: displayName,
        display_name: displayName,
        email,
        user_id: user.id
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    return jsonResponse({
      ok: true,
      created_in_auth: created,
      temp_password: created ? tempPassword : null,
      player: inserted
    });
  } catch (error) {
    console.error('admin-next-add-player failed:', error);
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});
