import { createClient } from 'npm:@supabase/supabase-js@2';

const SOURCE_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const CACHE_KIND = 'openfootball-2026';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase env vars' }, { status: 500 });
  }

  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Porrazo2026 worldcup cache (+https://github.com/r03eRt/porra-mundial-web)'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenFootball responded with HTTP ${response.status}`);
    }

    const payload = await response.json();
    const updatedAt = new Date().toISOString();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { error } = await supabase.from('worldcup_results_cache').upsert([{
      kind: CACHE_KIND,
      payload: {
        ...payload,
        kind: CACHE_KIND,
        sourceUrl: SOURCE_URL,
        scrapedAt: updatedAt
      },
      source: 'openfootball',
      updated_at: updatedAt
    }], { onConflict: 'kind' });

    if (error) throw error;

    return jsonResponse({
      ok: true,
      updatedAt,
      count: Array.isArray(payload.matches) ? payload.matches.length : 0
    });
  } catch (error) {
    console.error('sync-worldcup-results failed:', error);
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});
