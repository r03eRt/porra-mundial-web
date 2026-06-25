// sync-wikipedia-results — caché de resultados de eventos para la app nueva.
//
// Equivalente al sync-worldcup-results de la legacy, pero genérico por evento y con
// fuente Wikipedia ES (REST API → plantilla {{Partido}} → data-mw JSON estructurado).
// Escribe public.event_results_cache (una fila por evento).
//
// NO toca porra_matches: solo mantiene el caché crudo. El sync caché→porra_matches
// (con fallback manual: el resultado del admin gana) se implementará aparte.
//
// Llamado por pg_cron (verify_jwt = false). Acepta ?event=worldcup-2026 (default) y
// ?force=1 para saltar la ventana de caché. Cadencia normal 15 min, 2 min en ventana
// de partido (igual que la legacy).

import { createClient } from 'npm:@supabase/supabase-js@2';

interface EventConfig {
  event: string;
  sourceUrl: string;       // URL pública del artículo (para guardar en source_url)
  restPath: string;        // path para la REST API de Wikipedia
}

const EVENTS: Record<string, EventConfig> = {
  'worldcup-2026': {
    event: 'worldcup-2026',
    sourceUrl: 'https://es.wikipedia.org/wiki/Copa_Mundial_de_Fútbol_de_2026',
    restPath: 'Copa_Mundial_de_F%C3%BAtbol_de_2026'
  }
};

const REST_BASE = 'https://es.wikipedia.org/api/rest_v1/page/html/';
const NORMAL_REFRESH_MS = 15 * 60 * 1000;
const MATCH_WINDOW_REFRESH_MS = 2 * 60 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

