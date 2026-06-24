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

function makeTempPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
    .slice(0, 16);
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
      player_id?: string;
      password?: string;
    } | null;
    const porraId = String(body?.porra_id || '').trim();
    const playerId = String(body?.player_id || '').trim();
    const requested = String(body?.password || '').trim();

    if (!porraId || !playerId) {
      return jsonResponse({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }
    // Si se pasa contraseña a mano, exigir un mínimo razonable; si no, se genera.
    if (requested && requested.length < 6) {
      return jsonResponse({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    // El que llama debe estar autenticado y ser dueño de la porra.
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Debes iniciar sesión.' }, { status: 401 });
    }
    const { data: owns, error: ownsError } = await userClient.rpc('pp_owns', { p_porra_id: porraId });
    if (ownsError) throw ownsError;
    if (!owns) {
      return jsonResponse({ error: 'No puedes modificar esta porra.' }, { status: 403 });
    }

    // El jugador debe pertenecer a esta porra y tener cuenta de Auth enlazada.
    const { data: player, error: playerError } = await adminClient
      .from('porra_players')
      .select('user_id')
      .eq('porra_id', porraId)
      .eq('player_id', playerId)
      .maybeSingle();
    if (playerError) throw playerError;
    if (!player?.user_id) {
      return jsonResponse({ error: 'El jugador no tiene cuenta de Auth enlazada.' }, { status: 404 });
    }

    const password = requested || makeTempPassword();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(player.user_id, { password });
    if (updateError) throw updateError;

    return jsonResponse({ ok: true, password });
  } catch (error) {
    console.error('admin-next-set-player-password failed:', error);
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});
