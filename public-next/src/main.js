import { createClient } from '@supabase/supabase-js';
import {
  scorePrediction, historyPositionChange,
  calculateBestCurrentStreak, pickNextPendingMatch
} from '../../src/lib/porra-core.js';
import { parseScore, normalize, statsCountryFlag, statsCountryLabel, signFromScore } from '../../src/lib/statistics-utils.js';
import { calculateTeamStats, TEAM_DETAIL_METRICS } from '../../src/lib/team-stats.js';

const SUPABASE_URL = 'https://tsbjhbpdvewqysgmrhci.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const PORRA_STATUS_LABELS = {
  draft: 'Borrador',
  open: 'Abierta',
  live: 'En juego',
  playing: 'En juego',
  closed: 'Cerrada'
};

const KNOCKOUT_STAGE_META = {
  r32: { label: 'Dieciseisavos', points: 3, aliases: ['r32', 'round_of_32', 'dieciseisavos', 'dieciseisavos'] },
  r16: { label: 'Octavos', points: 5, aliases: ['r16', 'octavos', 'octavos'] },
  qf: { label: 'Cuartos', points: 7, aliases: ['qf', 'cuartos'] },
  sf: { label: 'Semifinales', points: 10, aliases: ['sf', 'semis', 'semifinales'] },
  final: { label: 'Final', points: 12, aliases: ['final'] },
  champion: { label: 'Campeón', points: 15, aliases: ['1º', 'campeon', 'campeón', 'champion', 'winner'] }
};

const KNOCKOUT_STAGE_ORDER = ['r32', 'r16', 'qf', 'sf', 'final', 'champion'];

const STATS_CONFIG = {
  players: {
    label: 'Jugadores',
    searchPlaceholder: 'Buscar jugador o selección...',
    loadingText: 'Cargando rankings de jugadores...',
    errorText: 'No se pudieron cargar los rankings de jugadores.'
  },
  teams: {
    label: 'Equipos',
    searchPlaceholder: 'Buscar equipo...',
    loadingText: 'Cargando rankings de equipos...',
    errorText: 'No se pudieron cargar los rankings de equipos.'
  }
};

const KNOCKOUT_TEMPLATES = {
  euro_8: {
    id: 'euro_8',
    label: 'Eurocopa 1980-1992 (8 equipos)',
    teams: 8,
    groups: ['A', 'B'],
    knockout: [
      { id: 'F', round: 'final', home: 'A1', away: 'B1' }
    ]
  },
  euro_16: {
    id: 'euro_16',
    label: 'Eurocopa 1996-2012 (16 equipos)',
    teams: 16,
    groups: ['A', 'B', 'C', 'D'],
    knockout: [
      { id: 'QF1', round: 'qf', home: 'A1', away: 'B2' },
      { id: 'QF2', round: 'qf', home: 'B1', away: 'A2' },
      { id: 'QF3', round: 'qf', home: 'C1', away: 'D2' },
      { id: 'QF4', round: 'qf', home: 'D1', away: 'C2' },
      { id: 'SF1', round: 'sf', home: 'W:QF1', away: 'W:QF3' },
      { id: 'SF2', round: 'sf', home: 'W:QF2', away: 'W:QF4' },
      { id: 'F', round: 'final', home: 'W:SF1', away: 'W:SF2' }
    ]
  },
  euro_24: {
    id: 'euro_24',
    label: 'Eurocopa 2016-2028 (24 equipos)',
    teams: 24,
    groups: ['A', 'B', 'C', 'D', 'E', 'F'],
    thirdPlaceQualifiers: 4,
    knockout: [
      { id: 'R16_1', round: 'r16', home: 'B1', away: '3A/B/C/D' },
      { id: 'R16_2', round: 'r16', home: 'A1', away: 'C2' },
      { id: 'R16_3', round: 'r16', home: 'F1', away: '3A/B/C' },
      { id: 'R16_4', round: 'r16', home: 'D2', away: 'E2' },
      { id: 'R16_5', round: 'r16', home: 'E1', away: '3A/B/C/D' },
      { id: 'R16_6', round: 'r16', home: 'D1', away: 'F2' },
      { id: 'R16_7', round: 'r16', home: 'C1', away: '3D/E/F' },
      { id: 'R16_8', round: 'r16', home: 'A2', away: 'B2' },
      { id: 'QF1', round: 'qf', home: 'W:R16_1', away: 'W:R16_2' },
      { id: 'QF2', round: 'qf', home: 'W:R16_3', away: 'W:R16_4' },
      { id: 'QF3', round: 'qf', home: 'W:R16_5', away: 'W:R16_6' },
      { id: 'QF4', round: 'qf', home: 'W:R16_7', away: 'W:R16_8' },
      { id: 'SF1', round: 'sf', home: 'W:QF1', away: 'W:QF2' },
      { id: 'SF2', round: 'sf', home: 'W:QF3', away: 'W:QF4' },
      { id: 'F', round: 'final', home: 'W:SF1', away: 'W:SF2' }
    ]
  },
  worldcup_32: {
    id: 'worldcup_32',
    label: 'Mundial 32 equipos (1998-2022)',
    teams: 32,
    groups: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    knockout: [
      { id: 'R16-1', round: 'r16', home: 'A1', away: 'B2' },
      { id: 'R16-2', round: 'r16', home: 'C1', away: 'D2' },
      { id: 'R16-3', round: 'r16', home: 'E1', away: 'F2' },
      { id: 'R16-4', round: 'r16', home: 'G1', away: 'H2' },
      { id: 'R16-5', round: 'r16', home: 'B1', away: 'A2' },
      { id: 'R16-6', round: 'r16', home: 'D1', away: 'C2' },
      { id: 'R16-7', round: 'r16', home: 'F1', away: 'E2' },
      { id: 'R16-8', round: 'r16', home: 'H1', away: 'G2' },
      { id: 'QF1', round: 'qf', home: 'W:R16-1', away: 'W:R16-2' },
      { id: 'QF2', round: 'qf', home: 'W:R16-3', away: 'W:R16-4' },
      { id: 'QF3', round: 'qf', home: 'W:R16-5', away: 'W:R16-6' },
      { id: 'QF4', round: 'qf', home: 'W:R16-7', away: 'W:R16-8' },
      { id: 'SF1', round: 'sf', home: 'W:QF1', away: 'W:QF2' },
      { id: 'SF2', round: 'sf', home: 'W:QF3', away: 'W:QF4' },
      { id: 'F', round: 'final', home: 'W:SF1', away: 'W:SF2' }
    ]
  },
  worldcup_48: {
    id: 'worldcup_48',
    label: 'Mundial 2026 (48 equipos)',
    teams: 48,
    groups: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
    thirdPlaceQualifiers: 8,
    knockout: [
      { id: 'R32-1', round: 'r32', home: '2A', away: '2B' },
      { id: 'R32-2', round: 'r32', home: '1E', away: '3A/B/C/D/F' },
      { id: 'R32-3', round: 'r32', home: '1F', away: '2C' },
      { id: 'R32-4', round: 'r32', home: '1C', away: '2F' },
      { id: 'R32-5', round: 'r32', home: '1I', away: '3C/D/F/G/H' },
      { id: 'R32-6', round: 'r32', home: '2E', away: '2I' },
      { id: 'R32-7', round: 'r32', home: '1A', away: '3C/E/F/H/I' },
      { id: 'R32-8', round: 'r32', home: '1L', away: '3E/H/I/J/K' },
      { id: 'R32-9', round: 'r32', home: '1D', away: '3B/E/F/I/J' },
      { id: 'R32-10', round: 'r32', home: '1G', away: '3A/E/H/I/J' },
      { id: 'R32-11', round: 'r32', home: '2K', away: '2L' },
      { id: 'R32-12', round: 'r32', home: '1H', away: '2J' },
      { id: 'R32-13', round: 'r32', home: '1B', away: '3E/F/G/I/J' },
      { id: 'R32-14', round: 'r32', home: '1J', away: '2H' },
      { id: 'R32-15', round: 'r32', home: '1K', away: '3D/E/I/J/L' },
      { id: 'R32-16', round: 'r32', home: '2D', away: '2G' },
      { id: 'R16-1', round: 'r16', home: 'W:R32-2', away: 'W:R32-5' },
      { id: 'R16-2', round: 'r16', home: 'W:R32-1', away: 'W:R32-3' },
      { id: 'R16-3', round: 'r16', home: 'W:R32-4', away: 'W:R32-6' },
      { id: 'R16-4', round: 'r16', home: 'W:R32-7', away: 'W:R32-8' },
      { id: 'R16-5', round: 'r16', home: 'W:R32-11', away: 'W:R32-12' },
      { id: 'R16-6', round: 'r16', home: 'W:R32-9', away: 'W:R32-10' },
      { id: 'R16-7', round: 'r16', home: 'W:R32-14', away: 'W:R32-13' },
      { id: 'R16-8', round: 'r16', home: 'W:R32-15', away: 'W:R32-16' },
      { id: 'QF1', round: 'qf', home: 'W:R16-1', away: 'W:R16-2' },
      { id: 'QF2', round: 'qf', home: 'W:R16-3', away: 'W:R16-4' },
      { id: 'QF3', round: 'qf', home: 'W:R16-5', away: 'W:R16-6' },
      { id: 'QF4', round: 'qf', home: 'W:R16-7', away: 'W:R16-8' },
      { id: 'SF1', round: 'sf', home: 'W:QF1', away: 'W:QF2' },
      { id: 'SF2', round: 'sf', home: 'W:QF3', away: 'W:QF4' },
      { id: 'F', round: 'final', home: 'W:SF1', away: 'W:SF2' }
    ]
  }
};

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
const state = {
  slug: null,
  porra: null,
  teams: [],
  groups: [],
  matches: [],
  players: [],
  predictions: [],     // todas las predicciones de la porra (lectura pública)
  knockoutPicks: [],   // pronósticos de cruces (para columna Campeón)
  miniQuestions: [],   // preguntas de la mini-porra
  miniAnswers: [],     // respuestas de los jugadores a la mini
  miniResults: [],     // resultados oficiales de la mini
  miniQuery: '',       // buscador de la clasificación mini
  session: null,       // sesión Supabase Auth
  myPlayerId: null,    // player_id del usuario logueado en esta porra (o null)
  tab: 'ranking',
  myDraft: {},         // ediciones sin guardar: { match_id: "2-1" }
  myMiniDraft: {},     // ediciones sin guardar de mini-porra: { question_id: "..." }
  knockoutPlayerId: null, // jugador seleccionado en la pestaña de cruces
  playerDetailId: null, // jugador seleccionado en "Detalle jugador"
  matchGoalsExpanded: {}, // { match_id: true } goleadores desplegados
  selectedTeamId: null, // equipo seleccionado en "Equipos"
  teamsQuery: '',        // texto del buscador de equipos
  rankingQuery: '',      // buscador de participante en Clasificación
  rankingSort: { key: 'position', direction: 'asc' }, // orden de la tabla
  probabilitiesCache: null, // { key, result } de la última simulación
  probabilitiesExpanded: { players: false, teams: false, mini: false },
  historyCheckpointId: '',   // match_id del snapshot activo en Histórico
  statsMode: 'players',
  statsSelections: { players: '', teams: '' },
  statsSearch: { players: '', teams: '' },
  statsExpanded: { players: false, teams: false },
  statsErrors: { players: false, teams: false },
  playerRankings: null,
  teamRankings: null,
  compareMatchId: '',    // partido seleccionado en Comparador
  comparePlayers: [],    // player_ids añadidos al comparador, en orden
  eventCache: null       // payload de event_results_cache (datos automáticos de Wikipedia)
};

// Evento del caché de resultados que alimenta los datos automáticos (goleadores, etc.).
// Por ahora hardcode al Mundial 2026; más adelante se enlazará por porra (porras.event).
const EVENT_CACHE_KEY = 'worldcup-2026';

let toastTimer = null;

// ---------------------------------------------------------------------------
// Routing por slug:  /p/<slug>   (o ?slug=<slug> como fallback)
// ---------------------------------------------------------------------------
function readSlug() {
  const m = window.location.pathname.match(/\/p\/([^/]+)/);
  if (m) return decodeURIComponent(m[1]);
  const q = new URLSearchParams(window.location.search).get('slug');
  return q || null;
}

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------

// PostgREST aplica un tope server-side (`db-max-rows`, 1000 por defecto) que
// NINGÚN `.limit(n)` del cliente puede superar: pide 5000 y devuelve 1000 igual.
// Con 22+ jugadores, `porra_knockout_picks` (63 filas/jugador = 1386+) y
// `porra_predictions` pasan de 1000, así que la carga se truncaba y los
// jugadores más allá del corte salían sin pronósticos (cuadro de cruces
// derivado de semillas en vez de sus picks). Paginamos en bloques de 1000.
async function fetchAllRows(table, porraId, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('porra_id', porraId)
      .range(from, from + pageSize - 1);
    if (error) { console.error(`fetchAllRows(${table})`, error.message); break; }
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function loadPorra() {
  state.slug = readSlug();
  if (!state.slug) return;

  const { data: porra, error } = await supabase
    .from('porras').select('*').eq('slug', state.slug).maybeSingle();
  if (error || !porra) { state.porra = null; return; }
  state.porra = porra;

  const id = porra.id;
  const [teams, groups, matches, players, predictions, knockoutPicks,
         miniQuestions, miniAnswers, miniResults] = await Promise.all([
    supabase.from('porra_teams').select('*').eq('porra_id', id).order('position'),
    supabase.from('porra_groups').select('*').eq('porra_id', id).order('position'),
    supabase.from('porra_matches').select('*').eq('porra_id', id).order('position'),
    supabase.from('porra_players').select('*').eq('porra_id', id).order('position'),
    fetchAllRows('porra_predictions', id),
    fetchAllRows('porra_knockout_picks', id),
    supabase.from('porra_mini_questions').select('*').eq('porra_id', id).order('position'),
    fetchAllRows('porra_mini_answers', id),
    supabase.from('porra_mini_results').select('*').eq('porra_id', id)
  ]);
  state.groups = groups.data || [];
  // Normalize: resolve team.group_id UUID → group letter so filtering by
  // group letter works consistently across matches (which store group_label)
  // and teams (which store group_id as UUID FK).
  const groupNameById = new Map(state.groups.map(g => [String(g.group_id), String(g.name ?? g.group_id)]));
  state.teams = (teams.data || []).map(t => ({
    ...t,
    group_id: groupNameById.get(String(t.group_id)) ?? t.group_id
  }));
  state.matches = (matches.data || []).map(m => ({
    ...m,
    // normalize: porra_matches uses group_label; legacy uses group_id
    group_id: m.group_id ?? m.group_label ?? null,
    // normalize: porra_matches uses phase; some older code uses stage
    stage: m.stage ?? m.phase ?? null,
    // normalize: porra_matches uses team1_id/team2_id; render code uses team1/team2
    team1: m.team1 ?? m.team1_id ?? null,
    team2: m.team2 ?? m.team2_id ?? null,
  }));
  state.players = players.data || [];
  state.predictions = predictions || [];
  state.knockoutPicks = knockoutPicks || [];
  state.miniQuestions = miniQuestions.data || [];
  state.miniAnswers = miniAnswers || [];
  state.miniResults = miniResults.data || [];

  await loadEventCache();
  await refreshSession();
}

// Caché de resultados del evento (Wikipedia) que alimenta los datos automáticos.
// Lectura pública por RLS. Si falla (sin red, sin caché), se queda en null y las
// secciones que lo usan caen a su fuente manual (porra_matches).
async function loadEventCache() {
  const { data, error } = await supabase
    .from('event_results_cache')
    .select('payload')
    .eq('event', EVENT_CACHE_KEY)
    .maybeSingle();
  if (error) {
    console.error('No se pudo cargar event_results_cache:', error.message);
    state.eventCache = null;
    return;
  }
  state.eventCache = data?.payload || null;
}

async function refreshSession() {
  const { data } = await supabase.auth.getSession();
  state.session = data.session || null;
  state.myPlayerId = null;
  if (state.session && state.porra) {
    const mine = state.players.find(p => p.user_id === state.session.user.id);
    state.myPlayerId = mine ? mine.player_id : null;
  }
  if (!state.knockoutPlayerId && state.myPlayerId) state.knockoutPlayerId = state.myPlayerId;
}

// ---------------------------------------------------------------------------
// Helpers de dominio
// ---------------------------------------------------------------------------
function teamName(teamId) {
  const resolved = resolveKnockoutSeed(teamId);
  const key = knockoutTeamKey(resolved);
  const t = state.teams.find(x => x.team_id === resolved || knockoutTeamKey(x.name) === key);
  if (t) return t.name;
  return knockoutSeedLabel(teamId) || (teamId || '—');
}
function teamFlag(teamId) {
  const resolved = resolveKnockoutSeed(teamId);
  const key = knockoutTeamKey(resolved);
  const t = state.teams.find(x => x.team_id === resolved || knockoutTeamKey(x.name) === key);
  return t && t.flag ? t.flag : '';
}

// Alias de nombres ES (Wikipedia usa nombres largos; las porras a veces cortos).
// Clave y valor se comparan ya normalizados con knockoutTeamKey.
const EVENT_TEAM_ALIASES = {
  'COREA DEL SUR': 'COREA',
  'REPUBLICA CHECA': 'CHEQUIA',
  'ESTADOS UNIDOS': 'EEUU',
  'PAISES BAJOS': 'HOLANDA',
  'REPUBLICA DEMOCRATICA DEL CONGO': 'RD CONGO',
  'BOSNIA Y HERZEGOVINA': 'BOSNIA'
};

// Equipo de la porra que corresponde a un nombre del caché (nombre español de Wikipedia).
// Casa por nombre normalizado, probando también los alias en ambos sentidos. Devuelve
// el team de la porra o null si no hay match.
function eventTeamMatch(name) {
  const key = knockoutTeamKey(name);
  const candidates = new Set([key]);
  if (EVENT_TEAM_ALIASES[key]) candidates.add(knockoutTeamKey(EVENT_TEAM_ALIASES[key]));
  for (const [long, short] of Object.entries(EVENT_TEAM_ALIASES)) {
    if (knockoutTeamKey(short) === key) candidates.add(knockoutTeamKey(long));
  }
  return state.teams.find(x => candidates.has(knockoutTeamKey(x.name))) || null;
}
// Bandera del equipo de la porra mapeado desde un nombre del caché ('' si no hay match).
function eventTeamFlag(name) {
  const t = eventTeamMatch(name);
  return t && t.flag ? t.flag : '';
}
function scoringConfig() {
  const s = state.porra?.scoring || {};
  return { groupExact: s.groupExact ?? 3, groupSign: s.groupSign ?? 1 };
}
function matchResult(match) {
  if (!match) return null;
  const home = match.score_home ?? match.result_home;
  const away = match.score_away ?? match.result_away;
  if (home == null || away == null) return null;
  return { home: Number(home), away: Number(away) };
}
function predictionFor(playerId, matchId) {
  return state.predictions.find(p => p.player_id === playerId && p.match_id === matchId) || null;
}

function predictedResultFor(playerId, matchId) {
  const parsed = parseScore(predictionFor(playerId, matchId)?.score);
  return parsed ? { home: parsed[0], away: parsed[1] } : null;
}

function showAppToast(message, duration = 2400) {
  const text = String(message ?? '').trim();
  if (!text) return;

  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'app-toast';
    toast.hidden = true;
    document.body.appendChild(toast);
  }

  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

function normalizeKnockoutStageKey(value) {
  const raw = String(value || '').trim().toLowerCase();
  for (const [key, meta] of Object.entries(KNOCKOUT_STAGE_META)) {
    if (key === raw || meta.aliases.includes(raw)) return key;
  }
  return raw;
}

function knockoutTeamKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// Parses group seeds in both letter-first (A2) and number-first (2A) formats.
// Returns { letter: 'A', pos: 2 } or null.
function parseGroupSeed(raw) {
  const m = raw.match(/^([A-Z]+)([12])$|^([12])([A-Z]+)$/);
  if (!m) return null;
  return { letter: m[1] || m[4], pos: Number(m[2] || m[3]) };
}

function knockoutSeedLabel(token) {
  const raw = String(token || '').trim();
  const winnerMatch = raw.match(/^W:(.+)$/i);
  if (winnerMatch) return `Ganador ${winnerMatch[1].toUpperCase()}`;
  const seed = parseGroupSeed(raw);
  if (seed) return `${seed.letter}${seed.pos}`;
  return raw;
}

function teamByToken(token) {
  const key = knockoutTeamKey(token);
  return state.teams.find(team => team.team_id === token || knockoutTeamKey(team.name) === key) || null;
}

function computeGroupStandingsByMatches(groupId) {
  const matches = state.matches.filter(match => match.stage === 'group' && (match.group_id ?? match.group_label) === groupId);
  const teamIds = [...new Set(matches.flatMap(match => [match.team1_id ?? match.team1, match.team2_id ?? match.team2]).filter(Boolean))];
  const rows = teamIds.map((team, index) => ({ team, idx: index, pts: 0, gf: 0, gc: 0 }));
  const byTeam = new Map(rows.map(row => [row.team, row]));

  for (const match of matches) {
    const result = matchResult(match);
    if (!result) continue;
    const home = byTeam.get(match.team1_id ?? match.team1);
    const away = byTeam.get(match.team2_id ?? match.team2);
    if (!home || !away) continue;
    home.gf += result.home;
    home.gc += result.away;
    away.gf += result.away;
    away.gc += result.home;
    if (result.home > result.away) home.pts += 3;
    else if (result.away > result.home) away.pts += 3;
    else {
      home.pts += 1;
      away.pts += 1;
    }
  }

  return rows.sort((a, b) =>
    b.pts - a.pts ||
    ((b.gf - b.gc) - (a.gf - a.gc)) ||
    (b.gf - a.gf) ||
    (a.idx - b.idx)
  );
}

// ¿Están jugados TODOS los partidos de un grupo? Solo entonces la clasificación
// (y por tanto las semillas A1/B2…) es "realidad" y no una proyección.
function groupIsComplete(groupId) {
  const matches = state.matches.filter(match => match.stage === 'group' && (match.group_id ?? match.group_label) === groupId);
  if (!matches.length) return false;
  return matches.every(match => matchResult(match));
}

// Resuelve un token de cruce a NOMBRE de equipo real SOLO si está realmente
// decidido: una semilla de grupo (A1/B2) exige que el grupo haya terminado; un
// token de ganador (W:matchId) exige que ese partido tenga resultado. Devuelve ''
// mientras no esté decidido, para no puntuar cruces con grupos a medio jugar.
function knockoutRealityTeamName(token) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  // Equipo real fijado a mano: cuenta directamente.
  if (teamByToken(raw)) return teamName(raw);

  const seed = parseGroupSeed(raw);
  if (seed) {
    if (!groupIsComplete(seed.letter)) return '';
    return teamName(raw);
  }

  const winnerSeed = raw.match(/^W:(.+)$/i);
  if (winnerSeed) {
    const matchId = winnerSeed[1].toUpperCase();
    const match = state.matches.find(item => String(item.match_id || '').toUpperCase() === matchId);
    const winnerToken = knockoutWinnerToken(match);
    if (!winnerToken) return '';
    return knockoutRealityTeamName(winnerToken);
  }

  // Otros placeholders (mejores terceros 3A/B/C…): aún no resolubles → no cuentan.
  return '';
}

