import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tsbjhbpdvewqysgmrhci.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const EVENT_TYPES = [
  { value: 'worldcup', label: 'Mundial' },
  { value: 'euro', label: 'Eurocopa' },
  { value: 'nations', label: 'Nations League' },
  { value: 'custom', label: 'Otro' }
];

const FEATURES = [
  { key: 'groups', label: 'Fase de grupos' },
  { key: 'knockout', label: 'Cruces' },
  { key: 'mini', label: 'Mini-porra' },
  { key: 'bestThirds', label: 'Mejores terceros' },
  { key: 'topScorers', label: 'Máximos goleadores' }
];

const KNOCKOUT_ROUNDS = [
  { key: 'r32', label: 'Dieciseisavos' },
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semifinales' },
  { key: 'final', label: 'Final' }
];

const DEFAULT_KNOCKOUT_SCORING = {
  r32: 3,
  r16: 5,
  qf: 7,
  sf: 10,
  final: 12,
  champion: 15
};

const KNOCKOUT_TEMPLATES = {
  euro_8: {
    id: 'euro_8',
    label: 'Eurocopa 1980-1992 (8 equipos)',
    years: [1980, 1984, 1988, 1992],
    teams: 8,
    groups: ['A', 'B'],
    teamsPerGroup: 4,
    qualifiedPerGroup: 2,
    thirdPlaceQualifiers: 0,
    knockout: [
      { id: 'F', round: 'final', home: 'A1', away: 'B1' }
    ]
  },
  euro_16: {
    id: 'euro_16',
    label: 'Eurocopa 1996-2012 (16 equipos)',
    years: [1996, 2000, 2004, 2008, 2012],
    teams: 16,
    groups: ['A', 'B', 'C', 'D'],
    teamsPerGroup: 4,
    qualifiedPerGroup: 2,
    thirdPlaceQualifiers: 0,
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
    years: [2016, 2020, 2024, 2028],
    teams: 24,
    groups: ['A', 'B', 'C', 'D', 'E', 'F'],
    teamsPerGroup: 4,
    qualifiedPerGroup: 2,
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
    years: [1998, 2002, 2006, 2010, 2014, 2018, 2022],
    teams: 32,
    groups: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    teamsPerGroup: 4,
    qualifiedPerGroup: 2,
    thirdPlaceQualifiers: 0,
    knockout: [
      { id: 'R16-1', round: 'r16', home: 'A1', away: 'B2' },
      { id: 'R16-2', round: 'r16', home: 'C1', away: 'D2' },
      { id: 'R16-3', round: 'r16', home: 'E1', away: 'F2' },
      { id: 'R16-4', round: 'r16', home: 'G1', away: 'H2' },
      { id: 'R16-5', round: 'r16', home: 'B1', away: 'A2' },
      { id: 'R16-6', round: 'r16', home: 'D1', away: 'C2' },
      { id: 'R16-7', round: 'r16', home: 'F1', away: 'E2' },
      { id: 'R16-8', round: 'r16', home: 'H1', away: 'G2' },
      { id: 'QF-1', round: 'qf', home: 'W:R16-1', away: 'W:R16-2' },
      { id: 'QF-2', round: 'qf', home: 'W:R16-3', away: 'W:R16-4' },
      { id: 'QF-3', round: 'qf', home: 'W:R16-5', away: 'W:R16-6' },
      { id: 'QF-4', round: 'qf', home: 'W:R16-7', away: 'W:R16-8' },
      { id: 'SF-1', round: 'sf', home: 'W:QF-1', away: 'W:QF-2' },
      { id: 'SF-2', round: 'sf', home: 'W:QF-3', away: 'W:QF-4' },
      { id: 'F', round: 'final', home: 'W:SF-1', away: 'W:SF-2' }
    ]
  },
  worldcup_48: {
    id: 'worldcup_48',
    label: 'Mundial 2026 (48 equipos)',
    years: [2026],
    teams: 48,
    groups: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
    teamsPerGroup: 4,
    qualifiedPerGroup: 2,
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
      { id: 'QF-1', round: 'qf', home: 'W:R16-1', away: 'W:R16-2' },
      { id: 'QF-2', round: 'qf', home: 'W:R16-3', away: 'W:R16-4' },
      { id: 'QF-3', round: 'qf', home: 'W:R16-5', away: 'W:R16-6' },
      { id: 'QF-4', round: 'qf', home: 'W:R16-7', away: 'W:R16-8' },
      { id: 'SF-1', round: 'sf', home: 'W:QF-1', away: 'W:QF-2' },
      { id: 'SF-2', round: 'sf', home: 'W:QF-3', away: 'W:QF-4' },
      { id: 'F', round: 'final', home: 'W:SF-1', away: 'W:SF-2' }
    ]
  }
};

const NATIONS_LEAGUE_TEMPLATES = {
  nations_2026_27: {
    id: 'nations_2026_27',
    label: 'Nations League 2026-27',
    years: ['2026-27'],
    teams: 54,
    leagues: {
      A: {
        groups: ['A1', 'A2', 'A3', 'A4'],
        teamsPerGroup: 4,
        matchesPerTeam: 6,
        qualification: {
          quarterFinals: ['1st', '2nd'],
          relegationPlayoff: ['3rd'],
          relegated: ['4th']
        }
      },
      B: {
        groups: ['B1', 'B2', 'B3', 'B4'],
        teamsPerGroup: 4,
        matchesPerTeam: 6,
        qualification: {
          promoted: ['1st'],
          promotionPlayoff: ['2nd'],
          relegationPlayoff: ['3rd'],
          relegated: ['4th']
        }
      },
      C: {
        groups: ['C1', 'C2', 'C3', 'C4'],
        teamsPerGroup: 4,
        matchesPerTeam: 6,
        qualification: {
          promoted: ['1st'],
          promotionPlayoff: ['2nd'],
          relegationPlayoff: ['two_best_4th'],
          relegated: ['two_worst_4th']
        }
      },
      D: {
        groups: ['D1', 'D2'],
        teamsPerGroup: 3,
        matchesPerTeam: 4,
        qualification: {
          promoted: ['1st'],
          promotionPlayoff: ['2nd']
        }
      }
    },
    leagueAFinals: {
      quarterFinals: [
        { id: 'QF1', home: 'A_GROUP_WINNER', away: 'A_RUNNER_UP' },
        { id: 'QF2', home: 'A_GROUP_WINNER', away: 'A_RUNNER_UP' },
        { id: 'QF3', home: 'A_GROUP_WINNER', away: 'A_RUNNER_UP' },
        { id: 'QF4', home: 'A_GROUP_WINNER', away: 'A_RUNNER_UP' }
      ],
      finalFour: [
        { id: 'SF1', home: 'W:QF1', away: 'W:QF2' },
        { id: 'SF2', home: 'W:QF3', away: 'W:QF4' },
        { id: 'THIRD_PLACE', home: 'L:SF1', away: 'L:SF2' },
        { id: 'FINAL', home: 'W:SF1', away: 'W:SF2' }
      ]
    },
    promotionRelegationPlayoffs: {
      A_B: { matches: [{ home: 'A_3rd', away: 'B_2nd' }] },
      B_C: { matches: [{ home: 'B_3rd', away: 'C_2nd' }] },
      C_D: { matches: [{ home: 'C_best_4th', away: 'D_2nd' }] }
    }
  }
};

const MINI_FIELD_TYPES = [
  { value: 'text', label: 'Texto libre' },
  { value: 'number', label: 'Número' },
  { value: 'team', label: 'Equipo' },
  { value: 'player', label: 'Jugador' },
  { value: 'goals-range', label: 'Goles' }
];

const MINI_FIELD_TYPE_LABELS = Object.fromEntries(MINI_FIELD_TYPES.map(item => [item.value, item.label]));

const PORRA_STATUS_FLOW = ['draft', 'open', 'playing', 'closed'];
const PORRA_STATUS_LABELS = {
  draft: 'Borrador',
  open: 'Abierta',
  playing: 'En juego',
  closed: 'Cerrada'
};

const TEAM_FLAGS = {
  'A. SAUDÍ': '🇸🇦',
  'ALEMANIA': '🇩🇪',
  'ARGELIA': '🇩🇿',
  'ARGENTINA': '🇦🇷',
  'AUSTRALIA': '🇦🇺',
  'AUSTRIA': '🇦🇹',
  'BOSNIA': '🇧🇦',
  'BRASIL': '🇧🇷',
  'BÉLGICA': '🇧🇪',
  'C. MARFIL': '🇨🇮',
  'CABO VERDE': '🇨🇻',
  'CANADÁ': '🇨🇦',
  'CATAR': '🇶🇦',
  'CHEQUIA': '🇨🇿',
  'COLOMBIA': '🇨🇴',
  'COREA': '🇰🇷',
  'CROACIA': '🇭🇷',
  'CURAZAO': '🇨🇼',
  'ECUADOR': '🇪🇨',
  'EE.UU.': '🇺🇸',
  'EGIPTO': '🇪🇬',
  'ESCOCIA': '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  'ESPAÑA': '🇪🇸',
  'FRANCIA': '🇫🇷',
  'GHANA': '🇬🇭',
  'HAITÍ': '🇭🇹',
  'INGLATERRA': '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  'IRAK': '🇮🇶',
  'IRÁN': '🇮🇷',
  'JAPÓN': '🇯🇵',
  'JORDANIA': '🇯🇴',
  'MARRUECOS': '🇲🇦',
  'MÉXICO': '🇲🇽',
  'N. ZELANDA': '🇳🇿',
  'NORUEGA': '🇳🇴',
  'PANAMÁ': '🇵🇦',
  'PARAGUAY': '🇵🇾',
  'PAÍSES BAJOS': '🇳🇱',
  'PORTUGAL': '🇵🇹',
  'RD CONGO': '🇨🇩',
  'SENEGAL': '🇸🇳',
  'SUDÁFRICA': '🇿🇦',
  'SUECIA': '🇸🇪',
  'SUIZA': '🇨🇭',
  'TURQUÍA': '🇹🇷',
  'TÚNEZ': '🇹🇳',
  'URUGUAY': '🇺🇾',
  'UZBEKISTÁN': '🇺🇿'
};

const TEAM_CATALOG = Object.entries(TEAM_FLAGS)
  .map(([name, flag]) => ({ name, flag }))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

const state = {
  user: null,
  isAdmin: false,
  loading: true,
  porras: [],
  // detail view
  currentPorra: null,   // porra row
  teams: [],
  groups: [],
  matches: [],
  players: [],
  miniQuestions: [],
  editingTeamId: null,
  editingMatchId: null,
  editingMiniQuestionId: null,
  playerMessage: '',
  playerTempPasswords: {},
  draggingMatchId: null,
  draggingTeamId: null,
  groupSetupDraft: null,
  groupSetupCollapsed: false,
  matchSectionCollapsed: false,
  playerSectionCollapsed: false,
  miniSectionCollapsed: false,
  detailError: '',
  error: ''
};

