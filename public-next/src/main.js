import { createClient } from '@supabase/supabase-js';
import {
  scorePrediction, historyPositionChange,
  calculateBestCurrentStreak, pickNextPendingMatch
} from '../../src/lib/porra-core.js';
import { parseScore } from '../../src/lib/statistics-utils.js';
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
  rankingSort: { key: 'position', direction: 'asc' } // orden de la tabla
};

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
    supabase.from('porra_predictions').select('*').eq('porra_id', id),
    supabase.from('porra_knockout_picks').select('*').eq('porra_id', id),
    supabase.from('porra_mini_questions').select('*').eq('porra_id', id).order('position'),
    supabase.from('porra_mini_answers').select('*').eq('porra_id', id),
    supabase.from('porra_mini_results').select('*').eq('porra_id', id)
  ]);
  state.teams = teams.data || [];
  state.groups = groups.data || [];
  state.matches = matches.data || [];
  state.players = players.data || [];
  state.predictions = predictions.data || [];
  state.knockoutPicks = knockoutPicks.data || [];
  state.miniQuestions = miniQuestions.data || [];
  state.miniAnswers = miniAnswers.data || [];
  state.miniResults = miniResults.data || [];

  await refreshSession();
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

function knockoutSeedLabel(token) {
  const raw = String(token || '').trim();
  const winnerMatch = raw.match(/^W:(.+)$/i);
  if (winnerMatch) return `Ganador ${winnerMatch[1].toUpperCase()}`;
  const groupSeed = raw.match(/^([A-Z]+)([12])$/);
  if (groupSeed) return `${groupSeed[1]}${groupSeed[2]}`;
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
    ? state.groups.map(group => String(group.group_id ?? group.name ?? '').trim().toUpperCase())
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

  const groupSeed = raw.match(/^([A-Z]+)([12])$/);
  if (groupSeed) {
    const standings = context.standingsByGroup?.get(groupSeed[1]) || [];
    return standings[Number(groupSeed[2]) - 1]?.team || raw;
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
    ? state.groups.map(group => group.group_id ?? group.name).filter(Boolean)
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

  const groupSeed = raw.match(/^([A-Z]+)([12])$/);
  if (groupSeed) {
    const standings = standingsByGroup.get(groupSeed[1]) || [];
    return standings[Number(groupSeed[2]) - 1]?.team || raw;
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

function resolveKnockoutSeed(token, seen = new Set()) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  if (seen.has(raw)) return raw;
  seen.add(raw);

  const directTeam = teamByToken(raw);
  if (directTeam) return directTeam.team_id;

  const groupSeed = raw.match(/^([A-Z]+)([12])$/);
  if (groupSeed) {
    const standings = computeGroupStandingsByMatches(groupSeed[1]);
    return standings[Number(groupSeed[2]) - 1]?.team || raw;
  }

  const winnerSeed = raw.match(/^W:(.+)$/i);
  if (winnerSeed) {
    const matchId = winnerSeed[1].toUpperCase();
    const match = state.matches.find(item => String(item.match_id || '').toUpperCase() === matchId);
    const result = matchResult(match);
    if (!match || !result || result.home === result.away) return raw;
    const winnerToken = result.home > result.away ? (match.team1_id ?? match.team1) : (match.team2_id ?? match.team2);
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

function buildPlayerKnockoutBracket(playerId) {
  const roundStages = knockoutRoundStages();
  if (!roundStages.length) return {};

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

  let previousStageKey = firstStage.key;
  for (const stage of roundStages.slice(1)) {
    const selectedTeams = knockoutStagePicks(playerId, stage.key, stage.teams);
    const matchCount = Math.floor((bracket[previousStageKey] || []).length / 2);
    bracket[stage.key] = [];
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const feeders = feedersForKnockoutMatch(stage.key, matchIndex, bracket, previousStageKey);
      const allowed = uniqueTeamList(feeders.filter(Boolean));
      const saved = selectedTeams[matchIndex] || '';
      const winner = allowed.some(team => knockoutTeamKey(team) === knockoutTeamKey(saved)) ? saved : '';
      bracket[stage.key].push(winner);
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
  const result = matchResult(match);
  if (!result) return '';
  if (result.home > result.away) return String(match.team1 || '').trim();
  if (result.away > result.home) return String(match.team2 || '').trim();
  return '';
}

function buildKnockoutReality() {
  const roundStages = knockoutRoundStages();
  const reality = {};

  for (const stage of roundStages) {
    const matches = knockoutMatches().filter(match => normalizeKnockoutStageKey(match.round_key) === stage.key);
    const teams = new Set();
    for (const match of matches) {
      if (match.team1) teams.add(knockoutTeamKey(match.team1));
      if (match.team2) teams.add(knockoutTeamKey(match.team2));
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
    const predictions = knockoutStagePicks(playerId, stage.key, stage.key === 'champion' ? 1 : stage.teams).filter(Boolean);
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
  return supabase.from('porra_predictions')
    .select('*').eq('porra_id', state.porra.id)
    .then(({ data }) => {
      state.predictions = data || [];
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
  const { data } = await supabase.from('porra_knockout_picks')
    .select('*').eq('porra_id', state.porra.id);
  state.knockoutPicks = data || [];
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
    case 'matches': renderMatches(); break;
    case 'mine': renderMyPorra(); break;
    case 'groupStandings': renderGroupStandings(); break;
    case 'teams': renderTeams(); break;
    case 'player': renderPlayerDetail(); break;
    case 'mini': renderMini(); break;
    case 'knockout': renderKnockout(); break;
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
  { key: 'history', label: 'Histórico', ready: false },
  { key: 'mini', label: 'Mini-porra', ready: true },
  { key: 'matches', label: 'Partidos', ready: true },
  { key: 'knockout', label: 'Cruces', ready: true },
  { key: 'groupStandings', label: 'Clasificación grupos', ready: true },
  { key: 'player', label: 'Detalle jugador', ready: true },
  { key: 'teams', label: 'Equipos', ready: true },
  { key: 'bestThirds', label: 'Mejores terceros', ready: false },
  { key: 'topScorers', label: 'Máximos goleadores', ready: false },
  { key: 'probabilities', label: 'Probabilidades', ready: false },
  { key: 'statistics', label: 'Estadísticas', ready: false },
  { key: 'compare', label: 'Comparador', ready: false }
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

  // último partido
  if (lastPlayed) {
    const r = matchResult(lastPlayed);
    cards.push(`
      <article class="card next-match-card last-match-card">
        <b>${teamFlag(lastPlayed.team1)} ${esc(teamName(lastPlayed.team1))}<span class="next-match-separator">-</span>${teamFlag(lastPlayed.team2)} ${esc(teamName(lastPlayed.team2))}</b>
        <strong class="last-match-score">${r.home} - ${r.away}</strong>
        <span>último partido</span>
        ${summaryGoalChips(lastPlayed)}
      </article>`);
  }

  // siguiente partido
  if (nextMatch) {
    cards.push(`
      <article class="card next-match-card">
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

function renderRanking() {
  const MEDALS = ['🥇', '🥈', '🥉'];
  const features = state.porra.features || {};
  const showKnockout = features.knockout !== false && !state.porra?.scoring?.nationsLeague?.templateId; // Nations League no usa un cuadro único
  const ranking = computeRanking();
  const total = ranking.length;
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
            const mov = historyPositionChange(r, null); // sin histórico aún → "Se mantiene"
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
    const rows = computeGroupStandings(grp.group_id);
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
      <p class="hint">Total acumulado: <span class="points">${total}</span> puntos.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Grupo</th><th>Partido</th><th>Pronóstico</th><th>Resultado</th><th class="table-center">Puntos</th></tr></thead>
          <tbody>
            ${rows.map(({ m, pred, result, s }) => `<tr>
              <td>${esc(m.group_id || '')}</td>
              <td>${teamFlag(m.team1)} ${esc(teamName(m.team1))} – ${esc(teamName(m.team2))} ${teamFlag(m.team2)}</td>
              <td>${pred?.score ? esc(pred.score) : '<span class="muted">—</span>'}</td>
              <td>${result ? `${result.home} - ${result.away}` : '<span class="muted">pdte</span>'}</td>
              <td class="table-center ${s && s.points ? 'points' : 'muted'}">${s ? (s.exact ? `${s.points} ✔` : (s.sign ? `${s.points} ~` : '0')) : '—'}</td>
            </tr>`).join('') || `<tr><td colspan="5" class="empty-state">Sin partidos.</td></tr>`}
          </tbody>
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
  const { data } = await supabase.from('porra_mini_answers')
    .select('*').eq('porra_id', state.porra.id);
  state.miniAnswers = data || [];
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
            <button type="submit" class="primary" ${canEditMini ? '' : 'disabled'}>Guardar</button>
            <button type="button" data-clear-mini-answer="${esc(question.question_id)}" ${canEditMini ? '' : 'disabled'}>Limpiar</button>
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
      <div class="knockout-edit-actions">
        <button type="button" class="primary" data-save-knockout="${esc(`${stageKey}:${slot}`)}"${disabled}>Guardar</button>
        <button type="button" data-clear-knockout="${esc(`${stageKey}:${slot}`)}"${disabled}>Limpiar</button>
      </div>
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
          <tbody>
            ${groupMatches.map(m => {
              const saved = predictionFor(state.myPlayerId, m.match_id);
              const val = state.myDraft[m.match_id] ?? (saved ? saved.score : '');
              return `<tr>
                <td>${esc(m.group_id || '')}</td>
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
            }).join('')}
          </tbody>
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
// Acciones
// ---------------------------------------------------------------------------
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

  const teamBtn = e.target.closest('[data-team-select]');
  if (teamBtn) { state.selectedTeamId = teamBtn.dataset.teamSelect; render(); return; }

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
});

document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-action="select-player"]');
  if (sel) { state.playerDetailId = sel.value; render(); }

  const knockoutSel = e.target.closest('[data-action="select-knockout-player"]');
  if (knockoutSel) {
    state.knockoutPlayerId = knockoutSel.value;
    render();
  }
});

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
})();
