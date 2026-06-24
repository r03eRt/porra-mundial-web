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
      email?: string;
    } | null;
    const porraId = String(body?.porra_id || '').trim();
    const playerId = String(body?.player_id || '').trim();
    const email = normalizeEmail(String(body?.email || ''));

    if (!porraId || !playerId || !email) {
      return jsonResponse({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'Email no válido.' }, { status: 400 });
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

    // El jugador debe pertenecer a esta porra.
    const { data: player, error: playerError } = await adminClient
      .from('porra_players')
      .select('user_id')
      .eq('porra_id', porraId)
      .eq('player_id', playerId)
      .maybeSingle();
    if (playerError) throw playerError;
    if (!player) {
      return jsonResponse({ error: 'Jugador no encontrado en esta porra.' }, { status: 404 });
    }

    // Si tiene cuenta de Auth enlazada, actualiza también el email de Auth (confirmado).
    if (player.user_id) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(player.user_id, {
        email,
        email_confirm: true
      });
      if (updateError) {
        // Conflicto típico: el email ya lo usa otra cuenta de Auth.
        return jsonResponse({ error: updateError.message }, { status: 409 });
      }
    }

    // Actualiza el email en la tabla de jugadores de la porra.
    const { error: rowError } = await adminClient
      .from('porra_players')
      .update({ email })
      .eq('porra_id', porraId)
      .eq('player_id', playerId);
    if (rowError) throw rowError;

    return jsonResponse({ ok: true, email });
  } catch (error) {
    console.error('admin-next-set-player-email failed:', error);
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});