function computePredictedGroupStandings(playerId, groupId) {
  const matches = state.matches.filter(match => match.stage === 'group' && (match.group_id ?? match.group_label) === groupId);
  const teams = state.teams.filter(team => String(team.group_id ?? '') === String(groupId));
  const teamIds = teams.length
    ? teams.map(team => team.team_id)
    : [...new Set(matches.flatMap(match => [match.team1_id ?? match.team1, match.team2_id ?? match.team2]).filter(Boolean))];
  const rows = teamIds.map((team, index) => {
    const teamMeta = state.teams.find(item => item.team_id === team) || null;
    return {
      group: groupId,
      team: teamMeta ? teamMeta.name : team,
      teamId: teamMeta ? teamMeta.team_id : team,
      idx: Number(teamMeta?.position) || index,
      pj: 0,
      g: 0,
      e: 0,
      p: 0,
      gf: 0,
      gc: 0,
      pts: 0
    };
  });
  const byTeam = new Map(rows.map(row => [row.team, row]));
  const byTeamId = new Map(rows.map(row => [row.teamId, row]));

  for (const match of matches) {
    const result = predictedResultFor(playerId, match.match_id);
    if (!result) continue;
    const home = byTeamId.get(match.team1_id ?? match.team1) || byTeam.get(teamName(match.team1_id ?? match.team1));
    const away = byTeamId.get(match.team2_id ?? match.team2) || byTeam.get(teamName(match.team2_id ?? match.team2));
    if (!home || !away) continue;
    home.pj++;
    away.pj++;
    home.gf += result.home;
    home.gc += result.away;
    away.gf += result.away;
    away.gc += result.home;
    if (result.home > result.away) {
      home.pts += 3;
      home.g++;
      away.p++;
    } else if (result.away > result.home) {
      away.pts += 3;
      away.g++;
      home.p++;
    } else {
      home.pts++;
      away.pts++;
      home.e++;
      away.e++;
    }
  }

  return rows.sort((a, b) =>
    b.pts - a.pts ||
    ((b.gf - b.gc) - (a.gf - a.gc)) ||
    (b.gf - a.gf) ||
    (a.idx - b.idx)
  );
}

// Letras de grupo reales de la porra (A, B, C…), ordenadas.
function porraGroupLetters() {
  const letters = state.groups.length
    ? state.groups.map(group => String(group.name ?? group.group_id ?? '').trim().toUpperCase())
    : [...new Set(state.teams.map(team => String(team.group_id ?? '').trim().toUpperCase()))];
  return letters.filter(Boolean).sort();
}

// ¿La plantilla encaja con la estructura real de grupos de la porra?
// (mismos grupos y, si aplica, mismos terceros). Evita cargar un bracket de
// otro formato cuando el templateId no está guardado o no concuerda.
function templateFitsStructure(template) {
  if (!template?.groups?.length) return false;
  const actual = porraGroupLetters();
  if (!actual.length) return false;
  const expected = [...template.groups].map(g => String(g).toUpperCase()).sort();
  return actual.length === expected.length &&
    actual.every((letter, index) => letter === expected[index]);
}

// Elige la plantilla cuyos grupos coinciden exactamente con los de la porra.
function templateByStructure() {
  const matches = Object.values(KNOCKOUT_TEMPLATES).filter(templateFitsStructure);
  if (!matches.length) return null;
  // Si varias encajan (mismo nº de grupos), prefiere la que NO use terceros
  // cuando la porra no tiene terceros declarados, y la de menos equipos.
  return matches.sort((a, b) =>
    (a.thirdPlaceQualifiers || 0) - (b.thirdPlaceQualifiers || 0) ||
    (a.teams || 0) - (b.teams || 0)
  )[0];
}

function knockoutTemplateForPorra() {
  const eventKey = String(state.porra?.event_type || '').trim().toLowerCase();
  const templateId = String(state.porra?.scoring?.knockout?.templateId || '').trim().toLowerCase();

  // 1) templateId explícito y existente → manda, salvo que no encaje con la
  //    estructura real (porra mal tipada). En ese caso, se corrige por estructura.
  const explicit = templateId ? KNOCKOUT_TEMPLATES[templateId] : null;
  if (explicit && templateFitsStructure(explicit)) return explicit;

  // 2) Sin templateId válido (o no encaja): elige por la estructura de grupos.
  const byStructure = templateByStructure();
  if (byStructure) return byStructure;

  // 3) Fallback al comportamiento previo por tipo de evento.
  if (explicit) return explicit;
  if (eventKey === 'worldcup') return KNOCKOUT_TEMPLATES.worldcup_48;
  if (eventKey === 'euro') return KNOCKOUT_TEMPLATES.euro_24;
  return null;
}

function knockoutTemplateMatches() {
  return knockoutTemplateForPorra()?.knockout || [];
}

function knockoutTemplateRoundMatches(stageKey) {
  return knockoutTemplateMatches()
    .filter(match => normalizeKnockoutStageKey(match.round) === stageKey);
}

function parseThirdPlaceGroups(token) {
  const text = String(token || '').trim().toUpperCase();
  if (!/^3[A-L](?:\/[A-L])+$/.test(text)) return [];
  return text.slice(1).split('/');
}

function buildPredictedThirdPlaceAssignments(playerId) {
  const template = knockoutTemplateForPorra();
  if (!template?.thirdPlaceQualifiers) return new Map();

  const standingsByGroup = predictedStandingsByPlayer(playerId);
  const thirdPlaceByGroup = new Map();
  for (const groupId of template.groups || []) {
    const standings = standingsByGroup.get(groupId) || [];
    if (standings[2]) thirdPlaceByGroup.set(groupId, standings[2]);
  }

  const bestThirds = [...thirdPlaceByGroup.values()]
    .filter(Boolean)
    .sort((a, b) =>
      b.pts - a.pts ||
      ((b.gf - b.gc) - (a.gf - a.gc)) ||
      (b.gf - a.gf) ||
      a.team.localeCompare(b.team, 'es')
    )
    .slice(0, template.thirdPlaceQualifiers);
  const bestThirdGroups = new Set(bestThirds.map(row => row.group).filter(Boolean));
  const assignments = new Map();
  const used = new Set();

  for (const fixture of template.knockout || []) {
    for (const side of ['home', 'away']) {
      const groups = parseThirdPlaceGroups(fixture[side]);
      if (!groups.length) continue;
      const candidates = groups.filter(group => bestThirdGroups.has(group) && !used.has(group));
      const selectedGroup = candidates[0] || groups.find(group => !used.has(group)) || groups[0];
      const thirdRow = thirdPlaceByGroup.get(selectedGroup);
      if (thirdRow) {
        assignments.set(`${fixture.id}:${side}`, thirdRow.team);
        used.add(selectedGroup);
      }
    }
  }

  return assignments;
}

function resolveTemplateToken(token, playerId, context = {}) {
  const raw = String(token || '').trim();
  if (!raw) return '';

  const directTeam = teamByToken(raw);
  if (directTeam) return directTeam.name;

  const seed = parseGroupSeed(raw);
  if (seed) {
    const standings = context.standingsByGroup?.get(seed.letter) || [];
    return standings[seed.pos - 1]?.team || raw;
  }

  const thirdGroups = parseThirdPlaceGroups(raw);
  if (thirdGroups.length) {
    const assigned = context.thirdPlaceAssignments?.get(`${context.fixtureId}:${context.side}`);
    if (assigned) return assigned;
    for (const groupId of thirdGroups) {
      const thirdRow = context.thirdPlaceByGroup?.get(groupId);
      if (thirdRow?.team) return thirdRow.team;
    }
    return raw;
  }

  return raw;
}

function predictedStandingsByPlayer(playerId) {
  const groups = state.groups.length
    ? state.groups.map(group => group.name ?? group.group_id).filter(Boolean)
    : [...new Set(state.teams.map(team => team.group_id).filter(Boolean))];
  const result = new Map();
  for (const groupId of groups) {
    result.set(String(groupId), computePredictedGroupStandings(playerId, String(groupId)));
  }
  return result;
}

function resolvePlayerGroupSeed(token, playerId, standingsByGroup = predictedStandingsByPlayer(playerId)) {
  const raw = String(token || '').trim();
  if (!raw) return '';

  const directTeam = teamByToken(raw);
  if (directTeam) return directTeam.name;

  const seed = parseGroupSeed(raw);
  if (seed) {
    const standings = standingsByGroup.get(seed.letter) || [];
    return standings[seed.pos - 1]?.team || raw;
  }

  return raw;
}

function knockoutRoundMatches(stageKey) {
  return knockoutMatches()
    .filter(match => normalizeKnockoutStageKey(match.round_key) === stageKey)
    .sort((a, b) =>
      Number(a.position || 0) - Number(b.position || 0) ||
      String(a.match_id || '').localeCompare(String(b.match_id || ''), 'es')
    );
}

function knockoutFixtureTeam(match, side) {
  if (side === 'home') return match.home ?? match.team1_id ?? match.team1 ?? '';
  if (side === 'away') return match.away ?? match.team2_id ?? match.team2 ?? '';
  return '';
}

// Devuelve el token del equipo que pasa de ronda en un cruce, o '' si no está
// decidido. En empate usa pen_winner (ganador por penaltis) introducido por el admin.
function knockoutWinnerToken(match) {
  if (!match) return '';
  const result = matchResult(match);
  if (!result) return '';
  if (result.home > result.away) return match.team1_id ?? match.team1;
  if (result.away > result.home) return match.team2_id ?? match.team2;
  if (match.pen_winner === 'team1') return match.team1_id ?? match.team1;
  if (match.pen_winner === 'team2') return match.team2_id ?? match.team2;
  return '';
}

function resolveKnockoutSeed(token, seen = new Set()) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  if (seen.has(raw)) return raw;
  seen.add(raw);

  const directTeam = teamByToken(raw);
  if (directTeam) return directTeam.team_id;

  const seed = parseGroupSeed(raw);
  if (seed) {
    const standings = computeGroupStandingsByMatches(seed.letter);
    return standings[seed.pos - 1]?.team || raw;
  }

  const winnerSeed = raw.match(/^W:(.+)$/i);
  if (winnerSeed) {
    const matchId = winnerSeed[1].toUpperCase();
    const match = state.matches.find(item => String(item.match_id || '').toUpperCase() === matchId);
    const winnerToken = knockoutWinnerToken(match);
    if (!winnerToken) return raw;
    return resolveKnockoutSeed(winnerToken, seen);
  }

  return raw;
}

function knockoutScoringConfig() {
  const raw = state.porra?.scoring?.knockout || {};
  return KNOCKOUT_STAGE_ORDER.reduce((acc, key) => {
    acc[key] = Number(raw[key] ?? KNOCKOUT_STAGE_META[key]?.points ?? 0) || 0;
    return acc;
  }, {});
}

function knockoutMatches() {
  return state.matches.filter(match => match.stage === 'knockout');
}

function knockoutStages() {
  const scoring = knockoutScoringConfig();
  const configured = Array.isArray(state.porra?.knockout_structure) ? state.porra.knockout_structure : [];
  const structure = configured
    .map(item => {
      const key = normalizeKnockoutStageKey(item?.key);
      if (!KNOCKOUT_STAGE_META[key] || key === 'champion') return null;
      return {
        key,
        label: String(item?.label || KNOCKOUT_STAGE_META[key].label),
        teams: Math.max(0, Number(item?.teams || 0) || 0),
        points: Number(item?.points ?? scoring[key]) || 0
      };
    })
    .filter(Boolean);

  if (structure.length) {
    return [...structure, { key: 'champion', label: KNOCKOUT_STAGE_META.champion.label, teams: 1, points: scoring.champion }];
  }

  const template = knockoutTemplateForPorra();
  if (template?.knockout?.length) {
    const counts = { r32: 0, r16: 0, qf: 0, sf: 0, final: 0 };
    for (const match of template.knockout) {
      const roundKey = normalizeKnockoutStageKey(match.round);
      if (counts[roundKey] != null) counts[roundKey] += 1;
    }
    const derived = KNOCKOUT_STAGE_ORDER
      .filter(key => key !== 'champion' && counts[key] > 0)
      .map(key => ({
        key,
        label: KNOCKOUT_STAGE_META[key].label,
        teams: counts[key] * 2,
        points: scoring[key]
      }));
    if (derived.length) {
      return [...derived, { key: 'champion', label: KNOCKOUT_STAGE_META.champion.label, teams: 1, points: scoring.champion }];
    }
  }

  const derived = KNOCKOUT_STAGE_ORDER
    .filter(key => key !== 'champion')
    .map(key => {
      const matches = knockoutMatches().filter(match => normalizeKnockoutStageKey(match.round_key) === key);
      if (!matches.length) return null;
      return {
        key,
        label: KNOCKOUT_STAGE_META[key].label,
        teams: matches.length * 2,
        points: scoring[key]
      };
    })
    .filter(Boolean);

  if (!derived.length) return [];
  return [...derived, { key: 'champion', label: KNOCKOUT_STAGE_META.champion.label, teams: 1, points: scoring.champion }];
}

function knockoutRoundStages() {
  return knockoutStages().filter(stage => stage.key !== 'champion');
}

function knockoutPickFor(playerId, stageKey, slot) {
  return state.knockoutPicks.find(pick =>
    pick.player_id === playerId &&
    normalizeKnockoutStageKey(pick.stage) === stageKey &&
    Number(pick.slot) === Number(slot)
  ) || null;
}

function knockoutStagePicks(playerId, stageKey, expectedTeams = 0) {
  const picks = state.knockoutPicks
    .filter(pick => pick.player_id === playerId && normalizeKnockoutStageKey(pick.stage) === stageKey)
    .sort((a, b) => Number(a.slot) - Number(b.slot))
    .map(pick => String(pick.team || '').trim());

  const size = Math.max(expectedTeams, picks.length);
  return Array.from({ length: size }, (_, index) => picks[index] || '');
}