// ---- Limpieza de wikitext ----
function clean(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'''/g, '').replace(/''/g, '')
    .replace(/\{\{esd\}\}/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Gol crudo: usa `player` (igual que scrape.js); buildPayload lo normaliza a `name`.
interface Goal { player: string; minutes: string[]; penalty: boolean; owngoal: boolean; }

function parseGoals(wt: string | undefined): Goal[] {
  if (!wt) return [];
  const out: Goal[] = [];
  for (let it of wt.split('\n').map(x => x.trim()).filter(Boolean)) {
    it = it.replace(/^\*\s*/, '');
    const golRe = /\{\{gol\|([^}]*)\}\}/g;
    const mins: string[] = [];
    let g: RegExpExecArray | null;
    while ((g = golRe.exec(it)) !== null) {
      mins.push(...g[1].split(/[,\s]+/).filter(Boolean));
    }
    const owngoal = /en propia|autogol|\(a\.?g\.?\)|o\.g\./i.test(it);
    const penalty = /penal|penalti|\(p\.?\)/i.test(it);
    const name = clean(it.replace(/\{\{gol\|[^}]*\}\}/g, '').replace(/\([^)]*\)/g, '')).trim();
    if (name) out.push({ player: name, minutes: mins, penalty, owngoal });
  }
  return out;
}

const ROUND_MAP: Record<string, string> = {
  Dieciseisavos_de_final: 'Round of 32',
  Octavos_de_final: 'Round of 16',
  Cuartos_de_final: 'Quarter-final',
  Semifinales: 'Semi-final',
  Tercer_puesto: 'Third place',
  Final: 'Final'
};
const ROUND_ORDER = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third place', 'Final'];

interface RawMatch {
  stage: string; group: string | null; round: string | null;
  team1: string; team2: string; code1: string | null; code2: string | null;
  played: boolean; score_home: number | null; score_away: number | null;
  date: string | null; time: string | null; stadium: string | null; city: string | null;
  report: string | null; goals_home: Goal[]; goals_away: Goal[];
}

// ---- Parser del HTML de Wikipedia → partidos crudos ----
function parseMatches(html: string): RawMatch[] {
  // Marcadores de sección (headings con id)
  const marks: { level: number; id: string; pos: number }[] = [];
  const reH = /<h([234])\b[^>]*\bid="([^"]+)"/g;
  let h: RegExpExecArray | null;
  while ((h = reH.exec(html)) !== null) marks.push({ level: +h[1], id: h[2], pos: h.index });

  const faseGruposPos = marks.find(m => m.id === 'Fase_de_grupos')?.pos ?? 0;
  const segundaFasePos = marks.find(m => m.id === 'Segunda_fase')?.pos ?? Infinity;

  const groupMarks = marks
    .filter(m => /^Grupo_[A-L]_2$/.test(m.id) && m.pos >= faseGruposPos)
    .map(m => ({ group: m.id.charAt(6), pos: m.pos }));
  const roundMarks = marks
    .filter(m => ROUND_MAP[m.id] && m.pos >= segundaFasePos)
    .map(m => ({ round: ROUND_MAP[m.id], pos: m.pos }));

  const groupFor = (pos: number) => {
    let g: string | null = null;
    for (const mk of groupMarks) { if (mk.pos <= pos) g = mk.group; else break; }
    return g;
  };
  const roundFor = (pos: number) => {
    let r: string | null = null;
    for (const mk of roundMarks) { if (mk.pos <= pos) r = mk.round; else break; }
    return r;
  };

  const out: RawMatch[] = [];
  const dmRe = /data-mw='([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = dmRe.exec(html)) !== null) {
    const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&apos;/g, "'");
    if (!raw.includes('./Plantilla:Partido')) continue;
    let j: any;
    try { j = JSON.parse(raw); } catch { continue; }
    const p = j?.parts?.[0]?.template?.params;
    if (!p) continue;
    const pos = m.index;
    const isFinal = pos >= segundaFasePos;
    const resRaw = (p.resultado && p.resultado.wt) || '';
    const resMatch = String(resRaw).match(/(\d+)\s*:\s*(\d+)/);
    out.push({
      stage: isFinal ? (roundFor(pos) || 'knockout') : 'group',
      group: isFinal ? null : groupFor(pos),
      round: isFinal ? roundFor(pos) : null,
      team1: clean(p.local && p.local.wt),
      team2: clean(p.visita && p.visita.wt),
      code1: (p['paíslocal'] && p['paíslocal'].wt) || null,
      code2: (p['paísvisita'] && p['paísvisita'].wt) || null,
      played: !!resMatch,
      score_home: resMatch ? +resMatch[1] : null,
      score_away: resMatch ? +resMatch[2] : null,
      date: clean(((p.fecha && p.fecha.wt) || '').replace(/\{\{fecha\|(\d+)\|(\d+)\}\}/, '$1/$2')) || null,
      time: clean(p.hora && p.hora.wt) || null,
      stadium: clean(p.estadio && p.estadio.wt) || null,
      city: clean(p.ciudad && p.ciudad.wt) || null,
      report: (p.reporte && p.reporte.wt) || null,
      goals_home: parseGoals(p.goleslocal && p.goleslocal.wt),
      goals_away: parseGoals(p.golesvisita && p.golesvisita.wt)
    });
  }
  return out;
}

// ---- Construcción del payload estructurado ----
function buildPayload(all: RawMatch[], cfg: EventConfig) {
  const teamMap = new Map<string, string>();
  for (const m of all) {
    if (m.code1 && m.team1) teamMap.set(m.code1, m.team1);
    if (m.code2 && m.team2) teamMap.set(m.code2, m.team2);
  }
  const teams = [...teamMap.entries()]
    .filter(([code]) => /^[A-Z]{3}$/.test(code))
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const normGoal = (g: any) => ({ name: g.player || g.name || '', minutes: g.minutes || [], penalty: !!g.penalty, owngoal: !!g.owngoal });
  const matches = all.map((m, i) => ({
    num: i + 1, stage: m.stage, group: m.group, round: m.round,
    team1: m.team1, team2: m.team2, code1: m.code1, code2: m.code2,
    played: m.played, score_home: m.score_home, score_away: m.score_away,
    date: m.date, time: m.time, stadium: m.stadium, city: m.city, report: m.report,
    goals: { home: m.goals_home.map(normGoal), away: m.goals_away.map(normGoal) }
  }));

  // Máximos goleadores
  const scorerMap = new Map<string, any>();
  for (const m of matches) {
    for (const [side, code] of [['home', m.code1], ['away', m.code2]] as const) {
      for (const g of (m.goals as any)[side]) {
        if (g.owngoal) continue;
        const key = `${g.name}|${code}`;
        const cur = scorerMap.get(key) || { name: g.name, team_code: code, team: teamMap.get(code as string) || code, goals: 0, penalties: 0 };
        const n = Math.max(1, g.minutes.length);
        cur.goals += n;
        if (g.penalty) cur.penalties += g.minutes.length || 1;
        scorerMap.set(key, cur);
      }
    }
  }
  const topScorers = [...scorerMap.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'es'));

  // Clasificaciones por grupo
  const emptyRow = (code: string, name: string) => ({ code, name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 });
  const standings: Record<string, any[]> = {};
  const groupLetters = [...new Set(matches.filter(m => m.stage === 'group').map(m => m.group))].filter(Boolean).sort() as string[];
  for (const g of groupLetters) {
    const rows = new Map<string, any>();
    const gms = matches.filter(m => m.stage === 'group' && m.group === g);
    for (const m of gms) {
      for (const [code, name] of [[m.code1, m.team1], [m.code2, m.team2]] as const) {
        if (code && !rows.has(code)) rows.set(code, emptyRow(code, name));
      }
    }
    for (const m of gms) {
      if (!m.played || m.code1 == null || m.code2 == null) continue;
      const a = rows.get(m.code1), b = rows.get(m.code2);
      if (!a || !b) continue;
      a.pj++; b.pj++;
      a.gf += m.score_home!; a.gc += m.score_away!;
      b.gf += m.score_away!; b.gc += m.score_home!;
      if (m.score_home! > m.score_away!) { a.pg++; a.pts += 3; b.pp++; }
      else if (m.score_home! < m.score_away!) { b.pg++; b.pts += 3; a.pp++; }
      else { a.pe++; b.pe++; a.pts++; b.pts++; }
    }
    const list = [...rows.values()];
    list.forEach(r => { r.dg = r.gf - r.gc; });
    list.sort((x, y) => y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.name.localeCompare(y.name, 'es'));
    standings[g] = list;
  }

  // Cruces por ronda
  const knockout = ROUND_ORDER
    .map(round => ({
      round,
      matches: matches.filter(m => m.round === round).map(m => ({
        num: m.num, team1: m.team1, team2: m.team2, code1: m.code1, code2: m.code2,
        played: m.played, score_home: m.score_home, score_away: m.score_away,
        date: m.date, time: m.time, stadium: m.stadium, city: m.city
      }))
    }))
    .filter(r => r.matches.length);

  return {
    source: 'wikipedia-es',
    sourceUrl: cfg.sourceUrl,
    event: cfg.event,
    meta: {
      totalMatches: matches.length,
      playedMatches: matches.filter(m => m.played).length,
      totalGoals: topScorers.reduce((s, x) => s + x.goals, 0),
      groups: groupLetters.length
    },
    teams, matches, topScorers, standings, knockout
  };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase env vars' }, { status: 500 });
  }

  try {
    const params = new URL(req.url).searchParams;
    const eventKey = params.get('event') || 'worldcup-2026';
    const cfg = EVENTS[eventKey];
    if (!cfg) return jsonResponse({ error: `Unknown event: ${eventKey}` }, { status: 400 });
    const force = ['1', 'true', 'yes'].includes((params.get('force') || '').toLowerCase());

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Caché: si la fila es reciente, no re-scrapear (salvo force).
    const { data: cachedRow, error: cacheReadError } = await supabase
      .from('event_results_cache')
      .select('event,payload,updated_at')
      .eq('event', cfg.event)
      .maybeSingle();
    if (cacheReadError) throw cacheReadError;

    const now = Date.now();
    const cachedMatches: any[] = Array.isArray(cachedRow?.payload?.matches) ? cachedRow!.payload.matches : [];
    // Ventana de partido: algún partido con fecha "hoy" no jugado aún → refresco rápido.
    const matchWindowActive = cachedMatches.some(m => !m.played && m.date);
    const refreshIntervalMs = matchWindowActive ? MATCH_WINDOW_REFRESH_MS : NORMAL_REFRESH_MS;
    const cacheAgeMs = cachedRow?.updated_at ? now - new Date(cachedRow.updated_at).getTime() : Number.POSITIVE_INFINITY;

    if (!force && cachedRow?.payload && Number.isFinite(cacheAgeMs) && cacheAgeMs < refreshIntervalMs) {
      return jsonResponse({
        ok: true, skipped: true, source: 'supabase-cache', event: cfg.event,
        updatedAt: cachedRow.updated_at, matches: cachedMatches.length,
        refreshIntervalMs, matchWindowActive, forced: false
      });
    }

    // Fetch HTML renderizado de Wikipedia
    const response = await fetch(REST_BASE + cfg.restPath, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Porrazo2026 event cache (+https://github.com/r03eRt/porra-mundial-web)'
      }
    });
    if (!response.ok) throw new Error(`Wikipedia responded with HTTP ${response.status}`);
    const html = await response.text();

    const rawMatches = parseMatches(html);
    if (!rawMatches.length) throw new Error('No matches parsed from Wikipedia (template/layout may have changed)');
    const payload = buildPayload(rawMatches, cfg);
    const updatedAt = new Date().toISOString();

    const { error } = await supabase.from('event_results_cache').upsert([{
      event: cfg.event,
      payload: { ...payload, scrapedAt: updatedAt },
      source: 'wikipedia-es',
      source_url: cfg.sourceUrl,
      updated_at: updatedAt
    }], { onConflict: 'event' });
    if (error) throw error;

    return jsonResponse({
      ok: true, skipped: false, source: 'wikipedia-es', event: cfg.event, updatedAt,
      matches: payload.matches.length, played: payload.meta.playedMatches,
      scorers: payload.topScorers.length, groups: payload.meta.groups,
      refreshIntervalMs, matchWindowActive, forced: force
    });
  } catch (error) {
    console.error('sync-wikipedia-results failed:', error);
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