const $app = document.getElementById('app');
const $session = document.getElementById('session');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function makeEntityId(prefix) {
  const random = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${random}`;
}

function normalizePorraStatus(status) {
  return status === 'live' ? 'playing' : (status || 'draft');
}

function porraStatusLabel(status) {
  return PORRA_STATUS_LABELS[normalizePorraStatus(status)] || status;
}

function flagForTeam(team) {
  return TEAM_FLAGS[String(team || '').trim().toUpperCase()] || '';
}

function nextPorraStatus(status) {
  const current = normalizePorraStatus(status);
  const index = PORRA_STATUS_FLOW.indexOf(current);
  return index >= 0 && index < PORRA_STATUS_FLOW.length - 1
    ? PORRA_STATUS_FLOW[index + 1]
    : null;
}

function canRevertPorraToDraft(status) {
  return normalizePorraStatus(status) !== 'draft';
}

function syncCurrentPorraFromList() {
  if (!state.currentPorra) return;
  state.currentPorra = state.porras.find(p => p.id === state.currentPorra.id) || state.currentPorra;
}

function teamGroupName(team) {
  return state.groups.find(group => group.group_id === team.group_id)?.name || '';
}

function miniFieldTypeLabel(fieldType) {
  return MINI_FIELD_TYPE_LABELS[fieldType] || fieldType || '—';
}

function parseMiniOptions(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map(value => value.trim())
    .filter(Boolean);
}

function miniOptionsToText(options) {
  return Array.isArray(options) ? options.join('\n') : String(options || '');
}

function normalizeTeamName(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function matchResult(match) {
  if (!match) return null;
  const home = match.score_home ?? match.result_home;
  const away = match.score_away ?? match.result_away;
  if (home == null || away == null) return null;
  return { home: Number(home), away: Number(away) };
}

function knockoutTemplateOptionsForEvent(eventType) {
  const eventKey = String(eventType || '').trim().toLowerCase();
  if (eventKey === 'worldcup') {
    return [
      { value: 'worldcup_48', label: 'Mundial 2026 (48 equipos)' },
      { value: 'worldcup_32', label: 'Mundial clásico (32 equipos)' }
    ];
  }
  if (eventKey === 'euro') {
    return [
      { value: 'euro_24', label: 'Eurocopa 2016-2028 (24 equipos)' },
      { value: 'euro_16', label: 'Eurocopa 1996-2012 (16 equipos)' },
      { value: 'euro_8', label: 'Eurocopa 1980-1992 (8 equipos)' }
    ];
  }
  return [];
}

function defaultKnockoutTemplateIdForEvent(eventType) {
  const eventKey = String(eventType || '').trim().toLowerCase();
  if (eventKey === 'worldcup') return 'worldcup_48';
  if (eventKey === 'euro') return 'euro_24';
  return '';
}

function nationsLeagueTemplateOptions() {
  return Object.values(NATIONS_LEAGUE_TEMPLATES)
    .map(template => ({ value: template.id, label: template.label }));
}

function nationsLeagueTemplateForEvent(templateId = '') {
  const variantKey = String(templateId || '').trim().toLowerCase();
  return NATIONS_LEAGUE_TEMPLATES[variantKey] || NATIONS_LEAGUE_TEMPLATES.nations_2026_27;
}

function knockoutTemplateForEvent(eventType, templateId = '') {
  const eventKey = String(eventType || '').trim().toLowerCase();
  const variantKey = String(templateId || '').trim().toLowerCase();
  if (eventKey === 'worldcup') {
    return KNOCKOUT_TEMPLATES[variantKey] || KNOCKOUT_TEMPLATES.worldcup_48;
  }
  if (eventKey === 'euro') {
    if (!variantKey || variantKey === 'euro') return KNOCKOUT_TEMPLATES.euro_24;
    return KNOCKOUT_TEMPLATES[variantKey] || KNOCKOUT_TEMPLATES.euro_24;
  }
  return KNOCKOUT_TEMPLATES[variantKey] || KNOCKOUT_TEMPLATES[eventKey] || null;
}

function defaultKnockoutStructure(eventType, templateId = '') {
  const template = knockoutTemplateForEvent(eventType, templateId);
  if (!template) return [];
  const stageCounts = { r32: 0, r16: 0, qf: 0, sf: 0, final: 0 };
  for (const match of template.knockout) {
    const roundKey = knockoutRoundKeyFromFixture(match);
    if (roundKey && stageCounts[roundKey] != null) stageCounts[roundKey] += 1;
  }
  return KNOCKOUT_ROUNDS
    .filter(round => stageCounts[round.key] > 0)
    .map(round => ({
      key: round.key,
      label: round.label,
      teams: stageCounts[round.key] * 2,
      points: DEFAULT_KNOCKOUT_SCORING[round.key] || 0
    }))
    .concat(stageCounts.final > 0
      ? [{
          key: 'champion',
          label: 'Campeón',
          teams: 1,
          points: DEFAULT_KNOCKOUT_SCORING.champion
        }]
          : []);
}

function knockoutRoundKeyFromFixture(fixture) {
  const round = String(fixture?.round || '').trim().toLowerCase();
  if (round) return round;
  const code = String(fixture?.id || '').trim().charAt(0).toUpperCase();
  if (code === 'O' || code === 'R') return 'r16';
  if (code === 'Q') return 'qf';
  if (code === 'S') return 'sf';
  if (code === 'F') return 'final';
  return null;
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
  const key = normalizeTeamName(token);
  return state.teams.find(team =>
    team.team_id === token || normalizeTeamName(team.name) === key
  ) || null;
}

function computeAdminGroupStandings(groupId) {
  const groupMatches = state.matches.filter(match => {
    const phase = match.phase ?? match.stage;
    return phase === 'group' && (match.group_id ?? match.group_label) === groupId;
  });
  const groupTeams = state.teams
    .filter(team => team.group_id === groupId)
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
  const rows = groupTeams.map((team, index) => ({
    team: team.team_id,
    idx: index,
    pts: 0,
    gf: 0,
    gc: 0
  }));
  const byTeam = new Map(rows.map(row => [row.team, row]));

  for (const match of groupMatches) {
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

function resolveKnockoutSeed(token, seen = new Set()) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  if (seen.has(raw)) return raw;
  seen.add(raw);

  const directTeam = teamByToken(raw);
  if (directTeam) return directTeam.team_id;

  const groupSeed = raw.match(/^([A-Z]+)([12])$/);
  if (groupSeed) {
    const standings = computeAdminGroupStandings(groupSeed[1]);
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

function matchTeamLabel(token) {
  const resolved = resolveKnockoutSeed(token);
  const team = teamByToken(resolved);
  if (team) return `${team.flag || flagForTeam(team.name)} ${team.name}`.trim();
  return knockoutSeedLabel(token) || '—';
}

function porraHasTeamName(name, ignoreTeamId = null) {
  const normalized = normalizeTeamName(name);
  if (!normalized) return false;
  return state.teams.some(team => team.team_id !== ignoreTeamId && normalizeTeamName(team.name) === normalized);
}

function renderCatalogTeamOptions(selectedValue = '', { includeCustom = true } = {}) {
  const selected = String(selectedValue || '');
  const options = [
    `<option value="">Selecciona un equipo</option>`,
    ...TEAM_CATALOG.map(team => {
      const selectedAttr = team.name === selected ? ' selected' : '';
      return `<option value="${esc(team.name)}"${selectedAttr}>${esc(team.flag)} ${esc(team.name)}</option>`;
    })
  ];
  if (includeCustom) options.push(`<option value="__custom"${selected === '__custom' ? ' selected' : ''}>Personalizado</option>`);
  return options.join('');
}

function sortedTeams() {
  return [...state.teams].sort((a, b) => {
    const groupA = teamGroupName(a);
    const groupB = teamGroupName(b);
    const aGrouped = Boolean(groupA);
    const bGrouped = Boolean(groupB);
    if (!aGrouped && bGrouped) return 1;
    if (aGrouped && !bGrouped) return -1;
    const byGroup = groupA.localeCompare(groupB, 'es');
    if (byGroup !== 0) return byGroup;
    const positionA = Number(a.position) || 0;
    const positionB = Number(b.position) || 0;
    if (positionA !== positionB) return positionA - positionB;
    return a.name.localeCompare(b.name, 'es');
  });
}

function nextTeamPosition(groupId) {
  return Math.max(
    0,
    ...state.teams
      .filter(team => (team.group_id ?? '') === (groupId ?? ''))
      .map(team => Number(team.position) || 0)
  ) + 1;
}

function defaultGroupName(index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[index] || `G${index + 1}`;
}

function buildGroupSetupDraft(groupCount, teamsPerGroup) {
  const groups = Array.from({ length: groupCount }, (_, groupIndex) => ({
    group_id: defaultGroupName(groupIndex),
    name: defaultGroupName(groupIndex),
    teams: Array.from({ length: teamsPerGroup }, () => ({ catalog: '', name: '', flag: '' }))
  }));
  return {
    groupCount,
    teamsPerGroup,
    groups,
    firstKickoff: '',
    daysBetween: 4
  };
}

function buildGroupSetupDraftFromState() {
  const groups = [...state.groups]
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
    .map(group => {
      const teams = state.teams
        .filter(team => team.group_id === group.group_id)
        .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
        .map(team => {
          const matchedCatalog = TEAM_CATALOG.find(item => normalizeTeamName(item.name) === normalizeTeamName(team.name));
          return {
            catalog: matchedCatalog?.name || '__custom',
            name: matchedCatalog ? '' : team.name,
            flag: team.flag || flagForTeam(team.name)
          };
        });
      return {
        group_id: group.group_id,
        name: group.name,
        teams
      };
    });

  const teamsPerGroup = Math.max(0, ...groups.map(group => group.teams.length));
  return {
    groupCount: groups.length,
    teamsPerGroup,
    groups,
    firstKickoff: '',
    daysBetween: 4
  };
}

function clearGroupSetupDraft() {
  state.groupSetupDraft = null;
}

function canUseGroupSetupDraft() {
  return Boolean(state.groupSetupDraft && state.groupSetupDraft.groups.length);
}

function toggleGroupSetupCollapsed() {
  state.groupSetupCollapsed = !state.groupSetupCollapsed;
  render();
}

function toggleMatchSectionCollapsed() {
  state.matchSectionCollapsed = !state.matchSectionCollapsed;
  render();
}

function togglePlayerSectionCollapsed() {
  state.playerSectionCollapsed = !state.playerSectionCollapsed;
  render();
}

function toggleMiniSectionCollapsed() {
  state.miniSectionCollapsed = !state.miniSectionCollapsed;
  render();
}

function groupMatchKey(groupId, team1Id, team2Id) {
  return [groupId || '', ...[team1Id, team2Id].sort()].join('::');
}

function isGroupMatch(match) {
  return (match.phase ?? match.stage) === 'group';
}

function clearMatchDragState() {
  state.draggingMatchId = null;
  document.querySelectorAll('tr[data-match-id]').forEach(row => {
    row.classList.remove('match-row-dragging', 'match-row-drop-target');
  });
  document.querySelectorAll('tbody[data-match-dropzone="group"]').forEach(zone => {
    zone.classList.remove('match-dropzone-active');
  });
}

function clearTeamDragState() {
  state.draggingTeamId = null;
  document.querySelectorAll('tr[data-team-id]').forEach(row => {
    row.classList.remove('team-row-dragging', 'team-row-drop-target');
  });
}

async function persistMatchOrder(orderedMatches) {
  const results = await Promise.all(orderedMatches.map((match, positionIndex) =>
    supabase.from('porra_matches')
      .update({ position: positionIndex + 1 })
      .eq('porra_id', state.currentPorra.id)
      .eq('match_id', match.match_id)
  ));
  const failed = results.find(result => result.error);
  if (failed) {
    state.detailError = failed.error.message;
    render();
    return false;
  }
  return true;
}

async function persistTeamOrder(orderedTeams) {
  const results = await Promise.all(orderedTeams.map((team, positionIndex) =>
    supabase.from('porra_teams')
      .update({ position: positionIndex + 1 })
      .eq('porra_id', state.currentPorra.id)
      .eq('team_id', team.team_id)
  ));
  const failed = results.find(result => result.error);
  if (failed) {
    state.detailError = failed.error.message;
    render();
    return false;
  }
  return true;
}

async function reorderGroupMatches(draggedMatchId, targetMatchId = null) {
  const draggedMatch = state.matches.find(match => match.match_id === draggedMatchId);
  if (!draggedMatch || !isGroupMatch(draggedMatch)) return;

  const groupMatches = state.matches.filter(isGroupMatch);
  const draggedIndex = groupMatches.findIndex(match => match.match_id === draggedMatchId);
  if (draggedIndex < 0) return;

  const reorderedGroup = [...groupMatches];
  const [dragged] = reorderedGroup.splice(draggedIndex, 1);

  if (targetMatchId) {
    const targetIndex = groupMatches.findIndex(match => match.match_id === targetMatchId);
    if (targetIndex < 0 || targetMatchId === draggedMatchId) return;
    const insertIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;
    reorderedGroup.splice(insertIndex, 0, dragged);
  } else {
    reorderedGroup.push(dragged);
  }

  const rebuilt = [];
  const groupIterator = reorderedGroup[Symbol.iterator]();
  for (const match of state.matches) {
    rebuilt.push(isGroupMatch(match) ? groupIterator.next().value : match);
  }

  if (rebuilt.every((match, index) => match.match_id === state.matches[index].match_id)) return;
  if (!(await persistMatchOrder(rebuilt))) return;

  await loadDetail(state.currentPorra.id);
  render();
}

function findMatchRow(element) {
  return element instanceof Element ? element.closest('tr[data-match-id]') : null;
}

function findGroupDropzone(element) {
  return element instanceof Element ? element.closest('tbody[data-match-dropzone="group"]') : null;
}

function highlightMatchDropTarget(matchId = null) {
  document.querySelectorAll('tr[data-match-id]').forEach(row => {
    row.classList.toggle('match-row-drop-target', Boolean(matchId) && row.dataset.matchId === matchId);
  });
}

async function reorderTeamsInGroup(draggedTeamId, targetTeamId = null) {
  const draggedTeam = state.teams.find(team => team.team_id === draggedTeamId);
  if (!draggedTeam || !draggedTeam.group_id) return;

  const groupTeams = sortedTeams().filter(team => (team.group_id ?? '') === (draggedTeam.group_id ?? ''));
  const draggedIndex = groupTeams.findIndex(team => team.team_id === draggedTeamId);
  if (draggedIndex < 0) return;

  const reorderedGroup = [...groupTeams];
  const [dragged] = reorderedGroup.splice(draggedIndex, 1);

  if (targetTeamId) {
    const targetIndex = groupTeams.findIndex(team => team.team_id === targetTeamId);
    if (targetIndex < 0 || targetTeamId === draggedTeamId) return;
    const insertIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;
    reorderedGroup.splice(insertIndex, 0, dragged);
  } else {
    reorderedGroup.push(dragged);
  }

  if (reorderedGroup.every((team, index) => team.team_id === groupTeams[index].team_id)) return;
  if (!(await persistTeamOrder(reorderedGroup))) return;

  await loadDetail(state.currentPorra.id);
  render();
}

function findTeamRow(element) {
  return element instanceof Element ? element.closest('tr[data-team-id]') : null;
}

function highlightTeamDropTarget(teamId = null) {
  document.querySelectorAll('tr[data-team-id]').forEach(row => {
    row.classList.toggle('team-row-drop-target', Boolean(teamId) && row.dataset.teamId === teamId);
  });
}

function buildRoundRobinRounds(teams) {
  const participants = teams.length % 2 === 0 ? [...teams] : [...teams, null];
  const rounds = [];

  for (let round = 0; round < participants.length - 1; round += 1) {
    const pairs = [];
    for (let i = 0; i < participants.length / 2; i += 1) {
      const team1 = participants[i];
      const team2 = participants[participants.length - 1 - i];
      if (team1 && team2) pairs.push([team1, team2]);
    }
    rounds.push(pairs);
    participants.splice(1, 0, participants.pop());
  }

  return rounds;
}

function buildGroupMatches(firstKickoffRaw, daysBetweenRaw) {
  const existing = new Set(state.matches
    .filter(match => (match.phase ?? match.stage) === 'group')
    .map(match => groupMatchKey(
      match.group_id ?? match.group_label,
      match.team1_id ?? match.team1,
      match.team2_id ?? match.team2
    )));
  const firstKickoff = firstKickoffRaw ? new Date(firstKickoffRaw) : null;
  const daysBetween = Math.max(1, Number(daysBetweenRaw) || 4);
  const basePosition = Math.max(0, ...state.matches.map(match => Number(match.position) || 0));
  const groupedRounds = state.groups.map(group => {
    const groupTeams = state.teams
      .filter(team => team.group_id === group.group_id)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return { group, rounds: buildRoundRobinRounds(groupTeams) };
  });
  const maxRounds = Math.max(0, ...groupedRounds.map(item => item.rounds.length));
  const rows = [];

  for (let roundIndex = 0; roundIndex < maxRounds; roundIndex += 1) {
    let matchIndexInRound = 0;
    for (const { group, rounds } of groupedRounds) {
      for (const [team1, team2] of rounds[roundIndex] || []) {
        const matchKey = groupMatchKey(group.group_id, team1.team_id, team2.team_id);
        if (existing.has(matchKey)) continue;
        const kickoff = firstKickoff
          ? new Date(firstKickoff.getTime()
            + roundIndex * daysBetween * 24 * 60 * 60 * 1000
            + matchIndexInRound * 2 * 60 * 60 * 1000).toISOString()
          : null;
        rows.push({
          porra_id: state.currentPorra.id,
          match_id: makeEntityId('match'),
          stage: 'group',
          group_id: group.group_id,
          round_key: null,
          team1: team1.team_id,
          team2: team2.team_id,
          team1_id: team1.team_id,
          team2_id: team2.team_id,
          phase: 'group',
          group_label: group.name,
          kickoff,
          slot: roundIndex + 1,
          position: basePosition + rows.length + 1,
          status: 'scheduled'
        });
        existing.add(matchKey);
        matchIndexInRound += 1;
      }
    }
  }

  return rows;
}

function buildKnockoutMatches(firstKickoffRaw, daysBetweenRaw) {
  const templateId = state.currentPorra?.scoring?.knockout?.templateId || '';
  const template = knockoutTemplateForEvent(state.currentPorra?.event_type, templateId);
  if (!template) return { rows: [], error: 'Esta porra no tiene una plantilla automática de cruces.' };

  const existingKnockout = state.matches.filter(match => (match.phase ?? match.stage) !== 'group');
  if (existingKnockout.length) {
    return { rows: [], error: 'Ya existen cruces creados. Resetea los cruces antes de volver a generarlos.' };
  }

  const expectedGroups = template.groups.map(normalizeTeamName);
  const actualGroups = [...state.groups]
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
    .map(group => normalizeTeamName(group.name || group.group_id));
  if (expectedGroups.some((groupName, index) => actualGroups[index] !== groupName)) {
    return { rows: [], error: `La plantilla ${state.currentPorra.event_type} espera grupos ${template.groups.join(', ')} en ese orden.` };
  }

  const firstKickoff = firstKickoffRaw ? new Date(firstKickoffRaw) : null;
  const daysBetween = Math.max(1, Number(daysBetweenRaw) || 2);
  const basePosition = Math.max(0, ...state.matches.map(match => Number(match.position) || 0));
  const rows = [];
  const roundOrder = KNOCKOUT_ROUNDS
    .map(round => round.key)
    .filter(roundKey => template.knockout.some(match => knockoutRoundKeyFromFixture(match) === roundKey));
  const roundOffsets = Object.fromEntries(roundOrder.map((roundKey, index) => [roundKey, index]));
  const slotsByRound = { r32: 0, r16: 0, qf: 0, sf: 0, final: 0 };

  for (const match of template.knockout) {
    const roundKey = knockoutRoundKeyFromFixture(match);
    if (!roundKey) continue;
    slotsByRound[roundKey] += 1;
    const kickoff = firstKickoff
      ? new Date(
          firstKickoff.getTime()
          + (roundOffsets[roundKey] || 0) * daysBetween * 24 * 60 * 60 * 1000
          + (slotsByRound[roundKey] - 1) * 2 * 60 * 60 * 1000
        ).toISOString()
      : null;
    const team1Token = match.home;
    const team2Token = match.away;
    rows.push({
      porra_id: state.currentPorra.id,
      match_id: match.id,
      stage: 'knockout',
      group_id: null,
      round_key: roundKey,
      team1: team1Token,
      team2: team2Token,
      team1_id: team1Token,
      team2_id: team2Token,
      phase: roundKey,
      group_label: null,
      kickoff,
      slot: slotsByRound[roundKey],
      position: basePosition + rows.length + 1,
      status: 'scheduled'
    });
  }

  return { rows, error: '' };
}

function knockoutMatchesExist() {
  return state.matches.some(match => (match.phase ?? match.stage) !== 'group');
}

// ── Data loaders ───────────────────────────────────────────────────────────────

async function loadPorras() {
  const { data, error } = await supabase
    .from('porras')
    .select('id, slug, name, event_type, status, created_at, features, scoring, knockout_structure')
    .order('created_at', { ascending: false });
  if (error) { state.error = error.message; state.porras = []; return; }
  state.porras = (data || []).map(p => ({ ...p, status: normalizePorraStatus(p.status) }));
  syncCurrentPorraFromList();
}

async function loadDetail(porraId) {
  state.detailError = '';
  const [teamsRes, groupsRes, matchesRes, playersRes, miniRes] = await Promise.all([
    supabase.from('porra_teams').select('*').eq('porra_id', porraId).order('name'),
    supabase.from('porra_groups').select('*').eq('porra_id', porraId).order('name'),
    supabase.from('porra_matches').select('*').eq('porra_id', porraId).order('position').order('kickoff'),
    supabase.from('porra_players').select('*').eq('porra_id', porraId).order('joined_at'),
    supabase.from('porra_mini_questions').select('*').eq('porra_id', porraId).order('position').order('question')
  ]);
  if (teamsRes.error) state.detailError = teamsRes.error.message;
  if (groupsRes.error) state.detailError = groupsRes.error.message;
  if (matchesRes.error) state.detailError = matchesRes.error.message;
  if (playersRes.error) state.detailError = playersRes.error.message;
  if (miniRes.error) state.detailError = miniRes.error.message;
  state.teams = teamsRes.data || [];
  state.groups = groupsRes.data || [];
  state.matches = matchesRes.data || [];
  state.players = playersRes.data || [];
  state.miniQuestions = miniRes.data || [];
  if (state.groups.length || state.teams.length) {
    state.groupSetupDraft = buildGroupSetupDraftFromState();
  } else {
    state.groupSetupDraft = null;
  }
  if (state.editingTeamId && !state.teams.find(team => team.team_id === state.editingTeamId)) {
    state.editingTeamId = null;
  }
  if (state.editingMatchId && !state.matches.find(match => match.match_id === state.editingMatchId)) {
    state.editingMatchId = null;
  }
  if (state.editingMiniQuestionId && !state.miniQuestions.find(question => question.question_id === state.editingMiniQuestionId)) {
    state.editingMiniQuestionId = null;
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────────

async function refreshAuth() {
  const { data } = await supabase.auth.getSession();
  state.user = data.session?.user || null;
  state.isAdmin = false;
  if (state.user) {
    const { data: isAdmin } = await supabase.rpc('pp_is_admin');
    state.isAdmin = Boolean(isAdmin);
    if (state.isAdmin) await loadPorras();
  }
  state.loading = false;
  render();
}

// ── Render helpers ─────────────────────────────────────────────────────────────

function renderSession() {
  if (state.user) {
    $session.innerHTML = `
      <span>${esc(state.user.email)}${state.isAdmin ? ' · admin' : ''}</span>
      <button type="button" id="logoutBtn">Salir</button>
    `;
  } else {
    $session.innerHTML = '';
  }
}

function renderLogin() {
  return `
    <section class="card">
      <h2>Acceso administrador</h2>
      <form id="loginForm" class="form">
        <input name="email" type="email" placeholder="Email" autocomplete="username" required />
        <input name="password" type="password" placeholder="Contraseña" autocomplete="current-password" required />
        <button type="submit">Entrar</button>
        <span class="error" id="loginError"></span>
      </form>
    </section>`;
}

function renderPorraList() {
  const eventOptions = EVENT_TYPES
    .map(e => `<option value="${e.value}">${esc(e.label)}</option>`).join('');
  const featureChecks = FEATURES
    .map(f => `<label class="check"><input type="checkbox" name="feature" value="${f.key}" checked /> ${esc(f.label)}</label>`).join('');
  const ruleSelect = eventType => knockoutTemplateOptionsForEvent(eventType)
    .map(rule => `<option value="${esc(rule.value)}">${esc(rule.label)}</option>`).join('');
  const nationsRuleSelect = nationsLeagueTemplateOptions()
    .map(rule => `<option value="${esc(rule.value)}">${esc(rule.label)}</option>`).join('');
  const porrasList = state.porras.length
    ? state.porras.map(p => `
        <li class="porra-row">
          <div>
            <strong>${esc(p.name)}</strong>
            <span class="muted"> · ${esc(p.event_type)} · ${esc(porraStatusLabel(p.status))}</span>
          </div>
          <div class="porra-actions">
            <button type="button" class="btn-secondary open-porra" data-id="${esc(p.id)}">&rarr; Gestionar</button>
            ${normalizePorraStatus(p.status) === 'draft'
              ? `<button type="button" class="btn-danger delete-porra" data-id="${esc(p.id)}">Borrar borrador</button>`
              : ''}
          </div>
        </li>`).join('')
    : `<li class="muted">Aún no hay porras. Crea la primera.</li>`;

  return `
    <section class="card">
      <h2>Crear porra</h2>
      <form id="createForm" class="form">
        <label>Nombre
          <input name="name" type="text" placeholder="Eurocopa 2028" required />
        </label>
        <label>Identificador público (slug)
          <input name="slug" type="text" placeholder="se genera del nombre" />
        </label>
        <label>Tipo de evento
          <select name="event_type">${eventOptions}</select>
        </label>
        <div class="event-rules" data-knockout-rules="worldcup">
          <label>Reglas de Mundial
            <select name="worldcup_rules">
              ${ruleSelect('worldcup')}
            </select>
          </label>
          <p class="muted">Solo aplica cuando el tipo de evento es Mundial. Define si usas el formato 32 equipos o el de 2026 con 48 equipos y mejores terceros.</p>
        </div>
        <div class="event-rules" data-knockout-rules="euro">
          <label>Reglas de Eurocopa
            <select name="euro_rules">
              ${ruleSelect('euro')}
            </select>
          </label>
          <p class="muted">Solo aplica cuando el tipo de evento es Eurocopa. Elige entre 8, 16 o 24 equipos según el formato oficial.</p>
        </div>
        <div class="event-rules" data-knockout-rules="nations">
          <label>Reglas de Nations League
            <select name="nations_rules">
              ${nationsRuleSelect}
            </select>
          </label>
          <p class="muted">Nations League no genera un único cuadro: se guarda la estructura de ligas, ascensos/descensos, play-offs y Final Four de Liga A.</p>
        </div>
        <label>Fecha límite de predicciones (opcional)
          <input name="deadline" type="datetime-local" />
        </label>
        <fieldset class="features">
          <legend>Secciones activas</legend>
          ${featureChecks}
        </fieldset>
        <button type="submit">Crear porra</button>
        <span class="error" id="createError"></span>
      </form>
    </section>
    <section class="card">
      <h2>Tus porras</h2>
      <ul class="porra-list">${porrasList}</ul>
      ${state.error ? `<p class="error">${esc(state.error)}</p>` : ''}
    </section>`;
}

function renderDetail() {
  const p = state.currentPorra;
  const nextStatus = nextPorraStatus(p.status);
  const knockoutTemplate = knockoutTemplateForEvent(p.event_type, p.scoring?.knockout?.templateId);
  const orderedTeams = sortedTeams();
  const draft = state.groupSetupDraft || (state.groups.length || state.teams.length ? buildGroupSetupDraftFromState() : null);
  const groupSetupCollapsed = Boolean(draft) && state.groupSetupCollapsed;

  const playersRows = state.players.map(player => `
    <tr>
      <td>${esc(player.display_name ?? player.name ?? player.player_id)}</td>
      <td>${esc(player.email ?? '—')}</td>
      <td><code>${esc(player.player_id)}</code></td>
      <td>${esc(state.playerTempPasswords[player.player_id] || '—')}</td>
      <td>${esc(player.joined_at ? new Date(player.joined_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—')}</td>
      <td><button type="button" class="btn-danger btn-sm del-player" data-id="${esc(player.player_id)}">✕</button></td>
    </tr>
  `).join('');

  const groupOptions = state.groups.map(g =>
    `<option value="${esc(g.group_id)}">${esc(g.name)}</option>`).join('');

  // Teams table
  const teamsRows = orderedTeams.map(t => {
    const grp = state.groups.find(g => g.group_id === t.group_id);
    const flag = t.flag || flagForTeam(t.name);
    if (state.editingTeamId === t.team_id) {
      return `<tr>
        <td colspan="4">
          <form class="inline-form edit-team-form" data-id="${esc(t.team_id)}">
            <input name="flag" type="text" value="${esc(flag)}" placeholder="Bandera" style="width:80px" />
            <input name="teamName" type="text" value="${esc(t.name)}" required />
            <select name="groupId">
              <option value="">Sin grupo</option>
              ${groupOptions.replace(`value="${esc(t.group_id)}"`, `value="${esc(t.group_id)}" selected`)}
            </select>
            <button type="submit" class="btn-secondary btn-sm">Guardar</button>
            <button type="button" class="btn-secondary btn-sm cancel-edit-team">Cancelar</button>
            <button type="button" class="btn-danger btn-sm del-team" data-id="${esc(t.team_id)}">✕</button>
          </form>
        </td>
      </tr>`;
    }
    const draggable = t.group_id ? 'true' : 'false';
    const draggingClass = state.draggingTeamId === t.team_id ? ' team-row-dragging' : '';
    return `<tr class="team-row${draggable === 'true' ? ` team-row-draggable${draggingClass}` : draggingClass}" data-team-id="${esc(t.team_id)}" data-team-group="${esc(t.group_id || '')}" draggable="${draggable}">
      <td>${esc(flag)}</td>
      <td>${esc(t.name)}</td>
      <td>${grp ? esc(grp.name) : '<span class="muted">—</span>'}</td>
      <td class="team-actions">
        <button type="button" class="btn-secondary btn-sm edit-team" data-id="${esc(t.team_id)}">Editar</button>
        <button type="button" class="btn-danger btn-sm del-team" data-id="${esc(t.team_id)}">✕</button>
      </td>
    </tr>`;
  }).join('');

  const teamOptions = orderedTeams.map(t =>
    `<option value="${esc(t.team_id)}">${esc(t.flag || flagForTeam(t.name))} ${esc(t.name)}</option>`).join('');

  // Matches table
  const matchRows = state.matches.map((m, index) => {
    const team1Id = m.team1_id ?? m.team1;
    const team2Id = m.team2_id ?? m.team2;
    const when = m.kickoff ? new Date(m.kickoff).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const phaseKey = m.phase ?? (m.stage === 'group' ? 'group' : m.round_key);
    const phase = phaseKey === 'group'
      ? (m.group_label ?? m.group_id ? `Grupo ${m.group_label ?? m.group_id}` : 'Fase de grupos')
      : (KNOCKOUT_ROUNDS.find(r => r.key === phaseKey)?.label ?? phaseKey ?? '—');
    const matchday = m.slot ? `J${m.slot}` : '—';
    const draggable = isGroupMatch(m) ? 'true' : 'false';
    const draggingClass = state.draggingMatchId === m.match_id ? ' match-row-dragging' : '';
    if (state.editingMatchId === m.match_id) {
      return `<tr>
        <td colspan="6">
          <form class="inline-form edit-match-form" data-id="${esc(m.match_id)}">
            <label style="flex:1">Fecha/hora
              <input name="kickoff" type="datetime-local" value="${esc(toDatetimeLocalValue(m.kickoff))}" />
            </label>
            <button type="submit" class="btn-secondary btn-sm">Guardar</button>
            <button type="button" class="btn-secondary btn-sm cancel-edit-match">Cancelar</button>
            <button type="button" class="btn-danger btn-sm del-match" data-id="${esc(m.match_id)}">✕</button>
          </form>
        </td>
      </tr>`;
    }
    return `<tr class="${isGroupMatch(m) ? `match-row-draggable${draggingClass}` : `match-row${draggingClass}`}" data-match-id="${esc(m.match_id)}" data-match-phase="${esc(phaseKey)}" draggable="${draggable}">
      <td>${esc(matchday)}</td>
      <td>${esc(phase)}</td>
      <td>${esc(matchTeamLabel(team1Id))}</td>
      <td>${esc(matchTeamLabel(team2Id))}</td>
      <td>${esc(when)}</td>
      <td>
        <button type="button" class="btn-secondary btn-sm edit-match" data-id="${esc(m.match_id)}">Editar fecha</button>
        <button type="button" class="btn-secondary btn-sm move-match" data-id="${esc(m.match_id)}" data-dir="up" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn-secondary btn-sm move-match" data-id="${esc(m.match_id)}" data-dir="down" ${index === state.matches.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="btn-danger btn-sm del-match" data-id="${esc(m.match_id)}">✕</button>
      </td>
    </tr>`;
  }).join('');

  // Group options for match form
  const groupOptMatch = `<option value="">— sin grupo —</option>` +
    state.groups.map(g => `<option value="${esc(g.group_id)}">${esc(g.name)}</option>`).join('');
  const knockoutOpts = KNOCKOUT_ROUNDS.map(r =>
    `<option value="${esc(r.key)}">${esc(r.label)}</option>`).join('');
  const miniFieldTypeOptions = selected => MINI_FIELD_TYPES.map(type =>
    `<option value="${esc(type.value)}"${type.value === selected ? ' selected' : ''}>${esc(type.label)}</option>`).join('');
  const miniQuestionRows = state.miniQuestions.map((question, index) => {
    const optionsText = miniOptionsToText(question.options);
    if (state.editingMiniQuestionId === question.question_id) {
      return `<tr>
        <td colspan="6">
          <form class="mini-edit-form edit-mini-question-form" data-id="${esc(question.question_id)}">
            <input name="question" type="text" value="${esc(question.question)}" placeholder="Pregunta" required />
            <input name="points" type="number" min="0" step="1" value="${esc(question.points)}" required style="width:90px" />
            <select name="fieldType">${miniFieldTypeOptions(question.field_type)}</select>
            <textarea name="options" rows="2" placeholder="Una opción por línea">${esc(optionsText)}</textarea>
            <div class="mini-edit-actions">
              <button type="submit" class="btn-secondary btn-sm">Guardar</button>
              <button type="button" class="btn-secondary btn-sm cancel-edit-mini-question">Cancelar</button>
              <button type="button" class="btn-danger btn-sm del-mini-question" data-id="${esc(question.question_id)}">✕</button>
            </div>
          </form>
        </td>
      </tr>`;
    }
    return `<tr>
      <td>${index + 1}</td>
      <td>${esc(question.question)}</td>
      <td>${esc(question.points)}</td>
      <td>${esc(miniFieldTypeLabel(question.field_type))}</td>
      <td>${optionsText ? esc(optionsText.replace(/\n/g, ', ')) : '<span class="muted">—</span>'}</td>
      <td class="mini-actions">
        <button type="button" class="btn-secondary btn-sm edit-mini-question" data-id="${esc(question.question_id)}">Editar</button>
        <button type="button" class="btn-secondary btn-sm move-mini-question" data-id="${esc(question.question_id)}" data-dir="up" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn-secondary btn-sm move-mini-question" data-id="${esc(question.question_id)}" data-dir="down" ${index === state.miniQuestions.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="btn-danger btn-sm del-mini-question" data-id="${esc(question.question_id)}">✕</button>
      </td>
    </tr>`;
  }).join('');

  const groupSetupSection = (() => {
    if (!draft) {
      return `
        <section class="card group-setup-card">
          <h2>Asistente de fase de grupos</h2>
          <p class="muted">Te obliga a definir la estructura antes de seguir: primero el número de grupos y equipos por grupo, luego los nombres de los equipos y la fecha opcional de la jornada inicial.</p>
          <form id="startGroupSetupForm" class="form inline-form">
            <label>Grupos
              <input name="groupCount" type="number" min="1" value="8" required />
            </label>
            <label>Equipos por grupo
              <input name="teamsPerGroup" type="number" min="2" value="4" required />
            </label>
            <button type="submit">Preparar plantilla</button>
          </form>
          <span class="error" id="groupSetupError"></span>
        </section>`;
    }

    const groupForms = draft.groups.map((group, groupIndex) => `
      <fieldset class="group-setup-block">
        <legend>Grupo ${esc(group.name)}</legend>
        <div class="group-setup-grid">
          ${group.teams.map((team, teamIndex) => `
            <div class="group-setup-team-card">
              <label>Equipo ${teamIndex + 1}
                <select name="group_${groupIndex}_team_${teamIndex}_catalog" class="group-setup-team-select" required>
                  ${renderCatalogTeamOptions(team.catalog, { includeCustom: true })}
                </select>
              </label>
              <div class="group-setup-team-preview muted" data-team-preview>Elige un equipo para ver la bandera</div>
              <div class="group-setup-custom-fields is-hidden">
                <label>Nombre personalizado
                  <input name="group_${groupIndex}_team_${teamIndex}_name" type="text" value="${esc(team.name)}" placeholder="Nombre del equipo" disabled />
                </label>
                <label>Bandera personalizada
                  <input name="group_${groupIndex}_team_${teamIndex}_flag" type="text" value="${esc(team.flag)}" placeholder="Emoji o bandera" disabled />
                </label>
              </div>
            </div>
          `).join('')}
        </div>
      </fieldset>
    `).join('');

    return `
      <section class="card group-setup-card">
        <div class="group-setup-header">
          <div>
            <h2>Asistente de fase de grupos</h2>
            <p class="muted">Plantilla preparada: ${draft.groupCount} grupos con ${draft.teamsPerGroup} equipos por grupo. Puedes seguir editándola como si todavía no se hubiese guardado.</p>
          </div>
          <button type="button" id="toggleGroupSetupBtn" class="btn-secondary btn-sm">
            ${groupSetupCollapsed ? 'Abrir' : 'Contraer'}
          </button>
        </div>
        <div class="group-setup-body${groupSetupCollapsed ? ' is-collapsed' : ''}">
          <form id="saveGroupSetupForm" class="form">
            <div class="match-row">
              <label>Fecha inicial de la jornada 1 (opcional)
                <input name="firstKickoff" type="datetime-local" value="${esc(draft.firstKickoff)}" />
              </label>
              <label>Días entre jornadas
                <input name="daysBetween" type="number" min="1" value="${esc(draft.daysBetween)}" />
              </label>
            </div>
            ${groupForms}
            <div class="match-row">
              <button type="submit">Guardar y regenerar partidos</button>
              <button type="button" class="btn-secondary" id="cancelGroupSetupBtn">Cancelar asistente</button>
            </div>
            <span class="error" id="groupSetupError"></span>
          </form>
        </div>
      </section>`;
  })();

  return `
    <div class="detail-header">
      <button type="button" id="backBtn" class="btn-secondary">&larr; Volver</button>
      <h2 style="margin:0">${esc(p.name)}</h2>
      <code class="muted">${esc(p.slug)}</code>
      <span class="status-pill">${esc(porraStatusLabel(p.status))}</span>
      <button type="button" id="advanceStatusBtn" class="btn-secondary" ${nextStatus ? '' : 'disabled'}>
        ${nextStatus ? `Pasar a ${esc(porraStatusLabel(nextStatus).toLowerCase())}` : 'Porra cerrada'}
      </button>
      ${canRevertPorraToDraft(p.status)
        ? `<button type="button" id="revertDraftBtn" class="btn-secondary">Volver a borrador</button>`
        : ''}
      ${normalizePorraStatus(p.status) === 'draft'
        ? `<button type="button" id="deletePorraBtn" class="btn-danger">Borrar borrador</button>`
        : ''}
    </div>
    ${state.detailError ? `<p class="error">${esc(state.detailError)}</p>` : ''}
    ${groupSetupSection}

    <section class="card player-section-card">
      <div class="section-collapsible-header">
        <h2>Jugadores <span class="muted">(${state.players.length})</span></h2>
        <button type="button" id="togglePlayerSectionBtn" class="btn-secondary btn-sm">
          ${state.playerSectionCollapsed ? 'Abrir' : 'Contraer'}
        </button>
      </div>
      <div class="section-collapsible-body${state.playerSectionCollapsed ? ' is-collapsed' : ''}">
        ${state.players.length
          ? `<div class="table-wrap"><table class="data-table">
              <thead><tr><th>Nombre</th><th>Email</th><th>ID jugador</th><th>Contraseña temporal</th><th>Alta</th><th></th></tr></thead>
              <tbody>${playersRows}</tbody>
            </table></div>`
          : `<p class="muted">Sin jugadores todavía.</p>`}
        <form id="addPlayerForm" class="form inline-form" style="margin-top:.75rem">
          <input name="displayName" type="text" placeholder="Nombre visible" required style="flex:1" />
          <input name="email" type="email" placeholder="jugador@correo.com" required style="flex:1" />
          <button type="submit">+ Añadir jugador</button>
        </form>
        <span class="error" id="playerError"></span>
        ${state.playerMessage ? `<span class="muted" id="playerMessage" style="display:block;margin-top:.35rem">${esc(state.playerMessage)}</span>` : ''}
      </div>
    </section>

    <section class="card match-section-card">
      <div class="match-section-header">
        <h2>Partidos <span class="muted">(${state.matches.length})</span></h2>
        <button type="button" id="toggleMatchSectionBtn" class="btn-secondary btn-sm">
          ${state.matchSectionCollapsed ? 'Abrir' : 'Contraer'}
        </button>
      </div>
      <div class="match-section-body${state.matchSectionCollapsed ? ' is-collapsed' : ''}">
        ${state.matches.length
          ? `<div class="table-wrap"><table class="data-table">
              <thead><tr><th>Jornada</th><th>Fase</th><th>Local</th><th>Visitante</th><th>Fecha</th><th>Orden</th></tr></thead>
              <tbody data-match-dropzone="group">${matchRows}</tbody>
            </table></div>`
          : `<p class="muted">Sin partidos todavía.</p>`}
        <form id="generateGroupMatchesForm" class="form inline-form" style="margin-top:.75rem">
          <label>Fecha inicial (opcional)
            <input name="firstKickoff" type="datetime-local" />
          </label>
          <label>Días entre jornadas
            <input name="daysBetween" type="number" min="1" value="4" />
          </label>
          <button type="submit">Generar fase de grupos</button>
        </form>
        <button type="button" id="resetGroupMatchesBtn" class="btn-danger" style="margin-top:.5rem">
          Resetear fase de grupos
        </button>
        ${knockoutTemplate ? `
          <form id="generateKnockoutMatchesForm" class="form inline-form" style="margin-top:1rem">
            <label>Fecha inicial de cruces (opcional)
              <input name="knockoutFirstKickoff" type="datetime-local" />
            </label>
            <label>Días entre rondas
              <input name="knockoutDaysBetween" type="number" min="1" value="2" />
            </label>
            <button type="submit">Generar cruces ${esc(knockoutTemplate.label)}</button>
          </form>
          <button type="button" id="resetKnockoutMatchesBtn" class="btn-danger" style="margin-top:.5rem">
            Resetear cruces
          </button>
          <p class="muted" style="margin-top:.5rem">${esc(knockoutTemplate.label)} usa la plantilla oficial guardada en la porra y enlaza las rondas posteriores con los ganadores previos.</p>
        ` : ''}
        ${p.event_type === 'nations' ? `
          <p class="muted" style="margin-top:.5rem">Nations League no usa un único cuadro de cruces. Se organiza por ligas, ascensos/descensos, play-offs y Final Four de Liga A; los partidos de estas fases se añaden manualmente.</p>
        ` : ''}
        <p class="muted" style="margin-top:.5rem">También puedes arrastrar las filas de fase de grupos para reordenarlas.</p>
        <p class="muted" style="margin-top:.5rem">Borra solo los partidos de fase de grupos para poder regenerarlos desde cero.</p>
        <form id="addMatchForm" class="form match-form" style="margin-top:.75rem">
          <div class="match-row">
            <label>Fase
              <select name="phase" id="matchPhase">
                <option value="group">Fase de grupos</option>
                ${knockoutOpts}
              </select>
            </label>
            <label id="matchGroupLabel">Grupo
              <select name="groupLabel">${groupOptMatch}</select>
            </label>
          </div>
          <div class="match-row">
            <label>Local
              <select name="team1" required>
                <option value="">— equipo —</option>
                ${teamOptions}
              </select>
            </label>
            <label>Visitante
              <select name="team2" required>
                <option value="">— equipo —</option>
                ${teamOptions}
              </select>
            </label>
            <label>Fecha/hora
              <input name="kickoff" type="datetime-local" />
            </label>
          </div>
          <button type="submit">+ Añadir partido</button>
          <span class="error" id="matchError"></span>
        </form>
      </div>
    </section>

    <section class="card mini-section-card">
      <div class="section-collapsible-header">
        <h2>Mini-porra <span class="muted">(${state.miniQuestions.length})</span></h2>
        <button type="button" id="toggleMiniSectionBtn" class="btn-secondary btn-sm">
          ${state.miniSectionCollapsed ? 'Abrir' : 'Contraer'}
        </button>
      </div>
      <div class="section-collapsible-body${state.miniSectionCollapsed ? ' is-collapsed' : ''}">
        ${state.miniQuestions.length
          ? `<div class="table-wrap"><table class="data-table">
              <thead><tr><th>#</th><th>Pregunta</th><th>Puntos</th><th>Tipo</th><th>Opciones</th><th></th></tr></thead>
              <tbody>${miniQuestionRows}</tbody>
            </table></div>`
          : `<p class="muted">Sin preguntas de mini-porra todavía.</p>`}
        <form id="addMiniQuestionForm" class="form mini-form" style="margin-top:.75rem">
          <label>Pregunta
            <input name="question" type="text" placeholder="¿Quién marcará el primer gol?" required />
          </label>
          <div class="match-row">
            <label>Puntos
              <input name="points" type="number" min="0" step="1" value="0" required />
            </label>
            <label>Tipo de campo
              <select name="fieldType">
                ${miniFieldTypeOptions('text')}
              </select>
            </label>
          </div>
          <label>Opciones, una por línea
            <textarea name="options" rows="3" placeholder="Opcional"></textarea>
          </label>
          <button type="submit">+ Añadir pregunta</button>
          <span class="error" id="miniError"></span>
        </form>
        <p class="muted" style="margin-top:.5rem">Las opciones se guardan como una lista en Supabase; si no aplican a la pregunta, puedes dejarlo vacío.</p>
      </div>
    </section>`;
}

function render() {
  renderSession();

  if (state.loading) {
    $app.innerHTML = `<p class="muted">Cargando…</p>`;
    return;
  }
  if (!state.user) {
    $app.innerHTML = renderLogin();
    return;
  }
  if (!state.isAdmin) {
    $app.innerHTML = `<section class="card"><h2>Sin permisos</h2><p class="muted">Tu cuenta no es administrador de plataforma.</p></section>`;
    return;
  }

  if (state.currentPorra) {
    $app.innerHTML = renderDetail();
    wireDetail();
  } else {
    $app.innerHTML = renderPorraList();
    wirePorraList();
  }
}

// ── Wire list view ─────────────────────────────────────────────────────────────

function wirePorraList() {
  const form = document.getElementById('createForm');
  if (!form) return;
  const nameInput = form.querySelector('[name=name]');
  const slugInput = form.querySelector('[name=slug]');
  const eventTypeSelect = form.querySelector('[name=event_type]');
  const ruleSections = [...form.querySelectorAll('[data-knockout-rules]')];
  let slugTouched = false;
  slugInput.addEventListener('input', () => { slugTouched = true; });
  nameInput.addEventListener('input', () => {
    if (!slugTouched) slugInput.value = slugify(nameInput.value);
  });
  function toggleKnockoutRules() {
    if (!eventTypeSelect) return;
    const currentType = eventTypeSelect.value;
    for (const section of ruleSections) {
      section.hidden = section.dataset.knockoutRules !== currentType;
    }
  }
  eventTypeSelect?.addEventListener('change', toggleKnockoutRules);
  toggleKnockoutRules();
}

// ── Wire detail view ───────────────────────────────────────────────────────────

function wireDetail() {
  // Show/hide group label for match phase
  const phaseSelect = document.getElementById('matchPhase');
  const groupLabelEl = document.getElementById('matchGroupLabel');
  function toggleGroupLabel() {
    groupLabelEl.style.display = phaseSelect?.value === 'group' ? '' : 'none';
  }
  phaseSelect?.addEventListener('change', toggleGroupLabel);
  toggleGroupLabel();

  const catalogTeam = document.getElementById('catalogTeam');
  const customTeamName = document.getElementById('customTeamName');
  const customTeamFlag = document.getElementById('customTeamFlag');
  function toggleCustomTeam() {
    const custom = catalogTeam?.value === '__custom';
    if (customTeamName) {
      customTeamName.style.display = custom ? '' : 'none';
      customTeamName.required = custom;
    }
    if (customTeamFlag) customTeamFlag.style.display = custom ? '' : 'none';
  }
  catalogTeam?.addEventListener('change', toggleCustomTeam);
  toggleCustomTeam();

  document.querySelectorAll('.group-setup-team-select').forEach(select => {
    select.addEventListener('change', () => syncGroupSetupCustomFields(select.closest('.card') || document));
  });
  syncGroupSetupCustomFields();
}

// ── Handlers ───────────────────────────────────────────────────────────────────

async function handleLogin(form) {
  const errorEl = document.getElementById('loginError');
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; errorEl.textContent = '';
  const fd = new FormData(form);
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get('email') || ''),
    password: String(fd.get('password') || '')
  });
  if (error) { errorEl.textContent = 'Email o contraseña incorrectos.'; btn.disabled = false; return; }
  await refreshAuth();
}

async function handleCreate(form) {
  const errorEl = document.getElementById('createError');
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; errorEl.textContent = '';
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const slug = String(fd.get('slug') || '').trim() || slugify(name);
  const eventType = String(fd.get('event_type') || 'custom');
  let templateId = '';
  if (eventType === 'worldcup') {
    templateId = String(fd.get('worldcup_rules') || defaultKnockoutTemplateIdForEvent(eventType));
  } else if (eventType === 'euro') {
    templateId = String(fd.get('euro_rules') || defaultKnockoutTemplateIdForEvent(eventType));
  } else if (eventType === 'nations') {
    templateId = String(fd.get('nations_rules') || 'nations_2026_27');
  }
  const knockoutTemplate = knockoutTemplateForEvent(eventType, templateId);
  const nationsTemplate = eventType === 'nations'
    ? nationsLeagueTemplateForEvent(templateId)
    : null;
  const deadlineRaw = String(fd.get('deadline') || '');
  const features = {};
  for (const f of FEATURES) features[f.key] = false;
  form.querySelectorAll('[name=feature]:checked').forEach(el => { features[el.value] = true; });
  if (eventType === 'worldcup' || eventType === 'euro') {
    features.bestThirds = Boolean(knockoutTemplate?.thirdPlaceQualifiers);
  }
  if (eventType === 'nations') {
    features.knockout = false;
    features.bestThirds = false;
  }
  const knockoutStructure = features.knockout ? defaultKnockoutStructure(eventType, templateId) : [];
  const scoring = {
    groupExact: 3,
    groupSign: 2,
    knockout: {
      ...DEFAULT_KNOCKOUT_SCORING,
      templateId: eventType === 'nations' ? '' : (knockoutTemplate?.id || '')
    }
  };
  if (nationsTemplate) {
    scoring.nationsLeague = { ...nationsTemplate, templateId: nationsTemplate.id };
  }

  const { error } = await supabase.from('porras').insert({
    name, slug, event_type: eventType, status: 'draft',
    owner: state.user.id,
    predictions_deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
    scoring,
    knockout_structure: knockoutStructure,
    features
  });
  if (error) {
    errorEl.textContent = error.message.includes('duplicate')
      ? 'Ese slug ya existe, elige otro.'
      : `Error: ${error.message}`;
    btn.disabled = false; return;
  }
  await loadPorras();
  render();
}

async function openPorra(id) {
  state.currentPorra = state.porras.find(p => p.id === id) || null;
  state.playerMessage = '';
  state.playerTempPasswords = {};
  state.groupSetupCollapsed = false;
  state.matchSectionCollapsed = false;
  state.playerSectionCollapsed = false;
  state.miniSectionCollapsed = false;
  clearGroupSetupDraft();
  if (!state.currentPorra) return;
  await loadDetail(id);
  render();
}

async function deletePorra(porraId) {
  const porra = state.porras.find(item => item.id === porraId);
  if (!porra) return;
  if (normalizePorraStatus(porra.status) !== 'draft') {
    state.detailError = 'Solo se pueden borrar las porras en borrador.';
    render();
    return;
  }
  const label = porra.name || porra.slug || porra.id;
  if (!window.confirm(`Vas a borrar el borrador "${label}". Esta acción no se puede deshacer. ¿Continuar?`)) return;

  const { error } = await supabase
    .from('porras')
    .delete()
    .eq('id', porraId);
  if (error) {
    state.detailError = error.message;
    render();
    return;
  }
  if (state.currentPorra?.id === porraId) {
    state.currentPorra = null;
  }
  state.playerTempPasswords = {};
  state.groupSetupCollapsed = false;
  state.matchSectionCollapsed = false;
  state.playerSectionCollapsed = false;
  state.miniSectionCollapsed = false;
  clearGroupSetupDraft();
  await loadPorras();
  render();
}

async function handleAddGroup(form) {
  if (canUseGroupSetupDraft() || (!state.groups.length && !state.teams.length)) {
    state.detailError = 'Usa el asistente de fase de grupos para crear la estructura inicial.';
    render();
    return;
  }
  const name = String(new FormData(form).get('groupName') || '').trim().toUpperCase();
  if (!name) return;
  const { error } = await supabase.from('porra_groups').insert({
    porra_id: state.currentPorra.id,
    group_id: name,
    name
  });
  if (error) { state.detailError = error.message; render(); return; }
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
}

async function handleStartGroupSetup(form) {
  const errorEl = document.getElementById('groupSetupError');
  const fd = new FormData(form);
  const groupCount = Math.max(1, Number(fd.get('groupCount') || 0) || 0);
  const teamsPerGroup = Math.max(2, Number(fd.get('teamsPerGroup') || 0) || 0);
  if (!groupCount || !teamsPerGroup) {
    errorEl.textContent = 'Indica cuántos grupos y cuántos equipos por grupo habrá.';
    return;
  }
  state.groupSetupDraft = buildGroupSetupDraft(groupCount, teamsPerGroup);
  state.groupSetupCollapsed = false;
  state.detailError = '';
  render();
}

function cancelGroupSetup() {
  clearGroupSetupDraft();
  state.groupSetupCollapsed = false;
  render();
}

function syncGroupSetupCustomFields(root = document) {
  const selects = [...root.querySelectorAll('.group-setup-team-select')];
  const selectedNames = new Set();
  let duplicateMessage = '';

  for (const select of selects) {
    const value = String(select.value || '');
    if (!value || value === '__custom') continue;
    const normalized = normalizeTeamName(value);
    if (selectedNames.has(normalized)) {
      select.value = '';
      duplicateMessage = `El equipo "${value}" ya está usado en otro grupo.`;
      continue;
    }
    selectedNames.add(normalized);
  }

  for (const select of selects) {
    const card = select.closest('.group-setup-team-card');
    if (!card) continue;
    const customFields = card.querySelector('.group-setup-custom-fields');
    const preview = card.querySelector('[data-team-preview]');
    const isCustom = select.value === '__custom';
    if (customFields) {
      customFields.classList.toggle('is-hidden', !isCustom);
      customFields.querySelectorAll('input').forEach(input => {
        input.disabled = !isCustom;
        input.required = isCustom && input.name.endsWith('_name');
      });
    }

    const selectedLabel = select.options[select.selectedIndex]?.textContent?.trim() || '';
    if (preview) {
      if (!select.value) {
        preview.textContent = 'Elige un equipo para ver la bandera';
      } else if (isCustom) {
        preview.textContent = 'Personalizado: añade nombre y bandera';
      } else {
        preview.textContent = selectedLabel;
      }
    }

    select.querySelectorAll('option').forEach(option => {
      if (!option.value || option.value === '__custom') {
        option.disabled = false;
        return;
      }
      const normalized = normalizeTeamName(option.value);
      option.disabled = selectedNames.has(normalized) && normalized !== normalizeTeamName(select.value);
    });
  }

  const errorEl = document.getElementById('groupSetupError');
  if (errorEl) {
    if (duplicateMessage) errorEl.textContent = duplicateMessage;
    else if (String(errorEl.textContent || '').startsWith('El equipo "')) errorEl.textContent = '';
  }
}

async function handleSaveGroupSetup(form) {
  const errorEl = document.getElementById('groupSetupError');
  const fd = new FormData(form);
  const draft = state.groupSetupDraft;
  if (!draft) {
    errorEl.textContent = 'No hay asistente activo.';
    return;
  }

  const firstKickoffRaw = String(fd.get('firstKickoff') || '');
  const daysBetweenRaw = String(fd.get('daysBetween') || '');
  draft.firstKickoff = firstKickoffRaw;
  draft.daysBetween = Math.max(1, Number(daysBetweenRaw) || 4);

  const existingGroups = [...state.groups]
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
  const existingTeamsByGroup = new Map(
    existingGroups.map(group => [
      group.group_id,
      state.teams
        .filter(team => team.group_id === group.group_id)
        .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
    ])
  );
  const groupRows = [];
  const teamRows = [];
  const teamNames = new Set();
  let setupError = '';

  for (const [groupIndex, group] of draft.groups.entries()) {
    const groupName = String(group.name || defaultGroupName(groupIndex)).trim().toUpperCase();
    const existingGroup = existingGroups[groupIndex];
    const groupId = existingGroup?.group_id || groupName;
    groupRows.push({
      porra_id: state.currentPorra.id,
      group_id: groupId,
      name: groupName,
      position: groupIndex + 1
    });

    const existingTeams = existingTeamsByGroup.get(groupId) || [];
    for (const [teamIndex] of group.teams.entries()) {
      const catalogTeam = String(fd.get(`group_${groupIndex}_team_${teamIndex}_catalog`) || '').trim();
      const customName = String(fd.get(`group_${groupIndex}_team_${teamIndex}_name`) || '').trim();
      const customFlag = String(fd.get(`group_${groupIndex}_team_${teamIndex}_flag`) || '').trim();
      const name = catalogTeam === '__custom' ? customName : catalogTeam;
      const flag = catalogTeam === '__custom'
        ? (customFlag || flagForTeam(customName))
        : flagForTeam(catalogTeam);
      if (!catalogTeam) {
        setupError = `Elige un equipo para la posición ${teamIndex + 1} del grupo ${groupName}.`;
        break;
      }
      if (catalogTeam === '__custom' && !name) {
        setupError = `Falta el nombre personalizado del equipo ${teamIndex + 1} del grupo ${groupName}.`;
        break;
      }
      const normalizedName = name.toUpperCase();
      if (teamNames.has(normalizedName)) {
        setupError = `El equipo "${name}" está repetido.`;
        break;
      }
      teamNames.add(normalizedName);
      const existingTeam = existingTeams[teamIndex];
      teamRows.push({
        porra_id: state.currentPorra.id,
        team_id: existingTeam?.team_id || makeEntityId('team'),
        name,
        flag: flag || flagForTeam(name) || null,
        group_id: groupId,
        position: teamIndex + 1
      });
    }
    if (setupError) break;
  }

  if (setupError) {
    errorEl.textContent = setupError;
    return;
  }
  if (!groupRows.length || !teamRows.length) {
    errorEl.textContent = 'Debes completar todos los equipos.';
    return;
  }

  const { error: groupsError } = await supabase
    .from('porra_groups')
    .upsert(groupRows, { onConflict: 'porra_id,group_id' });
  if (groupsError) {
    errorEl.textContent = groupsError.message;
    return;
  }

  const { error: teamsError } = await supabase
    .from('porra_teams')
    .upsert(teamRows, { onConflict: 'porra_id,team_id' });
  if (teamsError) {
    errorEl.textContent = teamsError.message;
    return;
  }

  const groupMatchIds = state.matches
    .filter(isGroupMatch)
    .map(match => match.match_id);
  if (groupMatchIds.length) {
    const { error: deleteMatchesError } = await supabase
      .from('porra_matches')
      .delete()
      .eq('porra_id', state.currentPorra.id)
      .in('match_id', groupMatchIds);
    if (deleteMatchesError) {
      errorEl.textContent = deleteMatchesError.message;
      return;
    }
  }

  await loadDetail(state.currentPorra.id);
  const matchRows = buildGroupMatches(firstKickoffRaw, daysBetweenRaw);
  if (matchRows.length) {
    const { error: matchesError } = await supabase.from('porra_matches').insert(matchRows);
    if (matchesError) {
      state.detailError = matchesError.message;
      await loadDetail(state.currentPorra.id);
      render();
      return;
    }
  }

  await loadDetail(state.currentPorra.id);
  render();
}

async function handleAddTeam(form) {
  if (canUseGroupSetupDraft() || (!state.groups.length && !state.teams.length)) {
    state.detailError = 'Usa el asistente de fase de grupos para crear la estructura inicial.';
    render();
    return;
  }
  const errorEl = document.getElementById('teamError');
  const fd = new FormData(form);
  const catalogTeam = String(fd.get('catalogTeam') || '').trim();
  const customName = String(fd.get('teamName') || '').trim();
  const customFlag = String(fd.get('flag') || '').trim();
  const name = catalogTeam === '__custom' ? customName : catalogTeam;
  const flag = catalogTeam === '__custom' ? (customFlag || flagForTeam(customName)) : flagForTeam(catalogTeam);
  const groupId = String(fd.get('groupId') || '').trim() || null;
  if (!name) return;
  if (porraHasTeamName(name)) {
    errorEl.textContent = 'Ese equipo ya existe en la porra.';
    return;
  }
  const { error } = await supabase.from('porra_teams').insert({
    porra_id: state.currentPorra.id,
    team_id: makeEntityId('team'),
    name,
    flag: flag || null,
    group_id: groupId || null,
    position: nextTeamPosition(groupId)
  });
  if (error) { errorEl.textContent = error.message; return; }
  state.editingTeamId = null;
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
}

function startEditTeam(teamId) {
  state.editingTeamId = teamId;
  state.detailError = '';
  render();
}

function cancelEditTeam() {
  state.editingTeamId = null;
  state.detailError = '';
  render();
}

function startEditMatch(matchId) {
  state.editingMatchId = matchId;
  state.detailError = '';
  render();
}

function cancelEditMatch() {
  state.editingMatchId = null;
  state.detailError = '';
  render();
}

async function handleEditMatch(form) {
  const matchId = form.dataset.id;
  const fd = new FormData(form);
  const kickoffRaw = String(fd.get('kickoff') || '').trim();
  const kickoff = kickoffRaw ? new Date(kickoffRaw).toISOString() : null;
  if (kickoffRaw && Number.isNaN(new Date(kickoffRaw).getTime())) {
    state.detailError = 'La fecha del partido no es válida.';
    render();
    return;
  }
  const { error } = await supabase.from('porra_matches')
    .update({
      kickoff
    })
    .eq('porra_id', state.currentPorra.id)
    .eq('match_id', matchId);
  if (error) {
    state.detailError = error.message;
    render();
    return;
  }
  state.editingMatchId = null;
  await loadDetail(state.currentPorra.id);
  render();
}

async function handleEditTeam(form) {
  const teamId = form.dataset.id;
  const fd = new FormData(form);
  const name = String(fd.get('teamName') || '').trim();
  const flag = String(fd.get('flag') || '').trim() || null;
  const groupId = String(fd.get('groupId') || '').trim() || null;
  const existingTeam = state.teams.find(team => team.team_id === teamId);
  if (!name) {
    state.detailError = 'El nombre del equipo es obligatorio.';
    render();
    return;
  }
  if (porraHasTeamName(name, teamId)) {
    state.detailError = 'Ese equipo ya existe en la porra.';
    render();
    return;
  }
  const { error } = await supabase.from('porra_teams')
    .update({
      name,
      flag: flag || flagForTeam(name) || null,
      group_id: groupId || null,
      position: groupId !== (existingTeam?.group_id ?? null)
        ? nextTeamPosition(groupId)
        : existingTeam?.position ?? 0
    })
    .eq('porra_id', state.currentPorra.id)
    .eq('team_id', teamId);
  if (error) {
    state.detailError = error.message;
    render();
    return;
  }
  state.editingTeamId = null;
  await loadDetail(state.currentPorra.id);
  render();
}

async function handleAddMatch(form) {
  const errorEl = document.getElementById('matchError');
  const fd = new FormData(form);
  const team1Id = String(fd.get('team1') || '');
  const team2Id = String(fd.get('team2') || '');
  const phase = String(fd.get('phase') || 'group');
  const groupLabel = phase === 'group' ? (String(fd.get('groupLabel') || '').trim() || null) : null;
  const kickoffRaw = String(fd.get('kickoff') || '');
  if (!team1Id || !team2Id) { errorEl.textContent = 'Selecciona los dos equipos.'; return; }
  if (team1Id === team2Id) { errorEl.textContent = 'Los dos equipos deben ser distintos.'; return; }
  const { error } = await supabase.from('porra_matches').insert({
    porra_id: state.currentPorra.id,
    match_id: makeEntityId('match'),
    stage: phase === 'group' ? 'group' : 'knockout',
    group_id: groupLabel,
    round_key: phase === 'group' ? null : phase,
    team1: team1Id,
    team2: team2Id,
    team1_id: team1Id,
    team2_id: team2Id,
    phase,
    group_label: groupLabel,
    kickoff: kickoffRaw ? new Date(kickoffRaw).toISOString() : null,
    position: Math.max(0, ...state.matches.map(match => Number(match.position) || 0)) + 1,
    status: 'scheduled'
  });
  if (error) { errorEl.textContent = error.message; return; }
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
}

async function handleGenerateGroupMatches(form) {
  const fd = new FormData(form);
  const firstKickoffRaw = String(fd.get('firstKickoff') || '');
  const daysBetweenRaw = String(fd.get('daysBetween') || '');
  const rows = buildGroupMatches(firstKickoffRaw, daysBetweenRaw);
  if (!rows.length) {
    state.detailError = 'No hay partidos nuevos que generar. Revisa que los grupos tengan al menos dos equipos y que no existan ya esos cruces.';
    render();
    return;
  }
  const { error } = await supabase.from('porra_matches').insert(rows);
  if (error) { state.detailError = error.message; render(); return; }
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
}

async function handleGenerateKnockoutMatches(form) {
  const errorEl = document.getElementById('matchError');
  const fd = new FormData(form);
  const firstKickoffRaw = String(fd.get('knockoutFirstKickoff') || '');
  const daysBetweenRaw = String(fd.get('knockoutDaysBetween') || '');
  const { rows, error } = buildKnockoutMatches(firstKickoffRaw, daysBetweenRaw);
  if (error) {
    errorEl.textContent = error;
    return;
  }
  if (!rows.length) {
    errorEl.textContent = 'No se pudieron generar los cruces.';
    return;
  }
  const { error: insertError } = await supabase.from('porra_matches').insert(rows);
  if (insertError) {
    errorEl.textContent = insertError.message;
    return;
  }
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
}

async function resetGroupMatches() {
  const groupMatches = state.matches.filter(match => (match.phase ?? match.stage) === 'group');
  if (!groupMatches.length) {
    state.detailError = 'No hay partidos de fase de grupos para resetear.';
    render();
    return;
  }
  if (!window.confirm(`Vas a borrar ${groupMatches.length} partidos de fase de grupos. ¿Continuar?`)) return;

  const { error } = await supabase
    .from('porra_matches')
    .delete()
    .eq('porra_id', state.currentPorra.id)
    .in('match_id', groupMatches.map(match => match.match_id));
  if (error) { state.detailError = error.message; render(); return; }
  await loadDetail(state.currentPorra.id);
  render();
}

async function resetKnockoutMatches() {
  const knockoutMatchIds = state.matches
    .filter(match => (match.phase ?? match.stage) !== 'group')
    .map(match => match.match_id);
  if (!knockoutMatchIds.length) {
    state.detailError = 'No hay cruces para resetear.';
    render();
    return;
  }
  if (!window.confirm(`Vas a borrar ${knockoutMatchIds.length} cruces. ¿Continuar?`)) return;
  const { error } = await supabase
    .from('porra_matches')
    .delete()
    .eq('porra_id', state.currentPorra.id)
    .in('match_id', knockoutMatchIds);
  if (error) { state.detailError = error.message; render(); return; }
  await loadDetail(state.currentPorra.id);
  render();
}

async function moveMatch(matchId, direction) {
  const index = state.matches.findIndex(match => match.match_id === matchId);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= state.matches.length) return;

  const ordered = [...state.matches];
  [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
  if (!(await persistMatchOrder(ordered))) return;
  await loadDetail(state.currentPorra.id);
  render();
}

function nextMiniQuestionPosition() {
  return Math.max(0, ...state.miniQuestions.map(question => Number(question.position) || 0)) + 1;
}

async function handleAddMiniQuestion(form) {
  const errorEl = document.getElementById('miniError');
  const fd = new FormData(form);
  const question = String(fd.get('question') || '').trim();
  const points = Math.max(0, Number(fd.get('points') || 0) || 0);
  const fieldType = String(fd.get('fieldType') || 'text');
  const options = parseMiniOptions(fd.get('options'));
  if (!question) {
    errorEl.textContent = 'La pregunta es obligatoria.';
    return;
  }
  const { error } = await supabase.from('porra_mini_questions').insert({
    porra_id: state.currentPorra.id,
    question_id: makeEntityId('mini'),
    position: nextMiniQuestionPosition(),
    question,
    points,
    field_type: fieldType,
    options
  });
  if (error) { errorEl.textContent = error.message; return; }
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
}

function startEditMiniQuestion(questionId) {
  state.editingMiniQuestionId = questionId;
  state.detailError = '';
  render();
}

function cancelEditMiniQuestion() {
  state.editingMiniQuestionId = null;
  state.detailError = '';
  render();
}

async function handleEditMiniQuestion(form) {
  const questionId = form.dataset.id;
  const fd = new FormData(form);
  const question = String(fd.get('question') || '').trim();
  const points = Math.max(0, Number(fd.get('points') || 0) || 0);
  const fieldType = String(fd.get('fieldType') || 'text');
  const options = parseMiniOptions(fd.get('options'));
  if (!question) {
    state.detailError = 'La pregunta es obligatoria.';
    render();
    return;
  }
  const { error } = await supabase.from('porra_mini_questions')
    .update({
      question,
      points,
      field_type: fieldType,
      options
    })
    .eq('porra_id', state.currentPorra.id)
    .eq('question_id', questionId);
  if (error) {
    state.detailError = error.message;
    render();
    return;
  }
  state.editingMiniQuestionId = null;
  await loadDetail(state.currentPorra.id);
  render();
}

async function moveMiniQuestion(questionId, direction) {
  const index = state.miniQuestions.findIndex(question => question.question_id === questionId);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= state.miniQuestions.length) return;

  const ordered = [...state.miniQuestions];
  [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
  const results = await Promise.all(ordered.map((question, positionIndex) =>
    supabase.from('porra_mini_questions')
      .update({ position: positionIndex + 1 })
      .eq('porra_id', state.currentPorra.id)
      .eq('question_id', question.question_id)
  ));
  const failed = results.find(result => result.error);
  if (failed) {
    state.detailError = failed.error.message;
    render();
    return;
  }
  await loadDetail(state.currentPorra.id);
  render();
}

async function deleteMiniQuestion(questionId) {
  const { error } = await supabase
    .from('porra_mini_questions')
    .delete()
    .eq('porra_id', state.currentPorra.id)
    .eq('question_id', questionId);
  if (error) { state.detailError = error.message; render(); return; }
  await loadDetail(state.currentPorra.id);
  render();
}

async function handleAddPlayer(form) {
  const errorEl = document.getElementById('playerError');
  const btn = form.querySelector('button[type=submit]');
  const fd = new FormData(form);
  const displayName = String(fd.get('displayName') || '').trim();
  const email = String(fd.get('email') || '').trim();
  if (!displayName || !email) {
    errorEl.textContent = 'Indica nombre y email.';
    return;
  }
  btn.disabled = true;
  errorEl.textContent = '';
  const { data, error } = await supabase.functions.invoke('admin-next-add-player', {
    body: {
      porra_id: state.currentPorra.id,
      email,
      display_name: displayName
    }
  });
  if (error || data?.error) {
    errorEl.textContent = error?.message || data?.error || 'No se pudo añadir el jugador.';
    btn.disabled = false;
    return;
  }
  if (data?.player?.player_id && data?.temp_password) {
    state.playerTempPasswords[data.player.player_id] = data.temp_password;
  }
  state.playerMessage = data?.temp_password
    ? `Usuario creado en Auth. Contraseña temporal: ${data.temp_password}`
    : 'Jugador añadido y enlazado.';
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
  btn.disabled = false;
}

async function advancePorraStatus() {
  const nextStatus = nextPorraStatus(state.currentPorra?.status);
  if (!nextStatus) return;
  const { error } = await supabase
    .from('porras')
    .update({ status: nextStatus })
    .eq('id', state.currentPorra.id);
  if (error) { state.detailError = error.message; render(); return; }
  await loadPorras();
  await loadDetail(state.currentPorra.id);
  render();
}

async function revertPorraToDraft() {
  if (!state.currentPorra) return;
  if (!window.confirm('Vas a devolver esta porra a borrador. ¿Continuar?')) return;
  const { error } = await supabase
    .from('porras')
    .update({ status: 'draft' })
    .eq('id', state.currentPorra.id);
  if (error) { state.detailError = error.message; render(); return; }
  await loadPorras();
  await loadDetail(state.currentPorra.id);
  render();
}

async function deletePlayer(playerId) {
  const { error } = await supabase
    .from('porra_players')
    .delete()
    .eq('porra_id', state.currentPorra.id)
    .eq('player_id', playerId);
  if (error) { state.detailError = error.message; render(); return; }
  await loadDetail(state.currentPorra.id);
  render();
}

async function deleteTeam(teamId) {
  const { error } = await supabase
    .from('porra_teams')
    .delete()
    .eq('porra_id', state.currentPorra.id)
    .eq('team_id', teamId);
  if (error) { state.detailError = error.message; render(); return; }
  await loadDetail(state.currentPorra.id);
  render();
}

async function deleteGroup(groupId) {
  const { error } = await supabase
    .from('porra_groups')
    .delete()
    .eq('porra_id', state.currentPorra.id)
    .eq('group_id', groupId);
  if (error) { state.detailError = error.message; render(); return; }
  await loadDetail(state.currentPorra.id);
  render();
}

async function deleteMatch(matchId) {
  const { error } = await supabase
    .from('porra_matches')
    .delete()
    .eq('porra_id', state.currentPorra.id)
    .eq('match_id', matchId);
  if (error) { state.detailError = error.message; render(); return; }
  await loadDetail(state.currentPorra.id);
  render();
}

// ── Event delegation ───────────────────────────────────────────────────────────

document.addEventListener('submit', e => {
  if (e.target.id === 'loginForm')    { e.preventDefault(); handleLogin(e.target); }
  if (e.target.id === 'createForm')   { e.preventDefault(); handleCreate(e.target); }
  if (e.target.id === 'addPlayerForm') { e.preventDefault(); handleAddPlayer(e.target); }
  if (e.target.id === 'startGroupSetupForm') { e.preventDefault(); handleStartGroupSetup(e.target); }
  if (e.target.id === 'saveGroupSetupForm') { e.preventDefault(); handleSaveGroupSetup(e.target); }
  if (e.target.id === 'regenerateGroupMatchesForm') { e.preventDefault(); handleGenerateGroupMatches(e.target); }
  if (e.target.id === 'addGroupForm') { e.preventDefault(); handleAddGroup(e.target); }
  if (e.target.id === 'addTeamForm')  { e.preventDefault(); handleAddTeam(e.target); }
  if (e.target.classList.contains('edit-team-form')) { e.preventDefault(); handleEditTeam(e.target); }
  if (e.target.classList.contains('edit-match-form')) { e.preventDefault(); handleEditMatch(e.target); }
  if (e.target.id === 'addMatchForm') { e.preventDefault(); handleAddMatch(e.target); }
  if (e.target.id === 'generateGroupMatchesForm') { e.preventDefault(); handleGenerateGroupMatches(e.target); }
  if (e.target.id === 'generateKnockoutMatchesForm') { e.preventDefault(); handleGenerateKnockoutMatches(e.target); }
  if (e.target.id === 'addMiniQuestionForm') { e.preventDefault(); handleAddMiniQuestion(e.target); }
  if (e.target.classList.contains('edit-mini-question-form')) { e.preventDefault(); handleEditMiniQuestion(e.target); }
});

document.addEventListener('dragstart', e => {
  const teamRow = findTeamRow(e.target);
  if (teamRow && teamRow.dataset.teamGroup) {
    state.draggingTeamId = teamRow.dataset.teamId;
    teamRow.classList.add('team-row-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', teamRow.dataset.teamId);
    }
    return;
  }
  const row = findMatchRow(e.target);
  if (!row || row.dataset.matchPhase !== 'group') return;
  state.draggingMatchId = row.dataset.matchId;
  row.classList.add('match-row-dragging');
  row.closest('tbody[data-match-dropzone="group"]')?.classList.add('match-dropzone-active');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.matchId);
  }
});

document.addEventListener('dragover', e => {
  const teamRow = findTeamRow(e.target);
  if (teamRow && teamRow.dataset.teamGroup) {
    const draggedTeam = state.draggingTeamId
      ? state.teams.find(team => team.team_id === state.draggingTeamId)
      : null;
    if (!draggedTeam || draggedTeam.group_id !== teamRow.dataset.teamGroup) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    highlightTeamDropTarget(teamRow.dataset.teamId);
    return;
  }
  const zone = findGroupDropzone(e.target);
  if (!zone) return;
  const row = findMatchRow(e.target);
  if (row && row.dataset.matchPhase !== 'group') return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  if (row && row.dataset.matchId !== state.draggingMatchId) {
    highlightMatchDropTarget(row.dataset.matchId);
    zone.classList.remove('match-dropzone-active');
  } else {
    highlightMatchDropTarget();
    zone.classList.add('match-dropzone-active');
  }
});

document.addEventListener('drop', e => {
  const teamRow = findTeamRow(e.target);
  if (teamRow && teamRow.dataset.teamGroup) {
    const draggedId = state.draggingTeamId || e.dataTransfer?.getData('text/plain');
    const draggedTeam = draggedId ? state.teams.find(team => team.team_id === draggedId) : null;
    if (!draggedTeam || draggedTeam.group_id !== teamRow.dataset.teamGroup) {
      clearTeamDragState();
      return;
    }
    e.preventDefault();
    clearTeamDragState();
    reorderTeamsInGroup(draggedId, teamRow.dataset.teamId);
    return;
  }
  const zone = findGroupDropzone(e.target);
  if (!zone) return;
  const row = findMatchRow(e.target);
  if (row && row.dataset.matchPhase !== 'group') return;
  e.preventDefault();
  const draggedId = state.draggingMatchId || e.dataTransfer?.getData('text/plain');
  clearMatchDragState();
  if (!draggedId) return;
  reorderGroupMatches(draggedId, row?.dataset.matchId || null);
});

document.addEventListener('dragend', () => {
  clearMatchDragState();
  clearTeamDragState();
});

document.addEventListener('click', e => {
  if (e.target.id === 'logoutBtn')              supabase.auth.signOut().then(refreshAuth);
  if (e.target.id === 'backBtn')                { state.currentPorra = null; state.playerMessage = ''; state.playerTempPasswords = {}; clearGroupSetupDraft(); state.groupSetupCollapsed = false; state.matchSectionCollapsed = false; state.playerSectionCollapsed = false; state.miniSectionCollapsed = false; render(); }
  if (e.target.id === 'advanceStatusBtn')       advancePorraStatus();
  if (e.target.id === 'revertDraftBtn')         revertPorraToDraft();
  if (e.target.id === 'deletePorraBtn')         deletePorra(state.currentPorra?.id);
  if (e.target.id === 'toggleGroupSetupBtn')     toggleGroupSetupCollapsed();
  if (e.target.id === 'toggleMatchSectionBtn')   toggleMatchSectionCollapsed();
  if (e.target.id === 'togglePlayerSectionBtn')  togglePlayerSectionCollapsed();
  if (e.target.id === 'toggleMiniSectionBtn')    toggleMiniSectionCollapsed();
  if (e.target.id === 'cancelGroupSetupBtn')     cancelGroupSetup();
  if (e.target.classList.contains('open-porra')) openPorra(e.target.dataset.id);
  if (e.target.classList.contains('delete-porra')) deletePorra(e.target.dataset.id);
  if (e.target.classList.contains('del-player')) deletePlayer(e.target.dataset.id);
  if (e.target.classList.contains('edit-match'))  startEditMatch(e.target.dataset.id);
  if (e.target.classList.contains('cancel-edit-match')) cancelEditMatch();
  if (e.target.classList.contains('edit-team'))  startEditTeam(e.target.dataset.id);
  if (e.target.classList.contains('cancel-edit-team')) cancelEditTeam();
  if (e.target.classList.contains('del-team'))   deleteTeam(e.target.dataset.id);
  if (e.target.classList.contains('del-group'))  deleteGroup(e.target.dataset.id);
  if (e.target.classList.contains('del-match'))  deleteMatch(e.target.dataset.id);
  if (e.target.id === 'resetGroupMatchesBtn')     resetGroupMatches();
  if (e.target.id === 'resetKnockoutMatchesBtn')  resetKnockoutMatches();
  if (e.target.classList.contains('move-match')) moveMatch(e.target.dataset.id, e.target.dataset.dir);
  if (e.target.classList.contains('edit-mini-question')) startEditMiniQuestion(e.target.dataset.id);
  if (e.target.classList.contains('cancel-edit-mini-question')) cancelEditMiniQuestion();
  if (e.target.classList.contains('del-mini-question')) deleteMiniQuestion(e.target.dataset.id);
  if (e.target.classList.contains('move-mini-question')) moveMiniQuestion(e.target.dataset.id, e.target.dataset.dir);
});

supabase.auth.onAuthStateChange(() => { refreshAuth(); });
refreshAuth();