function uniqueTeamList(teams) {
  const seen = new Set();
  return teams.filter(team => {
    const key = knockoutTeamKey(team);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function predictedQualifiedTeams(playerId) {
  const template = knockoutTemplateForPorra();
  const standingsByGroup = predictedStandingsByPlayer(playerId);
  const teams = [];
  const thirdPlaceRows = [];

  for (const groupId of template?.groups || [...standingsByGroup.keys()]) {
    const standings = standingsByGroup.get(groupId) || [];
    if (standings[0]?.team) teams.push(standings[0].team);
    if (standings[1]?.team) teams.push(standings[1].team);
    if (standings[2]?.team) thirdPlaceRows.push(standings[2]);
  }

  const thirdPlaceQualifiers = Number(template?.thirdPlaceQualifiers || 0);
  if (thirdPlaceQualifiers > 0) {
    const bestThirds = thirdPlaceRows
      .filter(Boolean)
      .sort((a, b) =>
        b.pts - a.pts ||
        ((b.gf - b.gc) - (a.gf - a.gc)) ||
        (b.gf - a.gf) ||
        String(a.team).localeCompare(String(b.team), 'es')
      )
      .slice(0, thirdPlaceQualifiers);
    teams.push(...bestThirds.map(row => row.team));
  }

  return uniqueTeamList(teams);
}

// Token "W:<id>" → índice de ese partido dentro de su ronda en la plantilla.
// Permite seguir el cableado real del bracket (p. ej. R16-1 = W:R32-2 + W:R32-5),
// en vez de asumir que cada cruce se alimenta de las dos posiciones contiguas.
function templateFixtureIndexById(matchId) {
  const target = String(matchId || '').trim().toUpperCase();
  if (!target) return -1;
  const fixtures = knockoutTemplateMatches();
  const fixture = fixtures.find(m => String(m.id || '').toUpperCase() === target);
  if (!fixture) return -1;
  const roundKey = normalizeKnockoutStageKey(fixture.round);
  const roundFixtures = fixtures.filter(m => normalizeKnockoutStageKey(m.round) === roundKey);
  return roundFixtures.findIndex(m => String(m.id || '').toUpperCase() === target);
}

// Equipos que pueden ganar un cruce de una ronda > 0: los ganadores que el
// jugador ya tenga puestos en los dos cruces que lo alimentan según la plantilla.
// Si la plantilla no usa "W:" (o no hay plantilla), cae a posiciones contiguas.
function feedersForKnockoutMatch(stageKey, matchIndex, bracket, previousStageKey) {
  const previousRound = bracket?.[previousStageKey] || [];
  const stageFixtures = knockoutTemplateRoundMatches(stageKey);
  const fixture = stageFixtures[matchIndex];
  const winnerTokens = fixture
    ? ['home', 'away']
        .map(side => String(knockoutFixtureTeam(fixture, side) || '').match(/^W:(.+)$/i)?.[1])
        .filter(Boolean)
    : [];

  if (winnerTokens.length === 2) {
    return winnerTokens.map(id => previousRound[templateFixtureIndexById(id)] || '');
  }

  // Fallback: cruces contiguos (plantillas con bracket adyacente o sin "W:").
  const pairIndex = matchIndex * 2;
  return [previousRound[pairIndex], previousRound[pairIndex + 1]];
}

function allowedTeamsForKnockoutSlot(playerId, stageKey, slot, bracket) {
  const roundStages = knockoutRoundStages();
  const stageIndex = roundStages.findIndex(stage => stage.key === stageKey);
  if (stageIndex < 0) return [];

  if (stageIndex === 0) {
    const templateMatches = knockoutTemplateRoundMatches(stageKey);
    const matchIndex = Math.floor((Number(slot) - 1) / 2);
    const fixture = templateMatches[matchIndex];
    if (!fixture) return predictedQualifiedTeams(playerId);
    const side = Number(slot) % 2 === 1 ? 'home' : 'away';
    const context = {
      standingsByGroup: predictedStandingsByPlayer(playerId),
      thirdPlaceByGroup: new Map(),
      thirdPlaceAssignments: buildPredictedThirdPlaceAssignments(playerId),
      fixtureId: fixture.id,
      side
    };
    const token = knockoutFixtureTeam(fixture, side);
    return uniqueTeamList([resolveTemplateToken(token, playerId, context)].filter(Boolean));
  }

  const previousStage = roundStages[stageIndex - 1];
  const matchIndex = Number(slot) - 1;
  return uniqueTeamList(
    feedersForKnockoutMatch(stageKey, matchIndex, bracket, previousStage.key).filter(Boolean)
  );
}

function allowedTeamsForChampionSlot(playerId, bracket, finalStageKey) {
  return uniqueTeamList((bracket?.[finalStageKey] || []).filter(Boolean));
}

// ¿Tiene el jugador ALGÚN dato propio de cruces? O picks explícitos de cruces, o
// predicciones de grupo (de las que se deriva la primera ronda). Sin nada de esto
// no debe mostrarse un cuadro derivado de las semillas por defecto: un jugador
// recién añadido no ha pronosticado nada y su cruce debe salir vacío.
function playerHasKnockoutInput(playerId) {
  const hasKnockoutPicks = state.knockoutPicks.some(p => p.player_id === playerId && String(p.team || '').trim());
  if (hasKnockoutPicks) return true;
  const hasGroupPredictions = state.predictions.some(p =>
    p.player_id === playerId && parseScore(p.score));
  return hasGroupPredictions;
}

function buildPlayerKnockoutBracket(playerId) {
  const roundStages = knockoutRoundStages();
  if (!roundStages.length) return {};
  // Jugador sin ningún pronóstico → cuadro vacío (no derivar de semillas por defecto).
  if (!playerHasKnockoutInput(playerId)) {
    const empty = {};
    for (const stage of roundStages) empty[stage.key] = Array.from({ length: stage.teams }, () => '');
    return empty;
  }

  const bracket = {};
  const standingsByGroup = predictedStandingsByPlayer(playerId);
  const template = knockoutTemplateForPorra();
  const thirdPlaceByGroup = new Map();
  if (template?.thirdPlaceQualifiers) {
    for (const groupId of template.groups || []) {
      const standings = standingsByGroup.get(groupId) || [];
      if (standings[2]) thirdPlaceByGroup.set(groupId, standings[2]);
    }
  }
  const thirdPlaceAssignments = buildPredictedThirdPlaceAssignments(playerId);
  const firstStage = roundStages[0];

  // Prefer explicit first-round picks if the player has a full set saved
  // (e.g. legacy import where DIECISEISAVOS slots 1-32 were stored explicitly).
  // Otherwise fall back to deriving from group-stage predictions.
  const explicitFirst = knockoutStagePicks(playerId, firstStage.key, 0).filter(Boolean);
  if (explicitFirst.length >= firstStage.teams) {
    bracket[firstStage.key] = Array.from({ length: firstStage.teams }, (_, i) => explicitFirst[i] || '');
  } else {
    const firstStageMatches = knockoutRoundMatches(firstStage.key);
    const sourceMatches = firstStageMatches.length ? firstStageMatches : knockoutTemplateRoundMatches(firstStage.key);
    const firstStageDefaults = sourceMatches.flatMap((match, index) => [
      resolveTemplateToken(knockoutFixtureTeam(match, 'home'), playerId, {
        standingsByGroup,
        thirdPlaceByGroup,
        thirdPlaceAssignments,
        fixtureId: match.match_id || match.id || `${firstStage.key}:${index}`,
        side: 'home'
      }),
      resolveTemplateToken(knockoutFixtureTeam(match, 'away'), playerId, {
        standingsByGroup,
        thirdPlaceByGroup,
        thirdPlaceAssignments,
        fixtureId: match.match_id || match.id || `${firstStage.key}:${index}`,
        side: 'away'
      })
    ]);
    bracket[firstStage.key] = firstStageDefaults.map(team => team || '');
  }

  let previousStageKey = firstStage.key;
  for (const stage of roundStages.slice(1)) {
    const selectedTeams = knockoutStagePicks(playerId, stage.key, stage.teams);
    const matchCount = Math.floor((bracket[previousStageKey] || []).length / 2);
    bracket[stage.key] = [];
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const saved = selectedTeams[matchIndex] || '';
      // Use the saved pick directly — the allowed check was too strict for
      // imported data where slot numbering may differ from the template wiring.
      // Validation only makes sense in the interactive editor.
      bracket[stage.key].push(saved);
    }

    previousStageKey = stage.key;
  }

  return bracket;
}

function knockoutChampionPick(playerId) {
  const pick = knockoutPickFor(playerId, 'champion', 1);
  return pick ? String(pick.team || '').trim() : '';
}

function winnerFromMatch(match) {
  // team1/team2 pueden ser semillas (A1) o ganadores (W:id); resuélvelas a NOMBRE real.
  // En empate, knockoutWinnerToken usa pen_winner.
  const winnerToken = knockoutWinnerToken(match);
  return winnerToken ? teamName(winnerToken) : '';
}

function buildKnockoutReality() {
  const roundStages = knockoutRoundStages();
  const reality = {};

  for (const stage of roundStages) {
    const matches = knockoutMatches().filter(match => normalizeKnockoutStageKey(match.round_key) === stage.key);
    const teams = new Set();
    for (const match of matches) {
      // Las plantillas guardan semillas (A1, B2) o ganadores (W:matchId) en team1/team2.
      // Resuélvelas a NOMBRE de equipo real SOLO si la ronda está realmente decidida
      // (grupo terminado para semillas, partido con resultado para ganadores): así no
      // se puntúan cruces mientras la fase de grupos sigue en juego.
      const raw1 = match.team1_id ?? match.team1;
      const raw2 = match.team2_id ?? match.team2;
      const t1 = knockoutRealityTeamName(raw1);
      const t2 = knockoutRealityTeamName(raw2);
      if (t1) teams.add(knockoutTeamKey(t1));
      if (t2) teams.add(knockoutTeamKey(t2));
    }
    reality[stage.key] = {
      key: stage.key,
      label: stage.label,
      points: stage.points,
      expected: stage.teams,
      resolved: teams.size,
      complete: stage.teams > 0 && teams.size >= stage.teams,
      teams
    };
  }

  const finalMatch = knockoutMatches().find(match => normalizeKnockoutStageKey(match.round_key) === 'final');
  const champion = winnerFromMatch(finalMatch);
  reality.champion = {
    key: 'champion',
    label: KNOCKOUT_STAGE_META.champion.label,
    points: knockoutScoringConfig().champion,
    expected: 1,
    resolved: champion ? 1 : 0,
    complete: Boolean(champion),
    teams: champion ? new Set([knockoutTeamKey(champion)]) : new Set()
  };

  return reality;
}

function calculatePlayerKnockout(playerId, reality = buildKnockoutReality()) {
  const breakdown = {};
  let points = 0;

  // El cuadro derivado del jugador combina la primera ronda (auto desde sus
  // grupos) con las rondas siguientes guardadas. Es la fuente de sus pronósticos.
  const bracket = buildPlayerKnockoutBracket(playerId);

  for (const stage of knockoutStages()) {
    const stageReality = reality[stage.key] || {
      key: stage.key,
      label: stage.label,
      points: stage.points,
      expected: stage.teams,
      resolved: 0,
      complete: false,
      teams: new Set()
    };
    const predictions = stage.key === 'champion'
      ? [knockoutChampionPick(playerId)].filter(Boolean)
      : (bracket[stage.key] || []).filter(Boolean);
    const hits = predictions.filter(team => stageReality.teams.has(knockoutTeamKey(team))).length;
    const stagePoints = hits * stage.points;
    breakdown[stage.key] = { ...stageReality, hits, points: stagePoints };
    points += stagePoints;
  }

  return { points, breakdown };
}

// Campeón que predijo el jugador (porra_knockout_picks, stage final). '' si no.
function championPickFor(playerId) {
  return knockoutChampionPick(playerId);
}

function refreshPredictionsFromState() {
  return fetchAllRows('porra_predictions', state.porra.id)
    .then(rows => {
      state.predictions = rows;
    });
}

function matchRowInput(matchId) {
  return document.querySelector(`[data-match="${matchId}"]`);
}

function matchRowStatus(matchId) {
  return document.querySelector(`[data-status="${matchId}"]`);
}

function draftScoreForMatch(matchId) {
  const input = matchRowInput(matchId);
  return String(state.myDraft[matchId] ?? input?.value ?? '').trim();
}

async function savePredictionRow(matchId, score) {
  const { error } = await supabase
    .from('porra_predictions')
    .upsert([{
      porra_id: state.porra.id,
      player_id: state.myPlayerId,
      match_id: matchId,
      score
    }], { onConflict: 'porra_id,player_id,match_id' });

  if (error) throw error;
  await refreshPredictionsFromState();
  delete state.myDraft[matchId];
  render();
}

async function deletePredictionRow(matchId) {
  const { error } = await supabase
    .from('porra_predictions')
    .delete()
    .eq('porra_id', state.porra.id)
    .eq('player_id', state.myPlayerId)
    .eq('match_id', matchId);

  if (error) throw error;
  await refreshPredictionsFromState();
  delete state.myDraft[matchId];
  render();
}

function draftMiniScoreForQuestion(questionId) {
  const input = document.querySelector(`[data-mini-answer-form][data-question-id="${questionId}"] .mini-answer-input`);
  return String(state.myMiniDraft[questionId] ?? input?.value ?? '').trim();
}

function miniQuestionStatus(questionId) {
  return document.querySelector(`[data-mini-status="${questionId}"]`);
}

async function saveMiniAnswer(questionId) {
  const status = miniQuestionStatus(questionId);
  if (!state.myPlayerId) {
    showAppToast('Necesitas entrar para guardar tus respuestas.');
    return;
  }
  if (!miniEditOpen()) {
    if (status) status.textContent = 'Edición cerrada.';
    showAppToast('La porra no está abierta o ya pasó el deadline.');
    return;
  }

  const value = draftMiniScoreForQuestion(questionId);
  if (status) status.textContent = 'Guardando…';
  if (!value) {
    if (status) status.textContent = 'Introduce una respuesta.';
    showAppToast('Introduce una respuesta.');
    return;
  }

  try {
    await saveMiniAnswerRow(questionId, value);
    const nextStatus = miniQuestionStatus(questionId);
    if (nextStatus) nextStatus.textContent = 'Guardado ✓';
    showAppToast('Respuesta de mini-porra guardada.');
  } catch (error) {
    if (status) status.textContent = 'Error: ' + error.message;
    showAppToast(`No se pudo guardar: ${error.message}`, 3600);
  }
}

async function clearMiniAnswer(questionId) {
  const status = miniQuestionStatus(questionId);
  if (!state.myPlayerId) {
    showAppToast('Necesitas entrar para borrar tus respuestas.');
    return;
  }
  if (!miniEditOpen()) {
    if (status) status.textContent = 'Edición cerrada.';
    showAppToast('La porra no está abierta o ya pasó el deadline.');
    return;
  }

  if (status) status.textContent = 'Borrando…';

  try {
    await deleteMiniAnswerRow(questionId);
    const nextStatus = miniQuestionStatus(questionId);
    if (nextStatus) nextStatus.textContent = 'Borrada.';
    showAppToast('Respuesta de mini-porra borrada.');
  } catch (error) {
    if (status) status.textContent = 'Error: ' + error.message;
    showAppToast(`No se pudo borrar: ${error.message}`, 3600);
  }
}

async function refreshKnockoutPicksFromState() {
  state.knockoutPicks = await fetchAllRows('porra_knockout_picks', state.porra.id);
}

// Re-renderiza solo la pestaña de cruces conservando lo que el usuario haya
// dejado escrito en otros selects sin guardar todavía. `skipKey` es el
// `stageKey:slot` que se acaba de guardar/limpiar (ese sí toma el valor de la BD).
function rerenderKnockoutPreservingDrafts(skipKey = '') {
  if (state.tab !== 'knockout') { render(); return; }

  const drafts = new Map();
  document.querySelectorAll('[data-knockout-input]').forEach(select => {
    const key = select.getAttribute('data-knockout-input');
    if (key && key !== skipKey) drafts.set(key, select.value);
  });

  renderKnockout();

  drafts.forEach((value, key) => {
    const select = document.querySelector(`[data-knockout-input="${CSS.escape(key)}"]`);
    if (!select || select.disabled) return;
    // Solo restaura si la opción sigue siendo válida en la nueva estructura.
    if ([...select.options].some(option => option.value === value)) {
      select.value = value;
    }
  });
}

function knockoutEditOpen() {
  return Boolean(state.myPlayerId) &&
    state.porra.status === 'open' &&
    (!state.porra.predictions_deadline || new Date() < new Date(state.porra.predictions_deadline));
}

function knockoutInputValue(stageKey, slot) {
  const input = document.querySelector(`[data-knockout-input="${stageKey}:${slot}"]`);
  return String(input?.value || '').trim();
}

function knockoutRowStatus(stageKey, slot) {
  return document.querySelector(`[data-knockout-status="${stageKey}:${slot}"]`);
}

async function saveKnockoutPick(stageKey, slot) {
  const status = knockoutRowStatus(stageKey, slot);
  if (!state.myPlayerId) {
    showAppToast('Necesitas entrar para guardar tus cruces.');
    return;
  }
  const stageIndex = knockoutRoundStages().findIndex(stage => stage.key === normalizeKnockoutStageKey(stageKey));
  if (stageIndex === 0) {
    if (status) status.textContent = 'Ronda automática.';
    showAppToast('Los cruces iniciales se generan automáticamente desde la fase de grupos.');
    return;
  }
  if (!knockoutEditOpen()) {
    if (status) status.textContent = 'Edición cerrada.';
    showAppToast('La porra no está abierta o ya pasó el deadline.');
    return;
  }

  const team = knockoutInputValue(stageKey, slot);
  const currentBracket = buildPlayerKnockoutBracket(state.myPlayerId);
  const allowedTeams = stageKey === 'champion'
    ? allowedTeamsForChampionSlot(state.myPlayerId, currentBracket, knockoutRoundStages().at(-1)?.key || '')
    : allowedTeamsForKnockoutSlot(state.myPlayerId, stageKey, slot, currentBracket);
  if (status) status.textContent = 'Guardando…';
  if (!team) {
    await clearKnockoutPick(stageKey, slot);
    return;
  }
  if (!allowedTeams.some(option => knockoutTeamKey(option) === knockoutTeamKey(team))) {
    if (status) status.textContent = 'Opción no válida.';
    showAppToast('Esa selección no es válida para este tramo.', 3600);
    return;
  }

  const { error } = await supabase
    .from('porra_knockout_picks')
    .upsert([{
      porra_id: state.porra.id,
      player_id: state.myPlayerId,
      stage: stageKey,
      slot: Number(slot),
      team
    }], { onConflict: 'porra_id,player_id,stage,slot' });

  if (error) {
    if (status) status.textContent = 'Error: ' + error.message;
    showAppToast(`No se pudo guardar: ${error.message}`, 3600);
    return;
  }

  await refreshKnockoutPicksFromState();
  rerenderKnockoutPreservingDrafts(`${stageKey}:${slot}`);
  const nextStatus = knockoutRowStatus(stageKey, slot);
  if (nextStatus) nextStatus.textContent = 'Guardado ✓';
  showAppToast('Cruce guardado.');
}

async function clearKnockoutPick(stageKey, slot) {
  const status = knockoutRowStatus(stageKey, slot);
  if (!state.myPlayerId) {
    showAppToast('Necesitas entrar para borrar tus cruces.');
    return;
  }
  if (!knockoutEditOpen()) {
    if (status) status.textContent = 'Edición cerrada.';
    showAppToast('La porra no está abierta o ya pasó el deadline.');
    return;
  }

  if (status) status.textContent = 'Borrando…';
  const { error } = await supabase
    .from('porra_knockout_picks')
    .delete()
    .eq('porra_id', state.porra.id)
    .eq('player_id', state.myPlayerId)
    .eq('stage', stageKey)
    .eq('slot', Number(slot));

  if (error) {
    if (status) status.textContent = 'Error: ' + error.message;
    showAppToast(`No se pudo borrar: ${error.message}`, 3600);
    return;
  }

  await refreshKnockoutPicksFromState();
  rerenderKnockoutPreservingDrafts(`${stageKey}:${slot}`);
  const nextStatus = knockoutRowStatus(stageKey, slot);
  if (nextStatus) nextStatus.textContent = 'Borrado.';
  showAppToast('Cruce borrado.');
}

function knockoutPointsFor(playerId) {
  return calculatePlayerKnockout(playerId).points;
}

// Devuelve filas con todas las columnas de la clasificación legacy.
function computeRanking() {
  const scoring = scoringConfig();
  const groupMatches = state.matches.filter(m => m.stage === 'group');
  const rows = state.players.map(player => {
    let groupPoints = 0, exacts = 0, signs = 0;
    for (const match of groupMatches) {
      const result = matchResult(match);
      if (!result) continue;
      const pred = predictionFor(player.player_id, match.match_id);
      if (!pred) continue;
      const r = scorePrediction({ score: pred.score }, result, scoring);
      groupPoints += r.points;
      if (r.exact) exacts++;
      else if (r.sign) signs++;
    }
    const knockoutPoints = knockoutPointsFor(player.player_id);
    return {
      id: player.player_id,
      player,
      name: player.name,
      groupPoints,
      exacts,
      signs,
      hits: signs + exacts,
      knockoutPoints,
      total: groupPoints + knockoutPoints,
      championPick: championPickFor(player.player_id)
    };
  }).sort((a, b) => b.total - a.total || b.exacts - a.exacts || a.name.localeCompare(b.name, 'es'));
  // posición 1..n tras el orden por defecto
  rows.forEach((r, i) => { r.position = i + 1; });
  return rows;
}

function sortRankingRows(rows, sort) {
  const dir = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const f = a[sort.key], s = b[sort.key];
    const cmp = typeof f === 'string'
      ? String(f).localeCompare(String(s), 'es', { sensitivity: 'base' })
      : Number(f) - Number(s);
    return cmp * dir || a.position - b.position;
  });
}

function sortableHeader(key, label, className = '') {
  const sort = state.rankingSort;
  const active = sort.key === key;
  const indicator = active ? (sort.direction === 'asc' ? '▲' : '▼') : '';
  return `<th class="${className}"><button type="button" class="sort-button ${className} ${active ? 'active' : ''} ${active ? sort.direction : ''}" data-sort-key="${key}"><span>${indicator}</span>${label}</button></th>`;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const $app = document.getElementById('app');
const $title = document.getElementById('porra-title');
const $session = document.getElementById('session');
const $tabs = document.getElementById('tabs');

function render() {
  if (!state.slug) { renderNoSlug(); return; }
  if (!state.porra) { renderNotFound(); return; }

  $title.textContent = state.porra.name;
  const $sub = document.getElementById('porra-subtitle');
  if ($sub) $sub.textContent = PORRA_STATUS_LABELS[state.porra.status] || '';
  renderSessionBar();
  renderSummary();

  // Si la pestaña activa ya no es visible (p.ej. logout en "Mi porra"), volver a ranking
  if (!visibleTabs().some(t => t.key === state.tab)) state.tab = 'ranking';
  renderTabs();

  const tab = TABS.find(t => t.key === state.tab);
  if (tab && !tab.ready) { renderPlaceholder(tab); return; }

  switch (state.tab) {
    case 'ranking': renderRanking(); break;
    case 'history': renderHistory(); break;
    case 'matches': renderMatches(); break;
    case 'mine': renderMyPorra(); break;
    case 'groupStandings': renderGroupStandings(); break;
    case 'teams': renderTeams(); break;
    case 'player': renderPlayerDetail(); break;
    case 'mini': renderMini(); break;
    case 'knockout': renderKnockout(); break;
    case 'bestThirds': renderBestThirds(); break;
    case 'topScorers': renderTopScorers(); break;
    case 'probabilities': renderProbabilities(); break;
    case 'statistics': renderStatistics(); break;
    case 'compare': renderCompare(); break;
    default: renderRanking();
  }
}

function renderPlaceholder(tab) {
  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>${esc(tab.label)}</h2></div>
      <p class="empty-state">Esta sección estará disponible próximamente.<br>
      En la app del Mundial existe; aquí se irá portando con los datos de esta porra.</p>
    </div>`;
}

function renderNoSlug() {
  $title.textContent = 'Porra';
  $tabs.innerHTML = '';
  $session.innerHTML = '';
  $app.innerHTML = `<div class="panel"><p>Abre una porra con la URL <code>/p/&lt;slug&gt;</code>.</p></div>`;
}
function renderNotFound() {
  $title.textContent = 'Porra';
  $tabs.innerHTML = '';
  $session.innerHTML = '';
  $app.innerHTML = `<div class="panel"><p>No existe ninguna porra con el slug <strong>${esc(state.slug)}</strong>.</p></div>`;
}

function renderSessionBar() {
  if (state.session) {
    const who = state.myPlayerId
      ? `Jugando como <strong>${esc(playerName(state.myPlayerId))}</strong>`
      : `Conectado (no eres jugador de esta porra)`;
    $session.innerHTML = `<span>${who}</span> <button data-action="logout">Salir</button>`;
  } else {
    $session.innerHTML = `<button data-action="show-login">Entrar para jugar</button>`;
  }
}

function playerName(playerId) {
  const p = state.players.find(x => x.player_id === playerId);
  return p ? p.name : playerId;
}

// Menú espejo de la app legacy (sin las pestañas de admin). Las que aún no
// tienen lógica se renderizan con placeholder. "Mi porra" solo si hay jugador.
const TABS = [
  { key: 'ranking', label: 'Clasificación porra', ready: true },
  { key: 'mine', label: '✏️ Editar mi porra', ready: true, playerOnly: true },
  { key: 'history', label: 'Histórico', ready: true },
  { key: 'mini', label: 'Mini-porra', ready: true },
  { key: 'matches', label: 'Partidos', ready: true },
  { key: 'knockout', label: 'Cruces', ready: true },
  { key: 'groupStandings', label: 'Clasificación grupos', ready: true },
  { key: 'player', label: 'Detalle jugador', ready: true },
  { key: 'teams', label: 'Equipos', ready: true },
  { key: 'bestThirds', label: 'Mejores terceros', ready: true },
  { key: 'topScorers', label: 'Máximos goleadores', ready: true },
  { key: 'probabilities', label: 'Probabilidades', ready: true },
  { key: 'statistics', label: 'Estadísticas', ready: true },
  { key: 'compare', label: 'Comparador', ready: true }
];

function visibleTabs() {
  return TABS.filter(t => !t.playerOnly || state.myPlayerId);
}

function renderTabs() {
  $tabs.innerHTML = visibleTabs().map(t =>
    `<button class="tab ${state.tab === t.key ? 'active' : ''} ${t.ready ? '' : 'soon'}" data-tab="${t.key}">${t.label}</button>`
  ).join('');
}

// Pronóstico más elegido para un partido (entre las predicciones guardadas).
function mostChosenPredictionFor(match) {
  const counts = new Map();
  for (const p of state.predictions) {
    if (p.match_id !== match.match_id) continue;
    const s = String(p.score || '').trim();
    if (!s) continue;
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  if (!entries.length) return null;
  return { score: entries[0][0], votes: entries[0][1] };
}

// Chips de goleadores para la tarjeta de resumen (mismo estilo que la legacy).
function summaryGoalChips(m) {
  const goals = goalBreakdown(m);
  if (!goals) return '';
  const all = [
    ...goals.team1.map(g => ({ ...g, flag: teamFlag(m.team1) })),
    ...goals.team2.map(g => ({ ...g, flag: teamFlag(m.team2) }))
  ];
  if (!all.length) return '';
  return `<div class="live-event-list last-match-events">${all.map(g => {
    const icon = g.ownGoal ? '↺' : (g.penalty ? '🎯' : '⚽');
    return `<span class="live-event-chip goal"><span class="live-event-icon">${icon}</span><span>${esc(g.name)} ${g.flag}</span><span class="live-event-minute">${g.minute ? esc(String(g.minute)) + "'" : ''}</span></span>`;
  }).join('')}</div>`;
}

function renderSummary() {
  const $summary = document.getElementById('summary');
  if (!$summary) return;
  const groupMatches = state.matches.filter(m => m.stage === 'group');
  const playedMatches = groupMatches.filter(m => matchResult(m));
  const ranking = computeRanking();
  const ts = m => (m.kickoff ? new Date(m.kickoff).getTime() : Number.MAX_SAFE_INTEGER);

  // último partido jugado (por fecha)
  const lastPlayed = [...playedMatches].sort((a, b) => ts(a) - ts(b)).at(-1) || null;
  // siguiente partido pendiente
  const nextMatch = pickNextPendingMatch(groupMatches, m => matchResult(m), ts);
  const mostChosen = nextMatch ? mostChosenPredictionFor(nextMatch) : null;
  // mejor racha actual
  const bestStreak = calculateBestCurrentStreak(
    state.players,
    [...playedMatches].sort((a, b) => ts(a) - ts(b)),
    (match, player) => { const p = predictionFor(player.player_id, match.match_id); return p ? { score: p.score } : null; },
    match => matchResult(match),
    scoringConfig()
  );
  const leader = ranking[0];
  const purria = ranking.length ? ranking[ranking.length - 1] : null;

  const cards = [];

  // helper: atributos que hacen una tarjeta de partido pulsable para abrir el modal de pronósticos
  const matchCardAttrs = m =>
    `role="button" tabindex="0" data-match-id="${esc(m.match_id)}" aria-label="Ver pronósticos de ${esc(teamName(m.team1))} contra ${esc(teamName(m.team2))}"`;

  // último partido
  if (lastPlayed) {
    const r = matchResult(lastPlayed);
    cards.push(`
      <article class="card next-match-card last-match-card summary-match-card" ${matchCardAttrs(lastPlayed)}>
        <b>${teamFlag(lastPlayed.team1)} ${esc(teamName(lastPlayed.team1))}<span class="next-match-separator">-</span>${teamFlag(lastPlayed.team2)} ${esc(teamName(lastPlayed.team2))}</b>
        <strong class="last-match-score">${r.home} - ${r.away}</strong>
        <span>último partido</span>
        ${summaryGoalChips(lastPlayed)}
      </article>`);
  }

  // siguiente partido
  if (nextMatch) {
    cards.push(`
      <article class="card next-match-card summary-match-card" ${matchCardAttrs(nextMatch)}>
        <b>${teamFlag(nextMatch.team1)} ${esc(teamName(nextMatch.team1))}<span class="next-match-separator">-</span>${teamFlag(nextMatch.team2)} ${esc(teamName(nextMatch.team2))}</b>
        <span>siguiente partido</span>
        <span class="card-detail">${esc(matchScheduleText(nextMatch))}</span>
        ${mostChosen ? `<span class="card-detail">Pronóstico más elegido: ${esc(mostChosen.score)} · ${mostChosen.votes} voto${mostChosen.votes === 1 ? '' : 's'}</span>` : ''}
      </article>`);
  }

  // partidos con resultado
  cards.push(`<article class="card"><b>${playedMatches.length}/${groupMatches.length}</b><span>partidos con resultado</span></article>`);

  // líder y purria
  cards.push(`<article class="card summary-leader"><b>⭐ ${leader ? esc(leader.name) : '-'}</b><span>líder actual</span>${leader ? `<span class="card-detail">${leader.total} puntos</span>` : ''}</article>`);
  cards.push(`<article class="card summary-leader"><b>💩 ${purria ? esc(purria.name) : '-'}</b><span>el purria</span></article>`);

  // mejor racha
  cards.push(`
    <article class="card summary-leader">
      <b>${bestStreak ? '🔥 ' + esc(bestStreak.player.name) : '-'}</b>
      <span>${bestStreak ? 'mejor racha actual' : 'sin rachas activas'}</span>
      ${bestStreak ? `<span class="card-detail">${bestStreak.streak} acierto${bestStreak.streak === 1 ? '' : 's'} seguido${bestStreak.streak === 1 ? '' : 's'}</span>` : ''}
    </article>`);

  $summary.innerHTML = cards.join('');
}

// Modal con los pronósticos de todos los jugadores para un partido (puerto del
// `openMatchPredictions` de la legacy). Se dispara al pulsar las tarjetas de
// "último partido" / "siguiente partido". El <dialog> se crea bajo demanda.
function matchPredictionsDialog() {
  let dialog = document.getElementById('matchPredictionsDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'matchPredictionsDialog';
    dialog.className = 'predictions-dialog';
    dialog.innerHTML = '<div id="matchPredictionsContent"></div>';
    document.body.appendChild(dialog);
    // Cerrar al pulsar fuera del contenido (backdrop) o en el botón ×.
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target.closest('[data-close-predictions]')) dialog.close();
    });
  }
  return dialog;
}

function openMatchPredictions(matchId) {
  const match = state.matches.find(m => String(m.match_id) === String(matchId));
  if (!match) return;
  const result = matchResult(match);
  const scoring = scoringConfig();
  const dialog = matchPredictionsDialog();

  const rows = state.players
    .map(player => {
      const pred = predictionFor(player.player_id, match.match_id);
      const score = result ? scorePrediction({ score: pred?.score }, result, scoring) : null;
      return { name: player.name, score: pred?.score || '', sign: signFromScore(pred?.score) || '', points: score ? score.points : null };
    })
    .sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.name.localeCompare(b.name, 'es'));

  const stageLabel = match.stage === 'group' ? `Grupo ${esc(match.group_id || '?')}` : 'Cruce';
  const body = rows.map(r => `
    <tr>
      <td>${esc(r.name)}</td>
      <td class="prediction-score">${r.score ? esc(r.score) : '—'}</td>
      <td>${r.sign || '—'}</td>
      <td class="${r.points ? 'points' : 'muted'}">${r.points == null ? '—' : r.points}</td>
    </tr>`).join('');

  document.getElementById('matchPredictionsContent').innerHTML = `
    <div class="predictions-dialog-head">
      <div>
        <span class="pill">${stageLabel} · ${esc(match.match_id)}</span>
        <h2>${teamFlag(match.team1)} ${esc(teamName(match.team1))} - ${esc(teamName(match.team2))} ${teamFlag(match.team2)}</h2>
        <p class="match-schedule">${esc(matchScheduleText(match))}</p>
        <p>${result ? `Resultado: ${result.home}-${result.away}` : 'Partido pendiente'}</p>
        ${result ? renderGoalBreakdown(match) : ''}
      </div>
      <button type="button" class="dialog-close" data-close-predictions aria-label="Cerrar">×</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Participante</th><th>Pronóstico</th><th>Quiniela</th><th>Puntos</th></tr></thead>
        <tbody>${body || '<tr><td colspan="4" class="empty-state">Sin jugadores.</td></tr>'}</tbody>
      </table>
    </div>`;

  dialog.showModal();
}

// --- Comparador (puerto de la app legacy) -------------------------------------
// Elegir un partido y añadir jugadores uno a uno para comparar su pronóstico,
// quiniela, estado (Exacto/Quiniela/Fallado/Pendiente) y puntos en ese partido.

function compareMatchLabel(m) {
  const title = `${teamName(m.team1)} - ${teamName(m.team2)}`;
  if (m.stage === 'group') return `Grupo ${m.group_id || m.group_label || '?'} · ${title}`;
  const round = KNOCKOUT_STAGE_META[normalizeKnockoutStageKey(m.round_key)]?.label || 'Cruce';
  return `${round} · ${title}`;
}

function compareStatus(score) {
  if (!score || !score.points) return { label: 'Fallado', className: 'bad' };
  if (score.exact) return { label: 'Exacto', className: 'ok' };
  return { label: 'Quiniela', className: 'points' };
}

function comparePlayerCard(player, match, result, scoring, index) {
  const pred = predictionFor(player.player_id, match.match_id);
  const scoreStr = pred?.score || '';
  const score = result && scoreStr ? scorePrediction({ score: scoreStr }, result, scoring) : null;
  const status = result ? compareStatus(score) : { label: 'Pendiente', className: 'muted' };
  const points = score ? score.points : 0;
  return `
    <article class="compare-card">
      <div class="compare-card-head">
        <span class="pill">Participante</span>
        <div class="compare-card-actions">
          <button type="button" class="link-btn" data-compare-remove="${esc(player.player_id)}">Quitar</button>
        </div>
      </div>
      <h3>${esc(player.name)}</h3>
      <div class="compare-main-score">${scoreStr ? esc(scoreStr) : '—'}</div>
      <div class="compare-subline">Quiniela: <strong>${signFromScore(scoreStr) || '—'}</strong></div>
      <div class="compare-subline">Estado: <span class="${status.className}">${status.label}</span></div>
      <div class="compare-points">+${points} pts</div>
    </article>`;
}

function compareAddCard() {
  const selected = new Set(state.comparePlayers);
  const options = state.players
    .filter(p => !selected.has(p.player_id))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map(p => `<option value="${esc(p.player_id)}">${esc(p.name)}</option>`)
    .join('');
  return `
    <article class="compare-card compare-card-empty">
      <span class="pill">Comparación</span>
      <h3>Jugadores</h3>
      <p class="compare-subline">Selecciona qué jugador quieres añadir a este partido.</p>
      <div class="compare-picker">
        <select data-action="compare-add-player" ${options ? '' : 'disabled'}>
          <option value="">Jugador a comparar…</option>
          ${options}
        </select>
      </div>
      ${options ? '' : '<p class="hint">Ya están añadidos todos los jugadores disponibles.</p>'}
    </article>`;
}

function compareResultCard(match, result) {
  return `
    <article class="compare-card compare-card-result">
      <span class="pill">Resultado</span>
      <h3>${teamFlag(match.team1)} ${esc(teamName(match.team1))} - ${esc(teamName(match.team2))} ${teamFlag(match.team2)}</h3>
      <div class="compare-main-score ${result ? '' : 'pending'}">${result ? `${result.home} - ${result.away}` : 'Pendiente'}</div>
      <div class="compare-subline">${esc(matchScheduleText(match))}</div>
      ${result ? renderGoalBreakdown(match) : '<div class="compare-subline muted">Aún sin resultado disponible.</div>'}
    </article>`;
}

function renderCompare() {
  // Saneamiento de estado: partido y jugadores deben existir aún en la porra.
  if (state.compareMatchId && !state.matches.some(m => String(m.match_id) === String(state.compareMatchId))) {
    state.compareMatchId = '';
  }
  state.comparePlayers = state.comparePlayers.filter(pid => state.players.some(p => p.player_id === pid));

  const matchOptions = [...state.matches]
    .sort((a, b) => {
      const sa = a.stage === 'group' ? 0 : 1, sb = b.stage === 'group' ? 0 : 1;
      return sa - sb || (a.slot || 0) - (b.slot || 0) ||
        String(a.match_id).localeCompare(String(b.match_id), undefined, { numeric: true });
    })
    .map(m => `<option value="${esc(m.match_id)}" ${String(m.match_id) === String(state.compareMatchId) ? 'selected' : ''}>${esc(compareMatchLabel(m))}</option>`)
    .join('');

  const match = state.matches.find(m => String(m.match_id) === String(state.compareMatchId));
  const result = match ? matchResult(match) : null;
  const scoring = scoringConfig();

  const summary = match
    ? `
      <article class="card"><b>${esc(match.match_id)}</b><span>${esc(teamName(match.team1))} - ${esc(teamName(match.team2))}</span></article>
      <article class="card"><b>${result ? `${result.home}-${result.away}` : 'Pendiente'}</b><span>resultado real</span></article>
      <article class="card"><b>${state.comparePlayers.length}</b><span>jugadores añadidos</span></article>`
    : `
      <article class="card"><b>0</b><span>partido seleccionado</span></article>
      <article class="card"><b>0</b><span>jugadores añadidos</span></article>`;

  const cards = !match
    ? '<p class="empty-state">Selecciona un partido para añadirlo al comparador y luego ve incorporando jugadores uno a uno.</p>'
    : [
        compareResultCard(match, result),
        compareAddCard(),
        ...state.comparePlayers
          .map(pid => state.players.find(p => p.player_id === pid))
          .filter(Boolean)
          .map((player, index) => comparePlayerCard(player, match, result, scoring, index))
      ].join('');

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Comparador de pronósticos</h2>
          <span class="hint">Compara el pronóstico de varios jugadores en un mismo partido.</span>
        </div>
        <select data-action="compare-match">
          <option value="">Selecciona un partido…</option>
          ${matchOptions}
        </select>
      </div>
      <div class="compare-summary">${summary}</div>
      <div class="compare-grid">${cards}</div>
    </div>`;
}

function renderRanking() {
  const MEDALS = ['🥇', '🥈', '🥉'];
  const features = state.porra.features || {};
  const showKnockout = features.knockout !== false && !state.porra?.scoring?.nationsLeague?.templateId; // Nations League no usa un cuadro único
  const ranking = computeRanking();
  const total = ranking.length;
  // Variación de posición respecto al estado ANTES del último partido jugado:
  // el snapshot `length-2` es la clasificación previa al resultado más reciente
  // (el último snapshot equivale a la clasificación actual). Igual que la legacy.
  const snapshots = buildHistoricalSnapshots();
  const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const q = (state.rankingQuery || '').toLowerCase();
  const rows = sortRankingRows(
    ranking.filter(r => r.name.toLowerCase().includes(q)),
    state.rankingSort
  );

  // columnas opcionales según features
  const head = `
    <tr>
      ${sortableHeader('position', '#', 'table-center')}
      <th class="table-center">Mov.</th>
      ${sortableHeader('name', 'Participante')}
      ${sortableHeader('total', 'Total', 'table-center')}
      ${sortableHeader('groupPoints', '1ª fase', 'table-center')}
      ${sortableHeader('exacts', 'Exactos', 'table-center')}
      ${sortableHeader('hits', 'Aciertos', 'table-center')}
      ${showKnockout ? sortableHeader('knockoutPoints', 'Cruces', 'table-center') : ''}
      ${showKnockout ? sortableHeader('championPick', 'Campeón', 'table-center') : ''}
    </tr>`;
  const colspan = 7 + (showKnockout ? 2 : 0);

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Clasificación porra principal</h2>
        <input type="search" data-action="ranking-search" placeholder="Buscar participante…" value="${esc(state.rankingQuery || '')}" />
      </div>
      <div class="table-wrap">
        <table>
          <thead>${head}</thead>
          <tbody>${rows.map(r => {
            const mov = historyPositionChange(r, previousSnapshot);
            const posCell = MEDALS[r.position - 1] || (r.position === total ? '💩' : r.position);
            return `
              <tr class="${r.position <= 3 ? 'rank-' + r.position : ''}">
                <td class="ranking-position">${posCell}</td>
                <td class="table-center ${mov.className}" title="${mov.label}">${mov.symbol}${mov.delta ? ' ' + mov.delta : ''}</td>
                <td class="standing-team">${esc(r.name)}${r.id === state.myPlayerId ? ' <span class="pill">tú</span>' : ''}</td>
                <td class="table-center points">${r.total}</td>
                <td class="table-center">${r.groupPoints}</td>
                <td class="table-center">${r.exacts}</td>
                <td class="table-center">${r.hits}</td>
                ${showKnockout ? `<td class="table-center">${r.knockoutPoints}</td>` : ''}
                ${showKnockout ? `<td class="table-center" title="${r.championPick ? esc(teamName(r.championPick)) : 'Sin campeón'}">${r.championPick ? teamFlag(r.championPick) || '🏳️' : '-'}</td>` : ''}
              </tr>`;
          }).join('') || `<tr><td colspan="${colspan}" class="empty-state">Sin participantes todavía.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

// Devuelve la jornada del partido (en admin se guarda en slot). Fallback: 1.
function matchdayOf(m) { return m.slot || 1; }

function matchScheduleText(m) {
  if (!m.kickoff) return 'Fecha por confirmar';
  return new Date(m.kickoff).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

// Goleadores: scorers jsonb. Soporta [{name,minute,team,penalty,owngoal}] o
// {team1:[...],team2:[...]}. Devuelve {team1:[], team2:[]} con la forma legacy.
function goalBreakdown(m) {
  const raw = m.scorers;
  if (!raw) return null;
  const norm = g => ({
    name: g.name || g.player || '', minute: g.minute || g.min || '',
    penalty: Boolean(g.penalty), ownGoal: Boolean(g.owngoal || g.ownGoal)
  });
  let team1 = [], team2 = [];
  if (Array.isArray(raw)) {
    for (const g of raw) {
      const t = (g.team === m.team2 || g.side === 'away' || g.side === 2) ? 2 : 1;
      (t === 2 ? team2 : team1).push(norm(g));
    }
  } else if (typeof raw === 'object') {
    team1 = (raw.team1 || []).map(norm);
    team2 = (raw.team2 || []).map(norm);
  }
  if (!team1.length && !team2.length) return null;
  return { team1, team2 };
}

function formatGoalEvent(g) {
  if (!g.name) return '';
  const marker = g.ownGoal ? '↺ P.P.' : (g.penalty ? '🎯' : '⚽');
  const minute = g.minute ? `${esc(String(g.minute))}'` : '';
  return `<span class="goal-event"><span class="goal-marker">${marker}</span><span>${esc(g.name)}${minute ? ' ' + minute : ''}</span></span>`;
}

function renderGoalBreakdown(m) {
  const goals = goalBreakdown(m);
  if (!goals) return '<div class="match-goals"><span class="goal-empty">Sin goleadores registrados.</span></div>';
  const lines = [];
  if (goals.team1.length) lines.push(`<div class="goal-line"><strong>${teamFlag(m.team1)} ${esc(teamName(m.team1))}</strong><div class="goal-events">${goals.team1.map(formatGoalEvent).join('')}</div></div>`);
  if (goals.team2.length) lines.push(`<div class="goal-line"><strong>${teamFlag(m.team2)} ${esc(teamName(m.team2))}</strong><div class="goal-events">${goals.team2.map(formatGoalEvent).join('')}</div></div>`);
  return `<div class="match-goals">${lines.join('')}</div>`;
}

function renderMatchCard(m) {
  const r = matchResult(m);
  const expanded = Boolean(state.matchGoalsExpanded[m.match_id]);
  return `<article class="match-card">
    <span class="pill">Grupo ${esc(m.group_id || '?')} · ${esc(m.match_id)}</span>
    <h3 class="teams"><span>${teamFlag(m.team1)} ${esc(teamName(m.team1))}</span><span class="versus">-</span><span>${esc(teamName(m.team2))} ${teamFlag(m.team2)}</span></h3>
    <div class="match-schedule">${esc(matchScheduleText(m))}</div>
    <div class="match-score ${r ? '' : 'pending'}">${r ? `${r.home} - ${r.away}` : 'Pendiente'}</div>
    ${r ? `
      <div class="match-card-actions">
        <button type="button" class="match-link-button" data-toggle-goals="${esc(m.match_id)}" aria-expanded="${expanded}">
          ${expanded ? 'Ocultar goleadores' : 'Ver goleadores'}
        </button>
      </div>
      ${expanded ? renderGoalBreakdown(m) : ''}
    ` : ''}
    <div class="source">${r ? 'Resultado introducido por el organizador' : 'Sin resultado todavía'}</div>
  </article>`;
}

function renderMatches() {
  const groupMatches = state.matches.filter(m => m.stage === 'group');
  const matchdays = [...new Set(groupMatches.map(matchdayOf))].sort((a, b) => a - b);

  $app.innerHTML = `<div class="matchdays">${
    matchdays.map(day => {
      const dayMatches = groupMatches.filter(m => matchdayOf(m) === day);
      const groups = [...new Set(dayMatches.map(m => m.group_id || '—'))].sort();
      return `
        <section class="matchday">
          <div class="matchday-head">
            <h3>Jornada ${day}</h3>
            <span>${dayMatches.length} partido(s)</span>
          </div>
          <div class="matchday-groups">
            ${groups.map(g => {
              const gm = dayMatches.filter(m => (m.group_id || '—') === g);
              return `
                <section class="match-group">
                  <div class="match-group-head">
                    <h4>Grupo ${esc(g)}</h4>
                    <span>${gm.length} partido(s)</span>
                  </div>
                  <div class="match-grid">${gm.map(renderMatchCard).join('')}</div>
                </section>`;
            }).join('')}
          </div>
        </section>`;
    }).join('') || `<p class="empty-state">Sin partidos todavía.</p>`
  }</div>`;
}

// --- Clasificación de grupos (puntos reales del torneo) --------------------
function computeGroupStandings(groupId) {
  const matches = state.matches.filter(m => m.stage === 'group' && m.group_id === groupId);
  const teamIds = [...new Set(matches.flatMap(m => [m.team1, m.team2]).filter(Boolean))];
  const rows = teamIds.map((team, i) => ({
    team, idx: i, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0
  }));
  const byTeam = new Map(rows.map(r => [r.team, r]));
  for (const m of matches) {
    const r = matchResult(m);
    if (!r) continue;
    const home = byTeam.get(m.team1), away = byTeam.get(m.team2);
    if (!home || !away) continue;
    home.pj++; away.pj++;
    home.gf += r.home; home.gc += r.away;
    away.gf += r.away; away.gc += r.home;
    if (r.home > r.away) { home.pts += 3; home.g++; away.p++; }
    else if (r.home < r.away) { away.pts += 3; away.g++; home.p++; }
    else { home.pts++; away.pts++; home.e++; away.e++; }
  }
  return rows.sort((a, b) =>
    b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || a.idx - b.idx);
}

function renderGroupStandings() {
  const groups = state.groups.length
    ? state.groups
    : [...new Set(state.matches.filter(m => m.stage === 'group').map(m => m.group_id).filter(Boolean))]
        .map(group_id => ({ group_id, name: group_id }));
  const inner = groups.map(grp => {
    const rows = computeGroupStandings(grp.name ?? grp.group_id);
    return `
      <section class="group-standing">
        <h3>Grupo ${esc(grp.name || grp.group_id)}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead>
            <tbody>
              ${rows.map((r, i) => `<tr class="${i < 2 ? 'rank-' + (i + 1) : ''}">
                <td class="group-position">${i + 1}</td>
                <td class="standing-team">${teamFlag(r.team)} ${esc(teamName(r.team))}</td>
                <td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td>
                <td>${r.gf}</td><td>${r.gc}</td><td>${r.gf - r.gc}</td>
                <td class="points">${r.pts}</td>
              </tr>`).join('') || `<tr><td colspan="10" class="empty-state">Sin equipos.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>`;
  }).join('');
  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>Clasificación de grupos</h2></div>
      ${inner ? `<div class="group-standings-grid">${inner}</div>` : `<p class="empty-state">No hay grupos definidos.</p>`}
    </div>`;
}

// --- Mejores terceros -------------------------------------------------------

function calculateBestThirds() {
  const groups = state.groups.length
    ? state.groups
    : [...new Set(state.matches.filter(m => m.stage === 'group').map(m => m.group_id).filter(Boolean))]
        .map(group_id => ({ group_id, name: group_id }));

  return groups
    .map((grp, groupIndex) => {
      const rows = computeGroupStandings(grp.name ?? grp.group_id);
      if (!rows[2]) return null;
      return { ...rows[2], group: grp.name || grp.group_id, groupIndex };
    })
    .filter(Boolean)
    .sort((a, b) =>
      b.pts - a.pts ||
      ((b.gf - b.gc) - (a.gf - a.gc)) ||
      (b.gf - a.gf) ||
      (a.groupIndex - b.groupIndex)
    );
}

function renderBestThirds() {
  const template = knockoutTemplateForPorra();
  const qualifierCount = template?.thirdPlaceQualifiers || 0;
  const rows = calculateBestThirds();

  const hint = qualifierCount > 0
    ? `Los ${qualifierCount} mejores pasan a la siguiente ronda (marcados con acento). Se ordenan por puntos, diferencia de goles y goles a favor.`
    : `Se ordenan por puntos, diferencia de goles y goles a favor.`;

  const tableBody = rows.length
    ? rows.map((r, i) => {
        const qualifies = qualifierCount > 0 && i < qualifierCount;
        const dg = r.gf - r.gc;
        const dgStr = dg > 0 ? `+${dg}` : String(dg);
        return `<tr class="${qualifies ? 'qualified-third' : ''}">
          <td>${i + 1}</td>
          <td class="standing-team">${teamFlag(r.team)} ${esc(teamName(r.team))}</td>
          <td>Grupo ${esc(r.group)}</td>
          <td>${r.pj}</td>
          <td>${r.gf}</td>
          <td>${r.gc}</td>
          <td>${dgStr}</td>
          <td class="points">${r.pts}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="8" class="empty-state">Sin resultados de fase de grupos todavía.</td></tr>`;

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Mejores terceros</h2>
          <p class="hint">${esc(hint)}</p>
        </div>
      </div>
      <div class="table-wrap best-thirds-table">
        <table>
          <thead><tr><th>Pos.</th><th>Selección</th><th>Grupo</th><th>PJ</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </div>`;
}

// --- Máximos goleadores ------------------------------------------------------
// Fuente principal: el caché de Wikipedia (event_results_cache.payload.topScorers),
// ya agregado en BD (jugador + selección + goles, sin autogoles). Si el caché no
// está disponible, cae al cálculo manual sobre `porra_matches.scorers` (legacy).
// Cuenta solo goles válidos: ignora los goles en propia puerta, como la legacy.
function calculateTopScorers() {
  const cached = state.eventCache?.topScorers;
  if (Array.isArray(cached) && cached.length) {
    return cached
      .map(s => {
        const t = eventTeamMatch(s.team);
        // Selección mapeada al nombre de la porra (si existe); si no, el del caché.
        return { name: s.name, team: t ? t.name : s.team, goals: s.goals, flag: t?.flag || '' };
      })
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'es'))
      .slice(0, 15);
  }
  return calculateTopScorersFromMatches();
}

// Fallback manual: agrega los goleadores de `porra_matches.scorers`.
function calculateTopScorersFromMatches() {
  const scorers = new Map();
  for (const m of state.matches) {
    const goals = goalBreakdown(m);
    if (!goals) continue;
    for (const [teamToken, events] of [[m.team1, goals.team1], [m.team2, goals.team2]]) {
      const team = teamName(teamToken);
      for (const g of events) {
        if (!g.name || g.ownGoal) continue;
        const key = `${knockoutTeamKey(g.name)}__${knockoutTeamKey(team)}`;
        const scorer = scorers.get(key) || { name: g.name, team, goals: 0, flag: teamFlag(teamToken) };
        scorer.goals += 1;
        scorers.set(key, scorer);
      }
    }
  }
  return [...scorers.values()]
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'es'))
    .slice(0, 15);
}

function renderTopScorers() {
  const scorers = calculateTopScorers();
  const body = scorers.length
    ? scorers.map((s, i) => `<tr>
        <td class="${i === 0 ? 'rank-1' : ''}">${i + 1}</td>
        <td class="scorer-name">${esc(s.name)}</td>
        <td class="standing-team">${s.flag ? s.flag + ' ' : ''}${esc(s.team)}</td>
        <td class="points">${s.goals}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty-state">Todavía no hay goleadores registrados.</td></tr>`;

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Máximos goleadores</h2>
          <p class="hint">${state.eventCache?.topScorers?.length
            ? 'Datos actualizados automáticamente. Los goles en propia puerta no cuentan.'
            : 'Goleadores registrados por el organizador en los partidos. Los goles en propia puerta no cuentan.'}</p>
        </div>
      </div>
      <div class="table-wrap top-scorers-table">
        <table>
          <thead><tr><th>Pos.</th><th>Jugador</th><th>Selección</th><th>Goles</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

// --- Histórico ---------------------------------------------------------------

const HISTORY_PALETTE = ['#53e0b4','#5da9ff','#ffd76a','#ff8f6b','#c08cff','#7ce2ff','#ff6b6b','#8bd450','#f6c177','#7aa2f7','#f7768e','#9ece6a','#bb9af7','#e0af68','#73daca','#c0caf5'];
function historyLineColor(index) { return HISTORY_PALETTE[index % HISTORY_PALETTE.length]; }

// Una clasificación completa calculada sobre un subconjunto de resultados.
function calcRankingFromResults(resultMap) {
  const scoring = scoringConfig();
  const groupMatches = state.matches.filter(m => m.stage === 'group');
  const koScoring = knockoutScoringConfig();

  return state.players.map(player => {
    let groupPoints = 0, exacts = 0, signs = 0, played = 0;
    for (const m of groupMatches) {
      const result = resultMap.get(m.match_id);
      if (!result) continue;
      played++;
      const pred = predictionFor(player.player_id, m.match_id);
      const r = scorePrediction({ score: pred?.score }, result, scoring);
      groupPoints += r.points;
      if (r.exact) exacts++;
      else if (r.sign) signs++;
    }
    // Puntos de cruces con los resultados disponibles en este snapshot
    let knockoutPoints = 0;
    const bracket = buildPlayerKnockoutBracket(player.player_id);
    const reality = buildKnockoutRealityFromMap(resultMap);
    for (const stage of knockoutStages()) {
      const stageReality = reality[stage.key];
      if (!stageReality) continue;
      const picks = stage.key === 'champion'
        ? [knockoutChampionPick(player.player_id)].filter(Boolean)
        : (bracket[stage.key] || []).filter(Boolean);
      const hits = picks.filter(t => stageReality.teams.has(knockoutTeamKey(t))).length;
      knockoutPoints += hits * stage.points;
    }
    return { id: player.player_id, name: player.name, groupPoints, knockoutPoints,
             total: groupPoints + knockoutPoints, exacts, signs, played };
  }).sort((a, b) => b.total - a.total || b.exacts - a.exacts || b.signs - a.signs || a.name.localeCompare(b.name, 'es'))
    .map((p, i) => ({ ...p, position: i + 1 }));
}

// ¿Están todos los partidos del grupo en el resultMap del snapshot? (variante de
// groupIsComplete para el histórico, que solo conoce los resultados hasta ese punto)
function groupIsCompleteInMap(groupId, resultMap) {
  const matches = state.matches.filter(match => match.stage === 'group' && (match.group_id ?? match.group_label) === groupId);
  if (!matches.length) return false;
  return matches.every(match => resultMap.has(match.match_id));
}

// Resuelve un token a equipo real respetando solo los resultados del snapshot.
function knockoutRealityTeamNameFromMap(token, resultMap) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  if (teamByToken(raw)) return teamName(raw);
  const seed = parseGroupSeed(raw);
  if (seed) {
    if (!groupIsCompleteInMap(seed.letter, resultMap)) return '';
    return teamName(raw);
  }
  const winnerSeed = raw.match(/^W:(.+)$/i);
  if (winnerSeed) {
    const matchId = winnerSeed[1].toUpperCase();
    const m = state.matches.find(item => String(item.match_id || '').toUpperCase() === matchId);
    if (!m) return '';
    const r = resultMap.get(m.match_id);
    if (!r) return '';
    let wt = '';
    if (r.home > r.away) wt = m.team1_id ?? m.team1;
    else if (r.away > r.home) wt = m.team2_id ?? m.team2;
    else if (m.pen_winner === 'team1') wt = m.team1_id ?? m.team1;
    else if (m.pen_winner === 'team2') wt = m.team2_id ?? m.team2;
    if (!wt) return '';
    return knockoutRealityTeamNameFromMap(wt, resultMap);
  }
  return '';
}

// buildKnockoutReality variant that uses a resultMap instead of full state.matches results
function buildKnockoutRealityFromMap(resultMap) {
  const roundStages = knockoutRoundStages();
  const reality = {};
  for (const stage of roundStages) {
    const matches = knockoutMatches().filter(m => normalizeKnockoutStageKey(m.round_key) === stage.key);
    const teams = new Set();
    for (const m of matches) {
      const raw1 = m.team1_id ?? m.team1;
      const raw2 = m.team2_id ?? m.team2;
      const t1 = knockoutRealityTeamNameFromMap(raw1, resultMap);
      const t2 = knockoutRealityTeamNameFromMap(raw2, resultMap);
      if (t1) teams.add(knockoutTeamKey(t1));
      if (t2) teams.add(knockoutTeamKey(t2));
    }
    reality[stage.key] = { key: stage.key, label: stage.label, points: stage.points,
      expected: stage.teams, resolved: teams.size,
      complete: stage.teams > 0 && teams.size >= stage.teams, teams };
  }
  const finalMatch = knockoutMatches().find(m => normalizeKnockoutStageKey(m.round_key) === 'final');
  let champion = '';
  if (finalMatch) {
    // Campeón = ganador del token del partido final, resuelto solo con el snapshot.
    champion = knockoutRealityTeamNameFromMap(`W:${finalMatch.match_id}`, resultMap);
  }
  reality.champion = { key: 'champion', label: 'Campeón', points: knockoutScoringConfig().champion,
    expected: 1, resolved: champion ? 1 : 0, complete: Boolean(champion),
    teams: champion ? new Set([knockoutTeamKey(champion)]) : new Set() };
  return reality;
}

function buildHistoricalSnapshots() {
  // Todos los partidos con resultado, ordenados por posición (orden del torneo)
  const played = state.matches
    .filter(m => matchResult(m))
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));

  const resultMap = new Map();
  return played.map((m, index) => {
    resultMap.set(m.match_id, matchResult(m));
    const ranking = calcRankingFromResults(new Map(resultMap));
    return {
      id: m.match_id,
      order: index + 1,
      match: m,
      result: matchResult(m),
      ranking,
      leader: ranking[0] || null,
      playedMatches: index + 1
    };
  });
}

function historyCheckpointLabel(snapshot) {
  const m = snapshot.match;
  const t1 = teamName(m.team1_id ?? m.team1);
  const t2 = teamName(m.team2_id ?? m.team2);
  return `${snapshot.order}. ${t1} ${snapshot.result.home}-${snapshot.result.away} ${t2}`;
}

function renderHistoryChart(snapshots, snapshot) {
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const width = Math.max(720, snapshots.length * 56);
  const height = 320;
  const pad = { top: 18, right: 22, bottom: 34, left: mobile ? 88 : 126 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const playerCount = Math.max(1, state.players.length);
  const maxIdx = Math.max(1, snapshots.length - 1);
  const maxPos = Math.max(1, playerCount - 1);
  const selIdx = Math.max(0, snapshots.findIndex(s => s.id === snapshot.id));

  const xFor = i => pad.left + (cw * (maxIdx ? i / maxIdx : 0));
  const yFor = p => pad.top + (ch * (maxPos ? (p - 1) / maxPos : 0));

  const visibleIds = new Set((mobile ? snapshot.ranking.slice(0, 8) : snapshot.ranking).map(r => r.id));
  const series = state.players
    .filter(p => visibleIds.has(p.player_id))
    .map((p, index) => {
      const color = historyLineColor(index);
      const points = snapshots.map((s, si) => {
        const row = s.ranking.find(r => r.id === p.player_id);
        return { si, position: row?.position || playerCount, total: row?.total || 0 };
      });
      const selPoint = points[selIdx] || points[points.length - 1];
      return { player: p, color, points, selPoint };
    });

  const gridMarks = [...new Set([1, Math.ceil(playerCount / 2), playerCount])].sort((a, b) => a - b);
  const gridMarkup = gridMarks.map(m => `
    <g>
      <line x1="${pad.left}" y1="${yFor(m).toFixed(1)}" x2="${width - pad.right}" y2="${yFor(m).toFixed(1)}" stroke="rgba(153,166,194,0.18)" stroke-width="1"/>
      <text x="${pad.left - 10}" y="${(yFor(m) + 4).toFixed(1)}" fill="var(--muted)" font-size="11" text-anchor="end">${m}</text>
    </g>`).join('');

  const linesMarkup = series.map(item => {
    const path = item.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xFor(pt.si).toFixed(1)} ${yFor(pt.position).toFixed(1)}`).join(' ');
    const sx = xFor(item.selPoint.si).toFixed(1);
    const sy = yFor(item.selPoint.position).toFixed(1);
    const firstY = yFor(item.points[0].position).toFixed(1);
    const isLeader = item.player.player_id === snapshot.leader?.id;
    return `
      <path d="${path}" fill="none" stroke="${item.color}" stroke-width="${isLeader ? 3.5 : 2}" stroke-linecap="round" stroke-linejoin="round" opacity="${isLeader ? 1 : 0.7}"/>
      <text x="${(pad.left - 8).toFixed(1)}" y="${(Number(firstY) + 2).toFixed(1)}" fill="${item.color}" font-size="7" font-weight="700" text-anchor="end">${esc(item.player.name)}</text>
      <circle cx="${sx}" cy="${sy}" r="${isLeader ? 4.5 : 3.2}" fill="${item.color}"/>`;
  }).join('');

  const xLabels = snapshots.map((s, i) =>
    `<text x="${xFor(i).toFixed(1)}" y="${height - 10}" fill="var(--muted)" font-size="10" text-anchor="middle">${s.order}</text>`
  ).join('');

  const markerX = xFor(selIdx).toFixed(1);

  const legend = [...series]
    .sort((a, b) => a.selPoint.position - b.selPoint.position || b.selPoint.total - a.selPoint.total)
    .map(item => `
      <div class="history-legend-item">
        <span class="history-legend-swatch" style="background:${item.color}"></span>
        <span class="history-legend-name">${esc(item.player.name)}</span>
        <span class="history-legend-meta">#${item.selPoint.position} · ${item.selPoint.total} pts</span>
      </div>`).join('');

  return `
    <div class="history-chart-head">
      <div>
        <h3>Gráfica de posiciones</h3>
        <p class="hint">${mobile ? 'La gráfica muestra los 8 mejores del punto seleccionado en móvil.' : 'La gráfica muestra a todos los participantes.'} La línea vertical marca el partido activo.</p>
      </div>
      <span class="pill">${mobile ? 'Top 8' : `${series.length} jugadores`} · ${snapshots.length} hitos</span>
    </div>
    <div class="history-chart-wrap">
      <svg class="history-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfica histórica de posiciones">
        <rect x="${pad.left}" y="${pad.top}" width="${cw}" height="${ch}" rx="14" fill="rgba(16,24,43,0.6)" stroke="rgba(153,166,194,0.14)"/>
        ${gridMarkup}
        <line x1="${markerX}" y1="${pad.top}" x2="${markerX}" y2="${height - pad.bottom}" stroke="rgba(255,215,106,0.7)" stroke-width="2" stroke-dasharray="6 6"/>
        ${linesMarkup}
        ${xLabels}
      </svg>
    </div>
    <div class="history-chart-legend">${legend}</div>`;
}

function renderHistory() {
  const snapshots = buildHistoricalSnapshots();

  if (!snapshots.length) {
    $app.innerHTML = `
      <div class="panel">
        <div class="panel-head"><div><h2>Histórico</h2><p class="hint">Evolución de la clasificación tras cada partido con resultado.</p></div></div>
        <p class="empty-state">Aún no hay suficientes resultados para construir el histórico.</p>
      </div>`;
    return;
  }

  if (!state.historyCheckpointId || !snapshots.some(s => s.id === state.historyCheckpointId)) {
    state.historyCheckpointId = snapshots[snapshots.length - 1].id;
  }

  const snapshot = snapshots.find(s => s.id === state.historyCheckpointId) || snapshots[snapshots.length - 1];
  const previousSnapshot = snapshots.find(s => s.order === snapshot.order - 1) || null;
  const leaderChange = previousSnapshot?.leader && snapshot.leader && previousSnapshot.leader.id !== snapshot.leader.id;
  const MEDALS = ['🥇', '🥈', '🥉'];
  const totalMatches = state.matches.filter(m => m.stage === 'group').length;
  const hasKnockout = knockoutMatches().length > 0;

  const selectOpts = snapshots.map(s =>
    `<option value="${esc(s.id)}" ${s.id === snapshot.id ? 'selected' : ''}>${esc(historyCheckpointLabel(s))}</option>`
  ).join('');

  const summaryCards = `
    <article class="card"><b>${snapshot.playedMatches}/${totalMatches}</b><span>partidos computados</span></article>
    <article class="card"><b>${snapshot.leader ? `⭐ ${esc(snapshot.leader.name)}` : '—'}</b><span>líder tras este partido</span></article>
    <article class="card"><b>${snapshot.leader?.total || 0}</b><span>puntos del líder</span></article>
    <article class="card"><b>${leaderChange ? 'Sí' : 'No'}</b><span>cambio de líder</span></article>`;

  const tableRows = snapshot.ranking.map(player => {
    const mov = historyPositionChange(player, previousSnapshot);
    return `<tr class="${player.position <= 3 ? 'rank-' + player.position : ''}">
      <td class="ranking-position">${MEDALS[player.position - 1] || player.position}</td>
      <td class="${mov.className}" title="${esc(mov.label)}">${mov.symbol}${mov.delta ? ` ${mov.delta}` : ''}</td>
      <td>${esc(player.name)}${player.id === state.myPlayerId ? ' <span class="pill">tú</span>' : ''}</td>
      <td class="points">${player.total}</td>
      <td>${player.groupPoints}</td>
      <td>${player.exacts}</td>
      <td>${player.signs + player.exacts}</td>
      ${hasKnockout ? `<td>${player.knockoutPoints}</td>` : ''}
      <td>${player.played}</td>
    </tr>`;
  }).join('');

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div><h2>Histórico</h2><p class="hint">Evolución de la clasificación tras cada partido con resultado.</p></div>
        <div class="filters">
          <select data-action="history-checkpoint" aria-label="Punto del histórico">${selectOpts}</select>
        </div>
      </div>
      <div class="cards">${summaryCards}</div>
      <div class="history-chart-card">${renderHistoryChart(snapshots, snapshot)}</div>
      <div class="history-controls">
        <label class="history-slider-label" for="history-slider">
          <span>Desliza para avanzar partido a partido</span>
          <input id="history-slider" class="history-slider" type="range" data-action="history-slider"
            min="1" max="${snapshots.length}" value="${snapshot.order}" aria-label="Avanzar histórico por partidos"/>
        </label>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Mov.</th><th>Participante</th>
            <th class="table-center">Total</th><th class="table-center">1ª fase</th>
            <th class="table-center">Exactos</th><th class="table-center">Aciertos</th>
            ${hasKnockout ? '<th class="table-center">Cruces</th>' : ''}
            <th class="table-center">Jugados</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>`;
}

// --- Equipos (layout de dos columnas, reusa src/lib/team-stats.js) ---------
const TEAM_METRIC_BAD = new Set(['goalsAgainst', 'losses', 'failedToScore']);

function renderTeamChart(metric, value, maxValue) {
  const v = Number(value) || 0;
  const percent = maxValue > 0 ? Math.min(100, (Math.abs(v) / Math.abs(maxValue)) * 100) : 0;
  const display = Number.isInteger(v) ? v : v.toFixed(2);
  return `
    <article class="team-chart-card">
      <header><h4>${esc(metric.label)}</h4><span class="metric-value">${display}</span></header>
      <div class="chart-track"><div class="chart-fill ${TEAM_METRIC_BAD.has(metric.key) ? 'bad' : ''}" style="width:${percent}%"></div></div>
      <div class="team-detail-subtitle"><span>${percent.toFixed(0)}% del máximo del torneo</span></div>
    </article>`;
}

function renderTeams() {
  const getResult = m => matchResult(m);
  const groupMatches = state.matches.filter(m => m.stage === 'group');
  const teams = [...state.teams].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (!teams.length) {
    $app.innerHTML = `<div class="panel"><div class="panel-head"><h2>Equipos</h2></div><p class="empty-state">No hay equipos todavía.</p></div>`;
    return;
  }
  const query = (state.teamsQuery || '').toLowerCase();
  const filtered = teams.filter(t => t.name.toLowerCase().includes(query));

  let selected = teams.find(t => t.team_id === state.selectedTeamId) || teams[0];
  state.selectedTeamId = selected.team_id;

  const stats = calculateTeamStats(selected.team_id, groupMatches, getResult);
  const profiles = teams.map(t => calculateTeamStats(t.team_id, groupMatches, getResult));
  const maxByMetric = Object.fromEntries(TEAM_DETAIL_METRICS.map(metric =>
    [metric.key, Math.max(...profiles.map(p => Math.abs(Number(p[metric.key]) || 0)), 0)]));

  const summaryCards = [
    ['Partidos', `${stats.played}/${stats.scheduled}`],
    ['Victorias', stats.wins],
    ['Empates', stats.draws],
    ['Derrotas', stats.losses]
  ];

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div><h2>Equipos</h2><p class="hint">Selecciona una selección para ver su detalle con estadísticas.</p></div>
        <input type="search" data-action="teams-search" placeholder="Buscar equipo…" value="${esc(state.teamsQuery || '')}" />
      </div>
      <div class="teams-layout">
        <div class="teams-list-panel">
          <div class="teams-list-head"><h3>Lista de equipos</h3><span class="hint">${filtered.length}/${teams.length}</span></div>
          <div class="teams-list">
            ${filtered.map(t => `
              <button class="team-list-item ${t.team_id === selected.team_id ? 'active' : ''}" type="button" data-team-select="${esc(t.team_id)}">
                <span>${t.flag || '🏳️'} ${esc(t.name)}</span>
              </button>`).join('') || `<p class="team-empty">Sin coincidencias.</p>`}
          </div>
        </div>
        <div class="teams-detail">
          <div class="team-detail-head">
            <div>
              <h3>${selected.flag || '🏳️'} ${esc(selected.name)}</h3>
              <p>Detalle del equipo con estadísticas de la porra y resumen de su rendimiento actual.</p>
            </div>
            <div class="team-detail-subtitle">
              <span>${stats.points} puntos</span><span>${stats.goalsFor} GF</span>
              <span>${stats.goalsAgainst} GC</span>
              <span>${stats.goalDifference >= 0 ? '+' : ''}${stats.goalDifference} DG</span>
            </div>
          </div>
          <div class="team-summary-grid">
            ${summaryCards.map(([label, value]) => `<article class="team-summary-card"><span>${label}</span><b>${value}</b></article>`).join('')}
          </div>
          <div class="team-chart-grid">
            ${TEAM_DETAIL_METRICS.map(metric => renderTeamChart(metric, stats[metric.key], maxByMetric[metric.key])).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

// --- Detalle de jugador ----------------------------------------------------
function renderPlayerDetail() {
  const selected = state.playerDetailId
    || (state.myPlayerId || state.players[0]?.player_id) || null;
  state.playerDetailId = selected;
  const scoring = scoringConfig();
  const groupMatches = state.matches.filter(m => m.stage === 'group');

  const rows = groupMatches.map(m => {
    const pred = predictionFor(selected, m.match_id);
    const result = matchResult(m);
    const s = result ? scorePrediction({ score: pred?.score }, result, scoring) : null;
    return { m, pred, result, s };
  });

  const total = rows.reduce((acc, r) => acc + (r.s ? r.s.points : 0), 0);

  // Agrupar por jornada (slot)
  const bySlot = new Map();
  for (const row of rows) {
    const slot = matchdayOf(row.m);
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot).push(row);
  }
  const sortedSlots = [...bySlot.keys()].sort((a, b) => Number(a) - Number(b));

  const tableBody = sortedSlots.length
    ? sortedSlots.map(slot => {
        const slotRows = bySlot.get(slot);
        const slotPts = slotRows.reduce((acc, r) => acc + (r.s?.points || 0), 0);
        return `
          <tr class="matchday-header">
            <td colspan="5">Jornada ${esc(String(slot))}<span class="matchday-pts">${slotPts} pts</span></td>
          </tr>
          ${slotRows.map(({ m, pred, result, s }) => `<tr>
            <td class="muted" style="font-size:.8rem">${esc(m.group_id || '')}</td>
            <td>${teamFlag(m.team1)} ${esc(teamName(m.team1))} – ${esc(teamName(m.team2))} ${teamFlag(m.team2)}</td>
            <td>${pred?.score ? esc(pred.score) : '<span class="muted">—</span>'}</td>
            <td>${result ? `${result.home}–${result.away}` : '<span class="muted">pdte</span>'}</td>
            <td class="table-center ${s && s.points ? 'points' : 'muted'}">${s ? (s.exact ? `${s.points} ✔` : (s.sign ? `${s.points} ~` : '0')) : '—'}</td>
          </tr>`).join('')}`;
      }).join('')
    : `<tr><td colspan="5" class="empty-state">Sin partidos.</td></tr>`;

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Detalle de jugador</h2>
        <label class="inline">Jugador:
          <select data-action="select-player">
            ${state.players.map(p =>
              `<option value="${esc(p.player_id)}" ${p.player_id === selected ? 'selected' : ''}>${esc(p.name)}</option>`
            ).join('')}
          </select>
        </label>
      </div>
      <p class="hint">Total acumulado fase de grupos: <span class="points">${total}</span> puntos.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Grupo</th><th>Partido</th><th>Pronóstico</th><th>Resultado</th><th class="table-center">Pts</th></tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </div>`;
}

// --- Mini-porra ------------------------------------------------------------
const MINI_FIELD_LABELS = {
  text: 'Texto libre', number: 'Número', team: 'Equipo',
  player: 'Jugador', 'goals-range': 'Goles'
};

function miniNormalize(s) {
  return String(s || '').trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function miniResultFor(questionId) {
  const r = state.miniResults.find(x => x.question_id === questionId);
  return r ? String(r.value || '').trim() : '';
}
function miniAnswerFor(playerId, questionId) {
  const a = state.miniAnswers.find(x => x.player_id === playerId && x.question_id === questionId);
  return a ? String(a.value || '').trim() : '';
}

function miniMyAnswerFor(questionId) {
  return String(state.myMiniDraft[questionId] ?? miniAnswerFor(state.myPlayerId, questionId) ?? '').trim();
}

function miniEditOpen() {
  return Boolean(state.myPlayerId) &&
    state.porra.status === 'open' &&
    (!state.porra.predictions_deadline || new Date() < new Date(state.porra.predictions_deadline));
}

function miniAnswerStatus(questionId) {
  return document.querySelector(`[data-mini-status="${questionId}"]`);
}

async function refreshMiniAnswersFromState() {
  state.miniAnswers = await fetchAllRows('porra_mini_answers', state.porra.id);
}

async function saveMiniAnswerRow(questionId, value) {
  const { error } = await supabase
    .from('porra_mini_answers')
    .upsert([{
      porra_id: state.porra.id,
      player_id: state.myPlayerId,
      question_id: questionId,
      value
    }], { onConflict: 'porra_id,player_id,question_id' });

  if (error) throw error;
  await refreshMiniAnswersFromState();
  delete state.myMiniDraft[questionId];
  render();
}

async function deleteMiniAnswerRow(questionId) {
  const { error } = await supabase
    .from('porra_mini_answers')
    .delete()
    .eq('porra_id', state.porra.id)
    .eq('player_id', state.myPlayerId)
    .eq('question_id', questionId);

  if (error) throw error;
  await refreshMiniAnswersFromState();
  delete state.myMiniDraft[questionId];
  render();
}

// Puntúa la respuesta de un jugador a una pregunta. Misma lógica que la legacy:
// el resultado admite variantes separadas por "|"; en número, "+N" = "al menos N".
function scoreMiniAnswer(question, answer, result) {
  if (!result) return { points: 0, correct: false };
  const accepted = result.split('|').map(v => v.trim()).filter(Boolean);
  let correct = false;
  const ft = question.field_type;
  if (ft === 'number' || ft === 'goals-range') {
    const predicted = String(answer || '').trim();
    const actual = Number(result);
    const min = predicted.match(/^\+\s*(\d+)$/);
    correct = Number.isFinite(actual) && (min ? actual >= Number(min[1]) : Number(predicted) === actual);
  } else if (ft === 'team') {
    correct = accepted.map(miniNormalize).includes(miniNormalize(answer));
  } else {
    correct = accepted.some(v => miniNormalize(v) && miniNormalize(v) === miniNormalize(answer));
  }
  return { points: correct ? (question.points || 0) : 0, correct };
}

function computeMiniRanking() {
  const rows = state.players.map(player => {
    let points = 0, correct = 0, resolved = 0;
    for (const q of state.miniQuestions) {
      const result = miniResultFor(q.question_id);
      const s = scoreMiniAnswer(q, miniAnswerFor(player.player_id, q.question_id), result);
      points += s.points;
      if (s.correct) correct++;
      if (result) resolved++;
    }
    return { id: player.player_id, name: player.name, miniPoints: points, miniCorrect: correct, miniResolved: resolved };
  }).sort((a, b) => b.miniPoints - a.miniPoints || b.miniCorrect - a.miniCorrect || a.name.localeCompare(b.name, 'es'));
  rows.forEach((r, i) => { r.position = i + 1; });
  return rows;
}

function renderMini() {
  const questions = state.miniQuestions;
  if (!questions.length) {
    $app.innerHTML = `<div class="panel"><div class="panel-head"><h2>Mini-porra</h2></div><p class="empty-state">Esta porra no tiene mini-porra configurada.</p></div>`;
    return;
  }
  const ranking = computeMiniRanking();
  const q = (state.miniQuery || '').toLowerCase();
  const rows = ranking.filter(r => r.name.toLowerCase().includes(q));
  const resolved = questions.filter(qq => miniResultFor(qq.question_id)).length;
  const maxPoints = questions.reduce((t, qq) => t + (qq.points || 0), 0);
  const canEditMini = miniEditOpen();
  const miniStatusText = !state.myPlayerId
    ? 'Entra para editar tus respuestas.'
    : (canEditMini
      ? `Edición abierta · cierre: ${state.porra.predictions_deadline ? new Date(state.porra.predictions_deadline).toLocaleString('es-ES') : 'sin límite'}`
      : 'Edición cerrada (la porra no está abierta o pasó el deadline).');
  const miniEditorRows = questions.map((question, index) => {
    const value = miniMyAnswerFor(question.question_id);
    const placeholder = question.field_type === 'number' || question.field_type === 'goals-range'
      ? '0 o +N'
      : 'Escribe tu respuesta';
    return `
      <article class="mini-answer-card">
        <div class="mini-answer-copy">
          <span class="pill">Q${index + 1} · ${esc(question.points || 0)} pts</span>
          <h3>${esc(question.question)}</h3>
          <p>${esc(MINI_FIELD_LABELS[question.field_type] || question.field_type)}</p>
        </div>
        <form class="mini-answer-form" data-mini-answer-form data-question-id="${esc(question.question_id)}">
          <div class="mini-answer-input-wrap">
            <input
              class="mini-answer-input"
              name="answer"
              type="text"
              placeholder="${esc(placeholder)}"
              value="${esc(value)}"
              inputmode="text"
              ${canEditMini ? '' : 'disabled'}
            />
          </div>
          <div class="mini-answer-actions">
            ${canEditMini ? `
            <button type="submit" class="primary">Guardar</button>
            <button type="button" data-clear-mini-answer="${esc(question.question_id)}">Limpiar</button>` : ''}
            <span class="mini-answer-status hint" data-mini-status="${esc(question.question_id)}"></span>
          </div>
        </form>
      </article>`;
  }).join('');

  $app.innerHTML = `
    <section class="cards">
      <article class="card"><b>${resolved}/${questions.length}</b><span>preguntas resueltas</span></article>
      <article class="card summary-leader"><b>${ranking[0] ? esc(ranking[0].name) : '-'}</b><span>líder mini-porra</span></article>
      <article class="card"><b>${ranking[0]?.miniPoints || 0}</b><span>puntos del líder</span></article>
      <article class="card"><b>${maxPoints}</b><span>puntos máximos</span></article>
    </section>

    <div class="panel">
      <div class="panel-head">
        <h2>Clasificación mini-porra</h2>
        <input type="search" data-action="mini-search" placeholder="Buscar participante…" value="${esc(state.miniQuery || '')}" />
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th class="table-center">#</th><th>Participante</th><th class="table-center">Puntos</th><th class="table-center">Aciertos</th><th class="table-center">Corregidas</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr class="${r.position <= 3 ? 'rank-' + r.position : ''}">
              <td class="ranking-position">${r.position}</td>
              <td class="standing-team">${esc(r.name)}${r.id === state.myPlayerId ? ' <span class="pill">tú</span>' : ''}</td>
              <td class="table-center points">${r.miniPoints}</td>
              <td class="table-center">${r.miniCorrect}</td>
              <td class="table-center">${r.miniResolved}/${questions.length}</td>
            </tr>`).join('') || `<tr><td colspan="5" class="empty-state">Sin participantes.</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Pronósticos de la mini-porra</h2>
          <span class="hint">Puedes indicar variantes o empates con |.</span>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Pregunta</th><th>Resultado</th><th class="table-center">Puntos</th>${state.players.map(p => `<th>${esc(p.name)}</th>`).join('')}</tr></thead>
          <tbody>${questions.map(question => {
            const result = miniResultFor(question.question_id);
            return `<tr>
              <td><strong>${esc(question.question)}</strong><br><span class="field-type">${MINI_FIELD_LABELS[question.field_type] || question.field_type}</span></td>
              <td>${result ? esc(result) : '<span class="muted">pendiente</span>'}</td>
              <td class="table-center">${question.points || 0}</td>
              ${state.players.map(player => {
                const answer = miniAnswerFor(player.player_id, question.question_id);
                const s = scoreMiniAnswer(question, answer, result);
                return `<td class="${result ? (s.correct ? 'ok' : 'muted') : ''}">${answer ? esc(answer) : '<span class="muted">—</span>'}${s.correct ? ` (+${s.points})` : ''}</td>`;
              }).join('')}
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;

  if (state.myPlayerId) {
    $app.insertAdjacentHTML('beforeend', `
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Resultados de la mini-porra</h2>
            <span class="hint">${esc(miniStatusText)}</span>
          </div>
        </div>
        <div class="mini-answer-grid">
          ${miniEditorRows}
        </div>
      </div>`);
  } else {
    $app.insertAdjacentHTML('beforeend', `
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Resultados de la mini-porra</h2>
            <span class="hint">${esc(miniStatusText)}</span>
          </div>
        </div>
        <p class="empty-state">Identifícate para editar tus respuestas de mini-porra.</p>
      </div>`);
  }
}

function knockoutSelectedPlayerId() {
  const available = new Set(state.players.map(player => player.player_id));
  if (state.knockoutPlayerId && available.has(state.knockoutPlayerId)) return state.knockoutPlayerId;
  state.knockoutPlayerId = state.myPlayerId && available.has(state.myPlayerId)
    ? state.myPlayerId
    : (state.players[0]?.player_id || null);
  return state.knockoutPlayerId;
}

function knockoutPredictionStatus(team, stageReality) {
  if (!team || !stageReality || !stageReality.resolved) return 'pending';
  if (stageReality.teams.has(knockoutTeamKey(team))) return 'correct';
  return stageReality.complete ? 'wrong' : 'pending';
}

function renderBracketTeam(team, status = 'pending') {
  const statusMark = status === 'correct' ? '✓' : (status === 'wrong' ? '×' : '');
  const label = team ? `${teamFlag(team) || '🏳️'} ${esc(team)}` : 'Por definir';
  return `<div class="bracket-team ${status}"><span>${label}</span><span class="bracket-status">${statusMark}</span></div>`;
}

function bracketGridStyle(halfRoundCount) {
  const columns = halfRoundCount > 0
    ? `repeat(${halfRoundCount},220px) 240px repeat(${halfRoundCount},220px)`
    : '240px';
  const minWidth = halfRoundCount > 0
    ? `${240 + (halfRoundCount * 2 * 220) + (halfRoundCount * 2 * 34)}px`
    : '240px';
  return `grid-template-columns:${columns};min-width:${minWidth}`;
}

function renderKnockoutRound(stage, teams, stageScore, { matchOffset = 0, side = 'left' } = {}) {
  const matches = [];
  for (let index = 0; index < teams.length; index += 2) {
    matches.push(`
      <article class="bracket-match ${side === 'right' ? 'right-side' : ''}">
        <span class="bracket-match-number">Cruce ${matchOffset + index / 2 + 1}</span>
        ${renderBracketTeam(teams[index], knockoutPredictionStatus(teams[index], stageScore))}
        ${renderBracketTeam(teams[index + 1], knockoutPredictionStatus(teams[index + 1], stageScore))}
      </article>
    `);
  }

  return `
    <section class="bracket-round ${side === 'right' ? 'right-bracket-round' : ''}" style="--matches:${Math.max(matches.length, 1)}">
      <div class="bracket-round-head">
        <h3>${esc(stageScore.label)}</h3>
        <span>${stageScore.hits} aciertos · +${stageScore.points} pts</span>
        <small>${stageScore.resolved}/${stageScore.expected} selecciones confirmadas</small>
      </div>
      <div class="bracket-matches">${matches.join('')}</div>
    </section>
  `;
}

function renderKnockoutEditorPick(stageKey, slot, active, allowedTeams = []) {
  const disabled = knockoutEditOpen() ? '' : ' disabled';
  const selected = String(active || '').trim();
  const options = uniqueTeamList([
    ...allowedTeams,
    selected
  ].filter(Boolean));
  return `
    <div class="bracket-team knockout-edit-team">
      <div class="knockout-edit-label">
        <span class="bracket-flag">${teamFlag(selected) || '🏳️'}</span>
        <span class="knockout-edit-label-text">${esc(selected || 'Por definir')}</span>
      </div>
      <select data-knockout-input="${esc(`${stageKey}:${slot}`)}"${disabled}>
        <option value="">Por definir</option>
        ${options.map(option => `
          <option value="${esc(option)}"${option === selected ? ' selected' : ''}>${teamFlag(option) || '🏳️'} ${esc(option)}</option>
        `).join('')}
      </select>
      ${knockoutEditOpen() ? `<div class="knockout-edit-actions">
        <button type="button" class="primary" data-save-knockout="${esc(`${stageKey}:${slot}`)}">Guardar</button>
        <button type="button" data-clear-knockout="${esc(`${stageKey}:${slot}`)}">Limpiar</button>
      </div>` : ''}
      <span class="knockout-edit-status hint" data-knockout-status="${esc(`${stageKey}:${slot}`)}"></span>
    </div>
  `;
}

function renderKnockoutEditorRound(stage, teams, bracket, { matchOffset = 0, slotOffset = 0, side = 'left' } = {}) {
  const stageIndex = knockoutRoundStages().findIndex(item => item.key === stage.key);
  const matches = [];
  for (let index = 0; index < teams.length; index += 2) {
    const firstSlot = slotOffset + index + 1;
    const secondSlot = slotOffset + index + 2;
    const firstActive = teams[index] || '';
    const secondActive = teams[index + 1] || '';
    if (stageIndex === 0) {
      matches.push(`
        <article class="bracket-match ${side === 'right' ? 'right-side' : ''}">
          <span class="bracket-match-number">Cruce ${matchOffset + index / 2 + 1}</span>
          ${renderBracketTeam(firstActive, knockoutPredictionStatus(firstActive, {
            teams: new Set([knockoutTeamKey(firstActive)]),
            complete: Boolean(firstActive)
          }))}
          ${renderBracketTeam(secondActive, knockoutPredictionStatus(secondActive, {
            teams: new Set([knockoutTeamKey(secondActive)]),
            complete: Boolean(secondActive)
          }))}
        </article>
      `);
      continue;
    }
    const firstAllowed = allowedTeamsForKnockoutSlot(state.myPlayerId, stage.key, firstSlot, bracket);
    const secondAllowed = allowedTeamsForKnockoutSlot(state.myPlayerId, stage.key, secondSlot, bracket);
    matches.push(`
      <article class="bracket-match ${side === 'right' ? 'right-side' : ''}">
        <span class="bracket-match-number">Cruce ${matchOffset + index / 2 + 1}</span>
        ${renderKnockoutEditorPick(stage.key, firstSlot, firstActive, firstAllowed)}
        ${renderKnockoutEditorPick(stage.key, secondSlot, secondActive, secondAllowed)}
      </article>
    `);
  }

  return `
    <section class="bracket-round knockout-edit-round ${side === 'right' ? 'right-bracket-round' : ''}" style="--matches:${Math.max(matches.length, 1)}">
      <div class="bracket-round-head">
        <h3>${esc(stage.label)}</h3>
        <span>${stage.teams} selecciones</span>
        <small>Edición manual de clasificados</small>
      </div>
      <div class="bracket-matches">${matches.join('')}</div>
    </section>
  `;
}

function renderKnockoutFinal(finalStage, finalTeams, champion, finalScore, championScore) {
  return `
    <section class="bracket-round bracket-final-round">
      <div class="bracket-round-head">
        <h3>${esc(finalStage.label)}</h3>
        <span>${finalScore.hits} aciertos · +${finalScore.points} pts</span>
        <small>${finalScore.resolved}/${finalScore.expected} selecciones confirmadas</small>
      </div>
      <div class="bracket-matches">
        <article class="bracket-match">
          <span class="bracket-match-number">${esc(finalStage.label)}</span>
          ${renderBracketTeam(finalTeams[0], knockoutPredictionStatus(finalTeams[0], finalScore))}
          ${renderBracketTeam(finalTeams[1], knockoutPredictionStatus(finalTeams[1], finalScore))}
        </article>
        <article class="bracket-match champion-card">
          <span class="trophy" aria-hidden="true">★</span>
          ${renderBracketTeam(champion, knockoutPredictionStatus(champion, championScore))}
        </article>
      </div>
    </section>
  `;
}

function renderKnockoutEditorFinal(finalStage, finalTeams, bracket) {
  const finalist1 = finalTeams[0] || '';
  const finalist2 = finalTeams[1] || '';
  const champion = knockoutPickFor(state.myPlayerId, 'champion', 1)?.team || '';
  const finalistOptions1 = allowedTeamsForKnockoutSlot(state.myPlayerId, finalStage.key, 1, bracket);
  const finalistOptions2 = allowedTeamsForKnockoutSlot(state.myPlayerId, finalStage.key, 2, bracket);
  const championOptions = allowedTeamsForChampionSlot(state.myPlayerId, bracket, finalStage.key);
  return `
    <section class="bracket-round bracket-final-round knockout-edit-round">
      <div class="bracket-round-head">
        <h3>${esc(finalStage.label)}</h3>
        <span>2 finalistas + campeón</span>
        <small>Edición manual de clasificados</small>
      </div>
      <div class="bracket-matches">
        <article class="bracket-match">
          <span class="bracket-match-number">${esc(finalStage.label)}</span>
          ${renderKnockoutEditorPick(finalStage.key, 1, finalist1, finalistOptions1)}
          ${renderKnockoutEditorPick(finalStage.key, 2, finalist2, finalistOptions2)}
        </article>
        <article class="bracket-match champion-card knockout-edit-champion">
          <span class="trophy" aria-hidden="true">★</span>
          ${renderKnockoutEditorPick('champion', 1, champion, championOptions)}
        </article>
      </div>
    </section>
  `;
}

function renderKnockout() {
  const stages = knockoutStages();
  const roundStages = knockoutRoundStages();
  if (!roundStages.length) {
    $app.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>Cruces</h2></div>
        <p class="empty-state">Esta porra todavía no tiene estructura de cruces configurada.</p>
      </div>`;
    return;
  }
  if (!state.players.length) {
    $app.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>Cruces</h2></div>
        <p class="empty-state">Todavía no hay participantes cargados para mostrar pronósticos de cruces.</p>
      </div>`;
    return;
  }

  const playerId = knockoutSelectedPlayerId();
  const player = state.players.find(item => item.player_id === playerId) || null;
  const knockout = calculatePlayerKnockout(playerId);
  const bracket = buildPlayerKnockoutBracket(playerId);
  const finalStage = roundStages[roundStages.length - 1];
  const finalTeams = bracket[finalStage.key] || ['', ''];
  const champion = championPickFor(playerId);
  const summaryStages = stages.map(stage => knockout.breakdown[stage.key]);
  const halfRounds = roundStages.slice(0, -1);
  const leftRounds = halfRounds.map(stage => ({
    stage,
    teams: (bracket[stage.key] || []).slice(0, (bracket[stage.key] || []).length / 2),
    matchOffset: 0,
    slotOffset: 0
  }));
  const rightRounds = halfRounds.map(stage => ({
    stage,
    teams: (bracket[stage.key] || []).slice((bracket[stage.key] || []).length / 2),
    matchOffset: (bracket[stage.key] || []).length / 4,
    slotOffset: (bracket[stage.key] || []).length / 2
  })).reverse();
  const canEditOwnKnockout = knockoutEditOpen();
  const ownBracket = state.myPlayerId ? buildPlayerKnockoutBracket(state.myPlayerId) : {};
  const ownFinalTeams = finalStage && state.myPlayerId ? (ownBracket[finalStage.key] || ['', '']) : ['', ''];

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Cuadro de cruces</h2>
          <span class="hint">Recorrido previsto por cada participante desde ${esc(roundStages[0].label.toLowerCase())} hasta campeón.</span>
        </div>
        <label class="inline knockout-player-picker">
          <span>Participante</span>
          <select data-action="select-knockout-player">
            ${state.players.map(item => `<option value="${esc(item.player_id)}"${item.player_id === playerId ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="knockout-score-summary">
        <article class="knockout-total">
          <b>${knockout.points}</b>
          <span>puntos en cruces</span>
        </article>
        ${summaryStages.map(stage => `
          <article>
            <strong>${esc(stage.label)}</strong>
            <span>${stage.hits} aciertos · +${stage.points} pts</span>
          </article>
        `).join('')}
      </div>

      <div class="bracket-wrap">
        <div class="bracket-title">
          <span>Pronóstico de</span>
          <strong>${esc(player?.name || '')}</strong>
        </div>
        <div class="bracket" style="${bracketGridStyle(halfRounds.length)}">
          ${leftRounds.map(({ stage, teams, matchOffset }) =>
            renderKnockoutRound(stage, teams, knockout.breakdown[stage.key], { matchOffset })
          ).join('')}
          ${renderKnockoutFinal(finalStage, finalTeams, champion, knockout.breakdown[finalStage.key], knockout.breakdown.champion)}
          ${rightRounds.map(({ stage, teams, matchOffset }) =>
            renderKnockoutRound(stage, teams, knockout.breakdown[stage.key], { matchOffset, side: 'right' })
          ).join('')}
        </div>
      </div>
    </div>
    ${state.myPlayerId ? `
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Editar mis cruces</h2>
            <span class="hint">${canEditOwnKnockout
              ? `Edición abierta · cierre: ${state.porra.predictions_deadline ? esc(new Date(state.porra.predictions_deadline).toLocaleString('es-ES')) : 'sin límite'}`
              : 'Edición cerrada (la porra no está abierta o pasó el deadline).'}</span>
          </div>
        </div>
        <div class="bracket-wrap">
          <div class="bracket-title">
            <span>Editando cruces de</span>
            <strong>${esc(playerName(state.myPlayerId))}</strong>
          </div>
          <p class="hint">Los cruces iniciales se generan automáticamente a partir de tus resultados de grupos. Después puedes completar los equipos que van pasando.</p>
          <div class="bracket bracket-editor" style="${bracketGridStyle(halfRounds.length)}">
            ${leftRounds.map(({ stage, teams, matchOffset, slotOffset }) =>
              renderKnockoutEditorRound(stage, (ownBracket[stage.key] || []).slice(0, (ownBracket[stage.key] || []).length / 2), ownBracket, { matchOffset, slotOffset })
            ).join('')}
            ${renderKnockoutEditorFinal(finalStage, ownFinalTeams, ownBracket)}
            ${rightRounds.map(({ stage, matchOffset, slotOffset }) =>
              renderKnockoutEditorRound(stage, (ownBracket[stage.key] || []).slice((ownBracket[stage.key] || []).length / 2), ownBracket, {
                matchOffset,
                slotOffset,
                side: 'right'
              })
            ).join('')}
          </div>
        </div>
      </div>
    ` : ''}
  `;
}

function renderMyPorra() {
  if (!state.myPlayerId) { state.tab = 'ranking'; render(); return; }
  const open = state.porra.status === 'open' &&
    (!state.porra.predictions_deadline || new Date() < new Date(state.porra.predictions_deadline));
  const groupMatches = state.matches.filter(m => m.stage === 'group');
  const deadlineTxt = state.porra.predictions_deadline
    ? new Date(state.porra.predictions_deadline).toLocaleString('es-ES')
    : 'sin límite';

  // Agrupar por jornada (slot)
  const bySlot = new Map();
  for (const m of groupMatches) {
    const slot = matchdayOf(m);
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot).push(m);
  }
  const sortedSlots = [...bySlot.keys()].sort((a, b) => Number(a) - Number(b));

  const colspan = open ? 4 : 3;
  const tableBody = sortedSlots.map(slot => {
    const slotMatches = bySlot.get(slot);
    return `
      <tr class="matchday-header">
        <td colspan="${colspan}">Jornada ${esc(String(slot))}</td>
      </tr>
      ${slotMatches.map(m => {
        const saved = predictionFor(state.myPlayerId, m.match_id);
        const val = state.myDraft[m.match_id] ?? (saved ? saved.score : '');
        return `<tr>
          <td class="muted" style="font-size:.8rem">${esc(m.group_id || '')}</td>
          <td>${teamFlag(m.team1)} ${esc(teamName(m.team1))} – ${esc(teamName(m.team2))} ${teamFlag(m.team2)}</td>
          <td class="table-center"><input class="score-input" data-match="${esc(m.match_id)}"
               value="${esc(val)}" placeholder="2-1" ${open ? '' : 'disabled'} /></td>
          ${open ? `<td class="table-center">
            <div class="row-actions">
              <button class="primary" data-save-match="${esc(m.match_id)}">Guardar</button>
              <button data-clear-match="${esc(m.match_id)}">Limpiar</button>
              <span class="row-status hint" data-status="${esc(m.match_id)}"></span>
            </div>
          </td>` : ''}
        </tr>`;
      }).join('')}`;
  }).join('');

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Editar mi porra</h2>
        <span class="hint">${open
          ? `Edición abierta · cierre: ${deadlineTxt}`
          : `Edición cerrada (la porra no está abierta o pasó el deadline)`}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Grupo</th><th>Partido</th><th class="table-center">Mi marcador</th>${open ? '<th class="table-center">Acciones</th>' : ''}</tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
      ${open ? `<div class="actions"><button data-action="save-mine" class="primary">Guardar todo</button>
        <span id="save-status" class="hint"></span></div>` : ''}
    </div>`;
}

function renderLoginForm() {
  $app.innerHTML = `
    <div class="panel" style="max-width:420px">
      <div class="panel-head"><h2>Entrar para jugar</h2></div>
      <form id="login-form" class="login">
        <label>Email<input type="email" name="email" required /></label>
        <label>Contraseña<input type="password" name="password" required /></label>
        <div class="actions"><button type="submit" class="primary">Entrar</button></div>
        <p id="login-error" class="error"></p>
      </form>
    </div>`;
}

// ---------------------------------------------------------------------------
// Probabilidades — Monte Carlo
// ---------------------------------------------------------------------------

// Seeded LCG random number generator (reproducible per-run)
function makeLcgRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Clave de caché: número de resultados conocidos + predicciones totales + respuestas mini
function probabilitiesCacheKey() {
  const resultCount = state.matches.filter(m => matchResult(m)).length;
  const predCount = state.predictions.length;
  const miniCount = state.miniResults.length;
  return `${resultCount}:${predCount}:${miniCount}`;
}

// Para un partido de grupo sin resultado, elige un marcador de entre las
// predicciones de los jugadores (muestreo ponderado por frecuencia).
// Si nadie predijo ese partido, genera marcadores aleatorios 0-3.
function sampleGroupScore(match, rng) {
  const preds = state.predictions
    .filter(p => p.match_id === match.match_id && p.score)
    .map(p => p.score);
  if (preds.length) {
    return preds[Math.floor(rng() * preds.length)];
  }
  const g = () => Math.floor(rng() * 4); // 0-3
  return `${g()}-${g()}`;
}

// Asigna los mejores terceros a los slots del bracket, igual que
// buildPredictedThirdPlaceAssignments pero usando resultados oficiales.
function assignRealThirdPlaceToSlots(template, thirdPlaceByGroup) {
  if (!template?.thirdPlaceQualifiers) return new Map();
  const thirds = [...thirdPlaceByGroup.values()]
    .filter(Boolean)
    .sort((a, b) =>
      b.pts - a.pts ||
      ((b.gf - b.gc) - (a.gf - a.gc)) ||
      (b.gf - a.gf) ||
      String(a.group).localeCompare(String(b.group), 'es')
    )
    .slice(0, template.thirdPlaceQualifiers);
  const bestGroups = new Set(thirds.map(r => r.group));
  const assignments = new Map();
  const used = new Set();
  for (const fixture of template.knockout || []) {
    for (const side of ['home', 'away']) {
      const groups = parseThirdPlaceGroups(fixture[side]);
      if (!groups.length) continue;
      const cands = groups.filter(g => bestGroups.has(g) && !used.has(g));
      const sel = cands[0] || groups.find(g => !used.has(g)) || groups[0];
      const row = thirdPlaceByGroup.get(sel);
      if (row) { assignments.set(`${fixture.id}:${side}`, row.team); used.add(sel); }
    }
  }
  return assignments;
}

// Una iteración de Monte Carlo: simula el resto del torneo y devuelve
// { groupStandings, stageTeams, champion }
function simulateOneTournament(rng) {
  const scoring = scoringConfig();
  // 1. Fase de grupos: resultados conocidos + simulados
  const simResults = new Map(); // match_id → { home, away }
  for (const m of state.matches.filter(m => m.stage === 'group')) {
    const real = matchResult(m);
    if (real) { simResults.set(m.match_id, real); continue; }
    const score = sampleGroupScore(m, rng);
    const parsed = score.split('-').map(Number);
    if (parsed.length === 2 && !isNaN(parsed[0]) && !isNaN(parsed[1])) {
      simResults.set(m.match_id, { home: parsed[0], away: parsed[1] });
    }
  }

  // 2. Clasificaciones simuladas de grupo
  const groupIds = state.groups.length
    ? state.groups.map(g => g.name ?? g.group_id)
    : [...new Set(state.matches.filter(m => m.stage === 'group').map(m => m.group_id).filter(Boolean))];

  const standingsByGroup = new Map();
  const thirdPlaceByGroup = new Map();
  for (const groupId of groupIds) {
    const gMatches = state.matches.filter(m => m.stage === 'group' && m.group_id === groupId);
    const teamIds = [...new Set(gMatches.flatMap(m => [m.team1, m.team2]).filter(Boolean))];
    const rows = teamIds.map((team, idx) => ({ group: groupId, team, idx, pts: 0, gf: 0, gc: 0 }));
    const byTeam = new Map(rows.map(r => [r.team, r]));
    for (const m of gMatches) {
      const r = simResults.get(m.match_id);
      if (!r) continue;
      const home = byTeam.get(m.team1), away = byTeam.get(m.team2);
      if (!home || !away) continue;
      home.gf += r.home; home.gc += r.away;
      away.gf += r.away; away.gc += r.home;
      if (r.home > r.away) home.pts += 3;
      else if (r.away > r.home) away.pts += 3;
      else { home.pts++; away.pts++; }
    }
    const sorted = rows.sort((a, b) =>
      b.pts - a.pts || ((b.gf - b.gc) - (a.gf - a.gc)) || b.gf - a.gf || a.idx - b.idx
    );
    standingsByGroup.set(groupId, sorted);
    if (sorted[2]) thirdPlaceByGroup.set(groupId, sorted[2]);
  }

  // 3. Knockout: resolver semillas y simular rondas
  const template = knockoutTemplateForPorra();
  const thirdAssignments = assignRealThirdPlaceToSlots(template, thirdPlaceByGroup);

  // Resuelve token a nombre de equipo usando clasificaciones simuladas
  function resolveToken(token, fixtureId, side, winnerMap) {
    const raw = String(token || '').trim();
    if (!raw) return '';
    const directTeam = teamByToken(raw);
    if (directTeam) return directTeam.name;
    const seed = parseGroupSeed(raw);
    if (seed) {
      const standings = standingsByGroup.get(seed.letter) || [];
      return standings[seed.pos - 1]?.team || raw;
    }
    const thirdGroups = parseThirdPlaceGroups(raw);
    if (thirdGroups.length) {
      return thirdAssignments.get(`${fixtureId}:${side}`) || raw;
    }
    const winnerOf = raw.match(/^W:(.+)$/i);
    if (winnerOf) return winnerMap.get(winnerOf[1].toUpperCase()) || '';
    return raw;
  }

  // Para cada ronda knockout, los equipos que llegan a cada etapa
  const stageTeams = {}; // stageKey → Set of team names
  const winnerMap = new Map(); // fixture id → winner name
  const koMatches = knockoutMatches();

  // Agrupa partidos knockout por ronda en orden de KNOCKOUT_STAGE_ORDER
  const roundKeys = KNOCKOUT_STAGE_ORDER.filter(k => k !== 'champion');
  for (const stageKey of roundKeys) {
    const matches = koMatches.filter(m => normalizeKnockoutStageKey(m.round_key) === stageKey);
    if (!matches.length) continue;
    const teamsThisRound = new Set();
    for (const m of matches) {
      const fid = String(m.match_id || '').toUpperCase();
      const t1 = resolveToken(m.team1_id ?? m.team1 ?? '', fid, 'home', winnerMap);
      const t2 = resolveToken(m.team2_id ?? m.team2 ?? '', fid, 'away', winnerMap);
      if (t1) teamsThisRound.add(knockoutTeamKey(t1));
      if (t2) teamsThisRound.add(knockoutTeamKey(t2));

      // Si hay resultado real (incluido el ganador por penaltis en empate), usa el
      // ganador real; si no, elige aleatoriamente ponderando por cuántos jugadores
      // eligieron cada equipo en esta ronda
      const realWinnerToken = knockoutWinnerToken(m);
      let winner = '';
      if (realWinnerToken) {
        winner = teamName(realWinnerToken);
      } else if (t1 && t2) {
        // contar votos de jugadores para cada equipo en esta ronda
        const votes1 = state.knockoutPicks.filter(p =>
          normalizeKnockoutStageKey(p.stage) === stageKey &&
          knockoutTeamKey(p.team) === knockoutTeamKey(t1)
        ).length;
        const votes2 = state.knockoutPicks.filter(p =>
          normalizeKnockoutStageKey(p.stage) === stageKey &&
          knockoutTeamKey(p.team) === knockoutTeamKey(t2)
        ).length;
        const w1 = 1 + votes1, w2 = 1 + votes2;
        winner = rng() < w1 / (w1 + w2) ? t1 : t2;
      }
      if (winner) winnerMap.set(fid, winner);
    }
    stageTeams[stageKey] = teamsThisRound;
  }

  // Campeón: ganador de la final
  const finalMatch = koMatches.find(m => normalizeKnockoutStageKey(m.round_key) === 'final');
  let champion = '';
  if (finalMatch) {
    const fid = String(finalMatch.match_id || '').toUpperCase();
    champion = winnerMap.get(fid) || '';
  }

  return { simResults, standingsByGroup, stageTeams, champion };
}

// Puntos que un jugador obtendría en una simulación dada
function scorePlayerInSim(playerId, simResults, stageTeams, champion) {
  const scoring = scoringConfig();
  let groupPoints = 0, exacts = 0;
  for (const m of state.matches.filter(m => m.stage === 'group')) {
    const result = simResults.get(m.match_id);
    if (!result) continue;
    const pred = predictionFor(playerId, m.match_id);
    if (!pred) continue;
    const r = scorePrediction({ score: pred.score }, result, scoring);
    groupPoints += r.points;
    if (r.exact) exacts++;
  }

  // Knockout: comparar picks del jugador contra equipos simulados por ronda
  const koScoring = knockoutScoringConfig();
  let koPoints = 0;
  const playerBracket = buildPlayerKnockoutBracket(playerId);
  for (const stageKey of KNOCKOUT_STAGE_ORDER.filter(k => k !== 'champion')) {
    const teams = stageTeams[stageKey];
    if (!teams) continue;
    const picks = (playerBracket[stageKey] || []).filter(Boolean);
    const hits = picks.filter(t => teams.has(knockoutTeamKey(t))).length;
    koPoints += hits * (koScoring[stageKey] || 0);
  }
  const champPick = knockoutChampionPick(playerId);
  if (champion && champPick && knockoutTeamKey(champPick) === knockoutTeamKey(champion)) {
    koPoints += koScoring.champion || 0;
  }

  return { total: groupPoints + koPoints, groupPoints, koPoints, exacts };
}

// Puntos de mini-porra que un jugador obtendría con un resultado simulado de mini
function scoreMiniInSim(playerId, simMiniResults) {
  let points = 0, correct = 0;
  for (const q of state.miniQuestions) {
    const result = simMiniResults[q.question_id];
    if (!result) continue;
    const answer = miniAnswerFor(playerId, q.question_id);
    const s = scoreMiniAnswer(q, answer, result);
    points += s.points;
    if (s.correct) correct++;
  }
  return { points, correct };
}

// Para preguntas mini sin resultado oficial, muestrea la respuesta más votada
// con algo de variabilidad (no siempre la más común, para que la distribución
// refleje incertidumbre)
function sampleMiniResults(rng) {
  const simMiniResults = {};
  for (const q of state.miniQuestions) {
    const official = miniResultFor(q.question_id);
    if (official) { simMiniResults[q.question_id] = official; continue; }
    // recoger respuestas de los jugadores
    const answers = state.miniAnswers
      .filter(a => a.question_id === q.question_id && a.answer)
      .map(a => a.answer);
    if (!answers.length) continue;
    // muestrear de la distribución de respuestas
    simMiniResults[q.question_id] = answers[Math.floor(rng() * answers.length)];
  }
  return simMiniResults;
}

const PROB_ITERATIONS = 2000;

function runProbabilitiesSimulation() {
  const rng = makeLcgRng(20260617);
  const playerCount = state.players.length;
  if (!playerCount) return null;

  // Acumuladores
  const playerTotals = new Map(state.players.map(p => [p.player_id, { sum: 0, wins: 0, exacts: 0 }]));
  const miniTotals = new Map(state.players.map(p => [p.player_id, { sum: 0, wins: 0 }]));
  const teamStageProb = new Map(); // teamKey → { r32:0, r16:0, qf:0, sf:0, final:0, champion:0 }
  for (const t of state.teams) teamStageProb.set(knockoutTeamKey(t.name), { r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0 });

  const hasMini = state.miniQuestions.length > 0;
  const pendingMatches = state.matches.filter(m => m.stage === 'group' && !matchResult(m)).length;

  for (let i = 0; i < PROB_ITERATIONS; i++) {
    const { simResults, stageTeams, champion } = simulateOneTournament(rng);
    const simMiniResults = hasMini ? sampleMiniResults(rng) : {};

    // Puntuar jugadores
    let maxTotal = -Infinity, maxMini = -Infinity;
    const iterScores = new Map();
    const iterMiniScores = new Map();

    for (const p of state.players) {
      const s = scorePlayerInSim(p.player_id, simResults, stageTeams, champion);
      iterScores.set(p.player_id, s);
      if (s.total > maxTotal) maxTotal = s.total;

      if (hasMini) {
        const ms = scoreMiniInSim(p.player_id, simMiniResults);
        iterMiniScores.set(p.player_id, ms);
        if (ms.points > maxMini) maxMini = ms.points;
      }
    }

    // Acumular — ganadores comparten victoria
    const winners = state.players.filter(p => iterScores.get(p.player_id)?.total === maxTotal);
    const share = 1 / winners.length;
    for (const p of state.players) {
      const s = iterScores.get(p.player_id);
      const acc = playerTotals.get(p.player_id);
      acc.sum += s.total;
      if (s.total === maxTotal) acc.wins += share;
      acc.exacts += s.exacts;
    }

    if (hasMini && maxMini > -Infinity) {
      const miniWinners = state.players.filter(p => iterMiniScores.get(p.player_id)?.points === maxMini);
      const miniShare = 1 / miniWinners.length;
      for (const p of state.players) {
        const ms = iterMiniScores.get(p.player_id);
        const acc = miniTotals.get(p.player_id);
        acc.sum += ms.points;
        if (ms.points === maxMini) acc.wins += miniShare;
      }
    }

    // Acumular probabilidades por equipo y ronda
    for (const [stageKey, teams] of Object.entries(stageTeams)) {
      for (const teamKey of teams) {
        if (teamStageProb.has(teamKey)) teamStageProb.get(teamKey)[stageKey] = (teamStageProb.get(teamKey)[stageKey] || 0) + 1;
      }
    }
    if (champion) {
      const ck = knockoutTeamKey(champion);
      if (teamStageProb.has(ck)) teamStageProb.get(ck).champion = (teamStageProb.get(ck).champion || 0) + 1;
    }
  }

  // Normalizar y construir resultados
  const currentRanking = computeRanking();
  const currentById = new Map(currentRanking.map(r => [r.id, r]));

  const players = state.players.map(p => {
    const acc = playerTotals.get(p.player_id);
    return {
      id: p.player_id,
      name: p.name,
      winProbability: acc.wins / PROB_ITERATIONS,
      averagePoints: acc.sum / PROB_ITERATIONS,
      currentPoints: currentById.get(p.player_id)?.total || 0
    };
  }).sort((a, b) => b.winProbability - a.winProbability || b.averagePoints - a.averagePoints);

  const roundStageKeys = KNOCKOUT_STAGE_ORDER.filter(k => k !== 'champion');
  const teams = [...teamStageProb.entries()]
    .map(([key, counts]) => {
      const team = state.teams.find(t => knockoutTeamKey(t.name) === key);
      if (!team) return null;
      const entry = { team: team.name, flag: team.flag || '' };
      for (const k of roundStageKeys) entry[k] = (counts[k] || 0) / PROB_ITERATIONS;
      entry.champion = (counts.champion || 0) / PROB_ITERATIONS;
      return entry;
    })
    .filter(Boolean)
    .sort((a, b) => b.champion - a.champion);

  const miniPlayers = hasMini
    ? state.players.map(p => {
        const acc = miniTotals.get(p.player_id);
        const miniRow = computeMiniRanking().find(r => r.id === p.player_id);
        return {
          id: p.player_id,
          name: p.name,
          winProbability: acc.wins / PROB_ITERATIONS,
          averagePoints: acc.sum / PROB_ITERATIONS,
          currentPoints: miniRow?.miniPoints || 0
        };
      }).sort((a, b) => b.winProbability - a.winProbability || b.averagePoints - a.averagePoints)
    : [];

  return {
    players,
    teams,
    miniPlayers,
    meta: {
      iterations: PROB_ITERATIONS,
      pendingMatches,
      resolvedMini: state.miniResults.length
    }
  };
}

function ensureProbabilities() {
  const key = probabilitiesCacheKey();
  if (state.probabilitiesCache?.key === key) return state.probabilitiesCache.result;
  const result = runProbabilitiesSimulation();
  state.probabilitiesCache = { key, result };
  return result;
}

function fmtProb(p) {
  return `${(Number(p || 0) * 100).toFixed(1)}%`;
}

function renderProbabilities() {
  const result = ensureProbabilities();
  if (!result) {
    $app.innerHTML = `<div class="panel"><div class="panel-head"><h2>Probabilidades</h2></div><p class="empty-state">No hay participantes todavía.</p></div>`;
    return;
  }

  const { players, teams, miniPlayers, meta } = result;
  const hasMini = miniPlayers.length > 0;
  const hasKnockout = knockoutMatches().length > 0;

  const MAX_ROWS = 8;
  const expPlayers = state.probabilitiesExpanded.players;
  const expTeams = state.probabilitiesExpanded.teams;
  const expMini = state.probabilitiesExpanded.mini;

  // --- Tabla jugadores porra ---
  const showPlayers = expPlayers ? players : players.slice(0, MAX_ROWS);
  const playerRows = showPlayers.map((r, i) => `
    <tr class="${i < 3 ? 'rank-' + (i + 1) : ''}">
      <td class="table-center">${i + 1}</td>
      <td class="standing-team">${esc(r.name)}${r.id === state.myPlayerId ? ' <span class="pill">tú</span>' : ''}</td>
      <td class="table-center points">${fmtProb(r.winProbability)}</td>
      <td class="table-center">${r.averagePoints.toFixed(1)}</td>
      <td class="table-center">${r.currentPoints}</td>
    </tr>`).join('');
  const playersToggle = players.length > MAX_ROWS
    ? `<button class="link-btn" data-action="prob-toggle-players">${expPlayers ? 'Ver menos' : `Ver todos (${players.length})`}</button>` : '';

  // --- Tabla selecciones (solo si hay cruces) ---
  let teamsCard = '';
  if (hasKnockout && teams.length) {
    const roundStages = knockoutRoundStages();
    const stageCols = roundStages.map(s => `<th class="table-center">${esc(s.label)}</th>`).join('');
    const showTeams = expTeams ? teams : teams.slice(0, MAX_ROWS);
    const teamRows = showTeams.map((r, i) => {
      const stageCells = roundStages.map(s => `<td class="table-center">${fmtProb(r[s.key])}</td>`).join('');
      return `<tr class="${i < 3 ? 'rank-' + (i + 1) : ''}">
        <td class="table-center">${i + 1}</td>
        <td class="standing-team">${r.flag} ${esc(r.team)}</td>
        ${stageCells}
        <td class="table-center points">${fmtProb(r.champion)}</td>
      </tr>`;
    }).join('');
    const teamsToggle = teams.length > MAX_ROWS
      ? `<button class="link-btn" data-action="prob-toggle-teams">${expTeams ? 'Ver menos' : `Ver todas (${teams.length})`}</button>` : '';
    teamsCard = `
      <section class="probability-card">
        <div class="section-head">
          <h3>Selecciones</h3>
          <p class="hint">Probabilidad estimada de llegar a cada ronda y de salir campeona.</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Selección</th>${stageCols}<th class="table-center">Campeón</th></tr></thead>
            <tbody>${teamRows}</tbody>
          </table>
        </div>
        <div class="probability-actions">${teamsToggle}</div>
      </section>`;
  }

  // --- Tabla mini-porra ---
  let miniCard = '';
  if (hasMini) {
    const showMini = expMini ? miniPlayers : miniPlayers.slice(0, MAX_ROWS);
    const miniRows = showMini.map((r, i) => `
      <tr class="${i < 3 ? 'rank-' + (i + 1) : ''}">
        <td class="table-center">${i + 1}</td>
        <td class="standing-team">${esc(r.name)}${r.id === state.myPlayerId ? ' <span class="pill">tú</span>' : ''}</td>
        <td class="table-center points">${fmtProb(r.winProbability)}</td>
        <td class="table-center">${r.averagePoints.toFixed(1)}</td>
        <td class="table-center">${r.currentPoints}</td>
      </tr>`).join('');
    const miniToggle = miniPlayers.length > MAX_ROWS
      ? `<button class="link-btn" data-action="prob-toggle-mini">${expMini ? 'Ver menos' : `Ver todos (${miniPlayers.length})`}</button>` : '';
    miniCard = `
      <section class="probability-card">
        <div class="section-head">
          <h3>Jugadores mini-porra</h3>
          <p class="hint">Estimación heurística según resultados ya cerrados y preguntas aún abiertas.</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Participante</th><th class="table-center">Prob. ganar</th><th class="table-center">Media pts</th><th class="table-center">Pts actuales</th></tr></thead>
            <tbody>${miniRows}</tbody>
          </table>
        </div>
        <div class="probability-actions">${miniToggle}</div>
      </section>`;
  }

  const pendingMiniInfo = hasMini
    ? ` · ${meta.resolvedMini}/${state.miniQuestions.length} preguntas mini resueltas`
    : '';

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Probabilidades</h2>
          <p class="hint">Simulación Monte Carlo (${meta.iterations.toLocaleString('es')} iteraciones) · ${meta.pendingMatches} partidos pendientes${pendingMiniInfo}</p>
        </div>
      </div>

      <article class="info-card probabilities-info">
        <h3>Cómo se calcula</h3>
        <ul>
          <li>Porra principal: se simulan los partidos pendientes usando como base los marcadores pronosticados por los participantes, y en cada simulación se recalcula la clasificación completa.</li>
          <li>Jugadores porra: el porcentaje mostrado es la frecuencia con la que cada participante termina primero. Si hay empate en cabeza, esa simulación se reparte entre los empatados.</li>
          ${hasKnockout ? '<li>Selecciones: se estima la probabilidad de llegar a cada ronda y de salir campeona.</li>' : ''}
          ${hasMini ? '<li>Mini-porra: mezcla resultados ya resueltos con una estimación heurística para las preguntas abiertas, por lo que esta tabla es más orientativa que la de la porra principal.</li>' : ''}
        </ul>
      </article>

      <div class="probability-sections">
        <section class="probability-card">
          <div class="section-head">
            <h3>Jugadores porra</h3>
            <p class="hint">Probabilidad estimada de acabar primero en la porra principal.</p>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Participante</th><th class="table-center">Prob. ganar</th><th class="table-center">Media pts</th><th class="table-center">Pts actuales</th></tr></thead>
              <tbody>${playerRows || '<tr><td colspan="5" class="empty-state">Sin participantes.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="probability-actions">${playersToggle}</div>
        </section>

        ${teamsCard}
        ${miniCard}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Estadísticas (rankings scrapeados de AS.com, caché en as_rankings_cache)
// ---------------------------------------------------------------------------
function formatStatsCountryCell(value) {
  const label = statsCountryLabel(value);
  const flag = statsCountryFlag(label);
  return `<span class="stats-country"><span class="stats-flag">${flag}</span><span>${esc(label)}</span></span>`;
}

async function loadStatsRankings() {
  let payload;
  try {
    const { data, error } = await supabase
      .from('as_rankings_cache')
      .select('kind,payload,updated_at');
    if (error) throw error;
    const byKind = Object.fromEntries((data || []).map(row => [row.kind, row]));
    payload = {
      players: byKind.players?.payload || null,
      teams: byKind.teams?.payload || null
    };
  } catch (err) {
    console.warn('No se pudo leer as_rankings_cache:', err);
    payload = { players: null, teams: null };
  }

  if (payload.players) { state.playerRankings = payload.players; state.statsErrors.players = false; }
  else { state.statsErrors.players = true; }
  if (payload.teams) { state.teamRankings = payload.teams; state.statsErrors.teams = false; }
  else { state.statsErrors.teams = true; }
}

function renderStatistics() {
  const mode = state.statsMode;
  const config = STATS_CONFIG[mode];
  const dataset = mode === 'teams' ? state.teamRankings : state.playerRankings;
  const rankings = dataset?.rankings || [];

  const modeTabs = ['players', 'teams'].map(m =>
    `<button class="stats-mode-tab${m === mode ? ' active' : ''}" data-action="stats-mode" data-mode="${m}">
      ${m === 'players' ? 'Jugadores' : 'Equipos'}
    </button>`
  ).join('');

  if (!dataset) {
    $app.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <div><h2>Estadísticas</h2><p class="hint">${esc(config.loadingText)}</p></div>
          <div class="filters">
            <div class="stats-mode-tabs">${modeTabs}</div>
          </div>
        </div>
        <p class="empty-state">${esc(state.statsErrors[mode] ? config.errorText : config.loadingText)}</p>
      </div>`;
    return;
  }

  const savedSlug = state.statsSelections[mode];
  const selected = rankings.find(r => r.slug === savedSlug) || rankings[0];
  if (selected && !state.statsSelections[mode]) state.statsSelections[mode] = selected.slug;

  const q = normalize(state.statsSearch[mode] || '');
  const rows = (selected?.rows || []).filter(row =>
    !q || normalize([row.position, ...(row.raw || [])].join(' ')).includes(q)
  );
  const visibleRows = state.statsExpanded[mode] ? rows : rows.slice(0, 10);
  const hasMore = rows.length > visibleRows.length;
  const updatedAt = dataset.scrapedAt
    ? new Date(dataset.scrapedAt).toLocaleString('es-ES')
    : 'sin fecha';

  const rankingOptions = rankings.map(r =>
    `<option value="${esc(r.slug)}"${r.slug === selected?.slug ? ' selected' : ''}>${esc(r.label)}</option>`
  ).join('');

  const tableBody = visibleRows.length
    ? `<thead><tr>${(selected?.headers || []).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
       <tbody>${visibleRows.map(row =>
         `<tr>${(selected.headers || []).map((_, i) => {
           const cell = row.raw?.[i] ?? '';
           const display = mode === 'players' && i === 2
             ? formatStatsCountryCell(cell)
             : mode === 'teams' && i === 1
               ? formatStatsCountryCell(cell)
               : esc(cell);
           return `<td>${display}</td>`;
         }).join('')}</tr>`
       ).join('')}</tbody>`
    : `<tbody><tr><td class="empty-state">No hay ${config.label.toLowerCase()} que coincidan con la búsqueda.</td></tr></tbody>`;

  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Estadísticas</h2>
          <p class="hint">
            ${esc(config.label)}: ${rankings.length} rankings · ${selected?.rows?.length ?? 0} registros · Actualizado: ${esc(updatedAt)}
            ${selected?.url ? `· <a href="${esc(selected.url)}" target="_blank" rel="noopener">ver fuente</a>` : ''}
          </p>
        </div>
        <div class="filters">
          <div class="stats-mode-tabs">${modeTabs}</div>
          <select data-action="stats-ranking">${rankingOptions}</select>
          <input type="text" placeholder="${esc(config.searchPlaceholder)}" value="${esc(state.statsSearch[mode] || '')}" data-action="stats-search" />
        </div>
      </div>
      <div class="table-wrap stats-table-wrap"><table>${tableBody}</table></div>
      <div class="stats-footer">
        <span class="hint">${rows.length ? `Mostrando ${visibleRows.length} de ${rows.length} filas${q ? ' filtradas' : ''}.` : 'No hay filas para mostrar.'}</span>
        <div class="stats-footer-actions">
          ${hasMore || state.statsExpanded[mode]
            ? `<button data-action="stats-toggle">${state.statsExpanded[mode] ? 'Ver menos' : 'Ver todo'}</button>`
            : ''}
        </div>
      </div>
    </div>`;
}


document.addEventListener('click', async (e) => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) { state.tab = tabBtn.dataset.tab; render(); return; }

  const goalsBtn = e.target.closest('[data-toggle-goals]');
  if (goalsBtn) {
    const id = goalsBtn.dataset.toggleGoals;
    state.matchGoalsExpanded[id] = !state.matchGoalsExpanded[id];
    render();
    return;
  }

  const matchCard = e.target.closest('[data-match-id]');
  if (matchCard) { openMatchPredictions(matchCard.dataset.matchId); return; }

  const teamBtn = e.target.closest('[data-team-select]');
  if (teamBtn) { state.selectedTeamId = teamBtn.dataset.teamSelect; render(); return; }

  const compareRemove = e.target.closest('[data-compare-remove]');
  if (compareRemove) {
    state.comparePlayers = state.comparePlayers.filter(pid => pid !== compareRemove.dataset.compareRemove);
    renderCompare();
    return;
  }

  const sortBtn = e.target.closest('[data-sort-key]');
  if (sortBtn) {
    const key = sortBtn.dataset.sortKey;
    const s = state.rankingSort;
    // posición/total/etc. numéricos: por defecto desc; #/nombre asc. Toggle al repetir.
    if (s.key === key) s.direction = s.direction === 'asc' ? 'desc' : 'asc';
    else { s.key = key; s.direction = (key === 'position' || key === 'name') ? 'asc' : 'desc'; }
    render();
    return;
  }

  const saveMatchBtn = e.target.closest('[data-save-match]');
  if (saveMatchBtn) { await saveMatchPrediction(saveMatchBtn.dataset.saveMatch); return; }

  const clearMatchBtn = e.target.closest('[data-clear-match]');
  if (clearMatchBtn) { await clearMatchPrediction(clearMatchBtn.dataset.clearMatch); return; }

  const clearMiniBtn = e.target.closest('[data-clear-mini-answer]');
  if (clearMiniBtn) {
    await clearMiniAnswer(clearMiniBtn.dataset.clearMiniAnswer);
    return;
  }

  const saveKnockoutBtn = e.target.closest('[data-save-knockout]');
  if (saveKnockoutBtn) {
    const [stageKey, slot] = String(saveKnockoutBtn.dataset.saveKnockout || '').split(':');
    await saveKnockoutPick(stageKey, slot);
    return;
  }

  const clearKnockoutBtn = e.target.closest('[data-clear-knockout]');
  if (clearKnockoutBtn) {
    const [stageKey, slot] = String(clearKnockoutBtn.dataset.clearKnockout || '').split(':');
    await clearKnockoutPick(stageKey, slot);
    return;
  }

  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  if (action === 'show-login') { renderLoginForm(); return; }
  if (action === 'prob-toggle-players') { state.probabilitiesExpanded.players = !state.probabilitiesExpanded.players; renderProbabilities(); return; }
  if (action === 'prob-toggle-teams') { state.probabilitiesExpanded.teams = !state.probabilitiesExpanded.teams; renderProbabilities(); return; }
  if (action === 'prob-toggle-mini') { state.probabilitiesExpanded.mini = !state.probabilitiesExpanded.mini; renderProbabilities(); return; }
  if (action === 'stats-mode') {
    state.statsMode = e.target.closest('[data-action]').dataset.mode;
    state.statsExpanded[state.statsMode] = false;
    renderStatistics();
    return;
  }
  if (action === 'stats-toggle') {
    state.statsExpanded[state.statsMode] = !state.statsExpanded[state.statsMode];
    renderStatistics();
    return;
  }
  if (action === 'logout') {
    await supabase.auth.signOut();
    await refreshSession();
    state.tab = 'ranking';
    state.myDraft = {};
    state.myMiniDraft = {};
    render();
    return;
  }
  if (action === 'save-mine') { await saveMine(); return; }
});

// Accesibilidad: las tarjetas de partido del resumen son `role="button"`,
// así que Enter/Espacio sobre una enfocada abre el modal de pronósticos.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const matchCard = e.target.closest('[data-match-id]');
  if (matchCard) { e.preventDefault(); openMatchPredictions(matchCard.dataset.matchId); }
});

document.addEventListener('input', (e) => {
  const input = e.target.closest('.score-input');
  if (input) { state.myDraft[input.dataset.match] = input.value.trim(); return; }

  const miniInput = e.target.closest('.mini-answer-input');
  if (miniInput) {
    const questionId = miniInput.closest('[data-mini-answer-form]')?.dataset.questionId;
    if (questionId) state.myMiniDraft[questionId] = miniInput.value.trim();
    return;
  }

  const teamsSearch = e.target.closest('[data-action="teams-search"]');
  if (teamsSearch) {
    state.teamsQuery = teamsSearch.value;
    const caret = teamsSearch.selectionStart;
    render();
    const again = document.querySelector('[data-action="teams-search"]');
    if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch {} }
    return;
  }

  const rankSearch = e.target.closest('[data-action="ranking-search"]');
  if (rankSearch) {
    state.rankingQuery = rankSearch.value;
    const caret = rankSearch.selectionStart;
    render();
    const again = document.querySelector('[data-action="ranking-search"]');
    if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch {} }
    return;
  }

  const miniSearch = e.target.closest('[data-action="mini-search"]');
  if (miniSearch) {
    state.miniQuery = miniSearch.value;
    const caret = miniSearch.selectionStart;
    render();
    const again = document.querySelector('[data-action="mini-search"]');
    if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch {} }
  }

  const statsSearch = e.target.closest('[data-action="stats-search"]');
  if (statsSearch) {
    state.statsSearch[state.statsMode] = statsSearch.value;
    state.statsExpanded[state.statsMode] = false;
    const caret = statsSearch.selectionStart;
    renderStatistics();
    const again = document.querySelector('[data-action="stats-search"]');
    if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch {} }
  }
});

document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-action="select-player"]');
  if (sel) { state.playerDetailId = sel.value; render(); }

  const knockoutSel = e.target.closest('[data-action="select-knockout-player"]');
  if (knockoutSel) {
    state.knockoutPlayerId = knockoutSel.value;
    render();
  }

  const historySel = e.target.closest('[data-action="history-checkpoint"]');
  if (historySel) { state.historyCheckpointId = historySel.value; renderHistory(); }

  const statsRanking = e.target.closest('[data-action="stats-ranking"]');
  if (statsRanking) {
    state.statsSelections[state.statsMode] = statsRanking.value;
    state.statsExpanded[state.statsMode] = false;
    renderStatistics();
  }

  const compareMatch = e.target.closest('[data-action="compare-match"]');
  if (compareMatch) { state.compareMatchId = compareMatch.value; renderCompare(); }

  const compareAdd = e.target.closest('[data-action="compare-add-player"]');
  if (compareAdd && compareAdd.value) {
    if (!state.comparePlayers.includes(compareAdd.value)) state.comparePlayers.push(compareAdd.value);
    renderCompare();
  }
});

document.addEventListener('input', (e) => {
  const slider = e.target.closest('[data-action="history-slider"]');
  if (slider) {
    const snapshots = buildHistoricalSnapshots();
    const snap = snapshots[Number(slider.value) - 1];
    if (snap) { state.historyCheckpointId = snap.id; renderHistory(); }
  }
}, true);

document.addEventListener('submit', async (e) => {
  if (e.target.matches('[data-mini-answer-form]')) {
    e.preventDefault();
    await saveMiniAnswer(e.target.dataset.questionId);
    return;
  }
  if (e.target.id !== 'login-form') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.auth.signInWithPassword({
    email: fd.get('email'), password: fd.get('password')
  });
  const errEl = document.getElementById('login-error');
  if (error) { if (errEl) errEl.textContent = error.message; return; }
  await refreshSession();
  state.tab = state.myPlayerId ? 'mine' : 'ranking';
  render();
});

async function saveMine() {
  const status = document.getElementById('save-status');
  if (status) status.textContent = 'Guardando…';
  const rows = Object.entries(state.myDraft)
    .filter(([, score]) => score !== undefined)
    .map(([match_id, score]) => ({
      porra_id: state.porra.id,
      player_id: state.myPlayerId,
      match_id,
      score
    }));
  if (!rows.length) {
    if (status) status.textContent = 'Nada que guardar.';
    showAppToast('Nada que guardar.');
    return;
  }

  const { error } = await supabase
    .from('porra_predictions')
    .upsert(rows, { onConflict: 'porra_id,player_id,match_id' });

  if (error) {
    if (status) status.textContent = 'Error: ' + error.message;
    showAppToast(`No se pudo guardar: ${error.message}`, 3600);
    return;
  }

  // Refrescar predicciones en memoria
  await refreshPredictionsFromState();
  state.myDraft = {};
  render();
  const nextStatus = document.getElementById('save-status');
  if (nextStatus) nextStatus.textContent = 'Guardado ✓';
  showAppToast('Guardado ✓');
}

async function saveMatchPrediction(matchId) {
  const status = matchRowStatus(matchId);
  const score = draftScoreForMatch(matchId);
  if (status) status.textContent = 'Guardando…';
  if (!score) {
    if (status) status.textContent = 'Introduce un marcador.';
    showAppToast('Introduce un marcador.');
    return;
  }

  try {
    await savePredictionRow(matchId, score);
    const rowStatus = matchRowStatus(matchId);
    if (rowStatus) rowStatus.textContent = 'Guardado ✓';
    showAppToast('Marcador guardado.');
  } catch (error) {
    if (status) status.textContent = 'Error: ' + error.message;
    showAppToast(`No se pudo guardar: ${error.message}`, 3600);
  }
}

async function clearMatchPrediction(matchId) {
  const status = matchRowStatus(matchId);
  if (status) status.textContent = 'Borrando…';

  try {
    await deletePredictionRow(matchId);
    const rowStatus = matchRowStatus(matchId);
    if (rowStatus) rowStatus.textContent = 'Borrado.';
    showAppToast('Marcador borrado.');
  } catch (error) {
    if (status) status.textContent = 'Error: ' + error.message;
    showAppToast(`No se pudo borrar: ${error.message}`, 3600);
  }
}

// ---------------------------------------------------------------------------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
(async function init() {
  await loadPorra();
  render();
  // Load stats rankings in background (no-await, re-renders when done)
  loadStatsRankings().then(() => { if (state.tab === 'statistics') renderStatistics(); });
})();
