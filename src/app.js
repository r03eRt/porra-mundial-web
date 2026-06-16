import { createClient } from '@supabase/supabase-js';
import { normalize, parseScore, signFromScore, statsCountryFlag, statsCountryLabel } from './lib/statistics-utils.js';
import { TEAM_DETAIL_METRICS, calculateTeamStats, getTournamentTeams } from './lib/team-stats.js';
import { buildFinalNotification, buildGoalNotification, collectLiveAlertEvents } from './lib/live-alerts.js';

const DATA = window.PORRA_DATA;
const DEFAULT_API_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const API_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LIVE_ALERTS_POLL_INTERVAL_MS = 60 * 1000;
const SUPABASE_URL = 'https://tsbjhbpdvewqysgmrhci.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw';
const adminParam = new URLSearchParams(window.location.search).get('admin');
const ADMIN_REQUESTED = new URLSearchParams(window.location.search).has('admin')
  && !['0', 'false', 'no'].includes(String(adminParam).toLowerCase());
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const LS_KEYS = {
  mini: 'porra.miniResults.v1',
  apiUrl: 'porra.apiUrl.v1',
  lastUpdate: 'porra.lastUpdate.v1',
  theme: 'porra.theme.v1',
  installDismissedUntil: 'porra.installBanner.dismissedUntil.v1',
  liveAlertsSnapshot: 'porra.liveAlerts.snapshot.v1',
  liveAlertsEnabled: 'porra.liveAlerts.enabled.v1'
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

const state = {
  apiUrl: localStorage.getItem(LS_KEYS.apiUrl) || DEFAULT_API_URL,
  miniResults: loadMiniResults(),
  apiResults: {},
  apiFixtures: [],
  playerRankings: null,
  teamRankings: null,
  statsMode: 'players',
  statsSelections: { players: '', teams: '' },
  statsSearch: { players: '', teams: '' },
  statsExpanded: { players: false, teams: false },
  statsErrors: { players: false, teams: false },
  selectedTeam: '',
  adminUser: null,
  rankingSort: { key: 'position', direction: 'asc' },
  miniRankingSort: { key: 'position', direction: 'asc' },
  activeTab: 'ranking'
};
let apiRefreshInProgress = false;
let dismissedVersion = null;
let serviceWorkerRegistration = null;
let deferredInstallPrompt = null;
let liveAlertsPollTimer = null;
let liveAlertsRefreshInFlight = false;
const INSTALL_BANNER_DISMISS_MS = 3 * 24 * 60 * 60 * 1000;
const LIVE_ALERTS_CACHE_KIND = 'worldcup-2026';
const LIVE_ALERTS_TABLE = 'football_live_cache';

function apiNameFor(team) {
  return DATA.teamAliases[team] || team;
}

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

function teamKey(team) {
  const key = normalize(apiNameFor(team));
  return key === 'USA' ? 'UNITED STATES' : key;
}

function keyForTeams(a, b) {
  return `${teamKey(a)}__${teamKey(b)}`;
}

const TOURNAMENT_TEAM_KEYS = new Set(DATA.matches.flatMap(match => [match.team1, match.team2]).map(teamKey));
const LOCAL_TEAM_BY_KEY = new Map(DATA.matches
  .flatMap(match => [match.team1, match.team2])
  .map(team => [teamKey(team), team]));
const KNOCKOUT_SCORING = {
  DIECISEISAVOS: { label: 'Dieciseisavos', apiRound: 'Round of 32', previousRound: null, points: 3, expected: 32 },
  OCTAVOS: { label: 'Octavos', apiRound: 'Round of 16', previousRound: 'Round of 32', points: 5, expected: 16 },
  CUARTOS: { label: 'Cuartos', apiRound: 'Quarter-final', previousRound: 'Round of 16', points: 7, expected: 8 },
  SEMIS: { label: 'Semifinales', apiRound: 'Semi-final', previousRound: 'Quarter-final', points: 10, expected: 4 },
  FINAL: { label: 'Final', apiRound: 'Final', previousRound: 'Semi-final', points: 12, expected: 2 },
  '1º': { label: 'Campeón', apiRound: null, previousRound: 'Final', points: 15, expected: 1 }
};

function teamLabel(team) {
  return `${TEAM_FLAGS[team] || '🏳️'} ${team}`;
}

const MINI_FIELD_TYPES = {
  Q1: 'player',
  Q2: 'team',
  Q3: 'team',
  Q4: 'team',
  Q5: 'number',
  Q6: 'team',
  Q7: 'team',
  Q8: 'number',
  Q9: 'player',
  Q10: 'player',
  Q11: 'player',
  Q12: 'number',
  Q13: 'number',
  Q14: 'player',
  Q15: 'player'
};

function loadMiniResults() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.mini) || '{}');
  } catch {
    return {};
  }
}

function isAdmin() {
  return ADMIN_REQUESTED && Boolean(state.adminUser);
}

function applyTheme(theme) {
  const selectedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = selectedTheme;
  const button = document.getElementById('themeToggleBtn');
  const lightThemeActive = selectedTheme === 'light';
  const label = lightThemeActive ? 'Activar tema oscuro' : 'Activar tema claro';
  button.querySelector('span').textContent = lightThemeActive ? '🌙' : '☀️';
  button.setAttribute('aria-label', label);
  button.title = label;
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(LS_KEYS.theme, nextTheme);
  applyTheme(nextTheme);
}

async function checkForAppUpdate() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return;
    const latest = await response.json();
    if (!latest.version || latest.version === __APP_VERSION__ || latest.version === dismissedVersion) return;

    document.getElementById('updateToastMessage').textContent = latest.message || 'Hay cambios nuevos en la aplicación.';
    const toast = document.getElementById('updateToast');
    toast.dataset.version = latest.version;
    toast.hidden = false;
  } catch (error) {
    // Version checks are best-effort; GitHub Pages can return the app shell while a deploy is settling.
  }
}

async function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL
    });
    await serviceWorkerRegistration.update();
  } catch (error) {
    console.error('No se pudo registrar la PWA:', error);
  }
}

function loadLiveAlertsSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.liveAlertsSnapshot) || '{}');
  } catch {
    return {};
  }
}

function saveLiveAlertsSnapshot(snapshot) {
  localStorage.setItem(LS_KEYS.liveAlertsSnapshot, JSON.stringify(snapshot || {}));
}

function isLiveAlertsEnabled() {
  return localStorage.getItem(LS_KEYS.liveAlertsEnabled) === '1';
}

function setLiveAlertsEnabled(enabled) {
  localStorage.setItem(LS_KEYS.liveAlertsEnabled, enabled ? '1' : '0');
}

function updateLiveAlertsUi(statusText = '') {
  const button = document.getElementById('liveAlertsBtn');
  const status = document.getElementById('liveAlertsStatus');
  if (!button || !status) return;

  const supported = 'Notification' in window;
  const permission = supported ? Notification.permission : 'unsupported';
  const enabled = isLiveAlertsEnabled();

  if (!supported) {
    button.disabled = true;
    button.textContent = 'Alertas no disponibles';
    status.textContent = 'Este navegador no soporta notificaciones.';
    return;
  }

  if (permission === 'denied') {
    button.disabled = false;
    button.textContent = 'Permiso denegado';
    status.textContent = 'Activa las notificaciones desde el navegador para recibir avisos.';
    return;
  }

  button.disabled = false;
  button.textContent = enabled ? 'Desactivar alertas' : 'Activar alertas';
  status.textContent = statusText || `Permiso: ${permission}. ${enabled
    ? 'Alertas activas. La app comprobará si hay goles y el resultado final.'
    : 'Pide notificaciones para recibir avisos cuando la app esté instalada o abierta.'}`;
}

async function ensureLiveAlertsPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

async function showLiveNotification(payload) {
  if (!serviceWorkerRegistration && 'serviceWorker' in navigator) {
    serviceWorkerRegistration = await navigator.serviceWorker.ready;
  }
  if (!serviceWorkerRegistration || Notification.permission !== 'granted') return;
  await serviceWorkerRegistration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    renotify: true,
    silent: false,
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icon-192.png`
  });
}

async function loadLiveAlertsCache() {
  const { data, error } = await supabase
    .from(LIVE_ALERTS_TABLE)
    .select('kind,payload,updated_at')
    .eq('kind', LIVE_ALERTS_CACHE_KIND)
    .maybeSingle();

  if (error) throw error;
  return data?.payload || null;
}

async function triggerLiveAlertsSync() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-football-live`, {
    method: 'GET',
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : { ok: false, error: await response.text() };

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload;
}

async function triggerSimulatedLiveGoal() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/simulate-football-live`, {
    method: 'GET',
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : { ok: false, error: await response.text() };

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload;
}

async function triggerTestNotification() {
  const permission = await ensureLiveAlertsPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'El navegador ha bloqueado las notificaciones.'
      : 'No se pudo obtener permiso de notificación.');
  }

  const payload = {
    title: 'Prueba de alerta',
    body: 'Esta es una notificación de prueba en local.',
    tag: 'test-notification'
  };

  new Notification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    icon: `${import.meta.env.BASE_URL}icon-192.png`
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        renotify: true,
        silent: false,
        icon: `${import.meta.env.BASE_URL}icon-192.png`,
        badge: `${import.meta.env.BASE_URL}icon-192.png`
      }).catch(error => {
        console.warn('No se pudo mostrar la notificación persistente:', error);
      });
    }).catch(error => {
      console.warn('No se pudo preparar el service worker para la prueba:', error);
    });
  }
}

async function refreshLiveAlerts({ baseline = false } = {}) {
  if (liveAlertsRefreshInFlight || !isLiveAlertsEnabled()) return;
  liveAlertsRefreshInFlight = true;

  try {
    const currentSnapshot = await loadLiveAlertsCache();
    if (!currentSnapshot) return;

    const previousSnapshot = loadLiveAlertsSnapshot();
    if (baseline || !previousSnapshot.matches?.length) {
      saveLiveAlertsSnapshot(currentSnapshot);
      updateLiveAlertsUi();
      return;
    }

    const events = collectLiveAlertEvents(previousSnapshot, currentSnapshot);
    for (const event of events) {
      if (event.type === 'goal') {
        await showLiveNotification(buildGoalNotification(event.match, event.goal));
      } else if (event.type === 'final') {
        await showLiveNotification(buildFinalNotification(event.match));
      }
    }

    saveLiveAlertsSnapshot(currentSnapshot);
    if (events.length) {
      updateLiveAlertsUi(`Se detectaron ${events.length} aviso${events.length === 1 ? '' : 's'} nuevos.`);
    }
  } catch (error) {
    console.error('No se pudieron actualizar las alertas en vivo:', error);
    updateLiveAlertsUi('No se pudieron comprobar las alertas en vivo.');
  } finally {
    liveAlertsRefreshInFlight = false;
  }
}

function startLiveAlertsPolling() {
  if (liveAlertsPollTimer) return;
  liveAlertsPollTimer = setInterval(() => {
    refreshLiveAlerts().catch(() => {});
  }, LIVE_ALERTS_POLL_INTERVAL_MS);
}

function stopLiveAlertsPolling() {
  if (liveAlertsPollTimer) {
    clearInterval(liveAlertsPollTimer);
    liveAlertsPollTimer = null;
  }
}

function setupInstallPrompt() {
  const installBanner = document.getElementById('installBanner');
  const dismissBtn = document.getElementById('dismissInstallBannerBtn');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    installBanner.hidden = true;
    return;
  }

  const dismissedUntil = Number(localStorage.getItem(LS_KEYS.installDismissedUntil) || 0);

  const isDismissed = () => Date.now() < dismissedUntil;
  const updateBannerVisibility = () => {
    installBanner.hidden = !deferredInstallPrompt || isDismissed();
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateBannerVisibility();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    localStorage.removeItem(LS_KEYS.installDismissedUntil);
    installBanner.hidden = true;
  });

  dismissBtn.addEventListener('click', () => {
    localStorage.setItem(LS_KEYS.installDismissedUntil, String(Date.now() + INSTALL_BANNER_DISMISS_MS));
    installBanner.hidden = true;
  });

  updateBannerVisibility();
}

function getResult(match) {
  const api = state.apiResults[match.id];
  if (api && Number.isFinite(api.home) && Number.isFinite(api.away)) return { ...api, source: 'api' };
  return null;
}

function scorePrediction(prediction, result) {
  if (!result) return { points: 0, exact: false, sign: false };
  const p = parseScore(prediction.score);
  if (!p) return { points: 0, exact: false, sign: false };
  const exact = p[0] === result.home && p[1] === result.away;
  const sign = signFromScore(p) === signFromScore([result.home, result.away]);
  return { points: exact ? DATA.meta.scoring.groupExact : (sign ? DATA.meta.scoring.groupSign : 0), exact, sign };
}

function isTournamentTeam(team) {
  return TOURNAMENT_TEAM_KEYS.has(teamKey(team));
}

function winnerFromApiMatch(match) {
  if (!match || !isTournamentTeam(match.team1) || !isTournamentTeam(match.team2)) return null;
  const score = match.score || {};
  const decidingScore = [score.p, score.et, score.ft]
    .find(value => Array.isArray(value) && value.length >= 2 && Number(value[0]) !== Number(value[1]));
  if (!decidingScore) return null;
  return Number(decidingScore[0]) > Number(decidingScore[1]) ? match.team1 : match.team2;
}

function getKnockoutReality() {
  const reality = {};

  for (const [stage, config] of Object.entries(KNOCKOUT_SCORING)) {
    const teams = new Set();

    if (config.apiRound) {
      state.apiFixtures
        .filter(match => match.round === config.apiRound)
        .flatMap(match => [match.team1, match.team2])
        .filter(isTournamentTeam)
        .forEach(team => teams.add(teamKey(team)));
    }

    if (config.previousRound) {
      state.apiFixtures
        .filter(match => match.round === config.previousRound)
        .map(winnerFromApiMatch)
        .filter(Boolean)
        .forEach(team => teams.add(teamKey(team)));
    }

    reality[stage] = {
      ...config,
      teams,
      resolved: teams.size,
      complete: teams.size >= config.expected
    };
  }

  return reality;
}

function calculatePlayerKnockout(playerId, reality = getKnockoutReality()) {
  const breakdown = {};
  let points = 0;

  for (const [stage, stageReality] of Object.entries(reality)) {
    const predictions = DATA.knockoutPredictions
      .filter(prediction => prediction.stage === stage)
      .map(prediction => prediction.predictions[playerId])
      .filter(Boolean);
    const hits = predictions.filter(team => stageReality.teams.has(teamKey(team))).length;
    const stagePoints = hits * stageReality.points;
    breakdown[stage] = { ...stageReality, hits, points: stagePoints };
    points += stagePoints;
  }

  return { points, breakdown };
}

function calculateRanking() {
  const knockoutReality = getKnockoutReality();
  return DATA.players.map(player => {
    const group = DATA.matches.reduce((acc, match) => {
      const result = getResult(match);
      const sc = scorePrediction(match.predictions[player.id], result);
      acc.points += sc.points;
      acc.exacts += sc.exact ? 1 : 0;
      acc.signs += (!sc.exact && sc.sign) ? 1 : 0;
      acc.played += result ? 1 : 0;
      return acc;
    }, { points: 0, exacts: 0, signs: 0, played: 0 });
    const knockout = calculatePlayerKnockout(player.id, knockoutReality);
    return {
      ...player,
      groupPoints: group.points,
      knockoutPoints: knockout.points,
      knockoutBreakdown: knockout.breakdown,
      total: group.points + knockout.points,
      exacts: group.exacts,
      signs: group.signs,
      played: group.played
    };
  }).sort((a,b) => b.total - a.total || b.exacts - a.exacts || b.signs - a.signs || a.name.localeCompare(b.name));
}

function normalizeTeam(value) {
  const aliases = {
    'ARABIA SAUDI': 'A SAUDI',
    'COSTA DE MARFIL': 'C MARFIL',
    'COREA DEL SUR': 'COREA',
    'ESTADOS UNIDOS': 'EEUU',
    'NUEVA ZELANDA': 'N ZELANDA',
    'QATAR': 'CATAR',
    'REPUBLICA CHECA': 'CHEQUIA',
    'R CHECA': 'CHEQUIA',
    'RCHECA': 'CHEQUIA',
    'RD DEL CONGO': 'RD CONGO',
    'REPUBLICA DEMOCRATICA DEL CONGO': 'RD CONGO',
    'CONGO': 'RD CONGO',
    'UZBEKISTAN': 'UZBEKISTAN'
  };
  const normalized = normalize(value).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  return aliases[normalized] || normalized;
}

function scoreMiniAnswer(question, answer, result) {
  if (!result) return { points: 0, correct: false };
  const fieldType = MINI_FIELD_TYPES[question.id];
  const acceptedAnswers = result.split('|').map(value => value.trim()).filter(Boolean);
  let correct = false;

  if (fieldType === 'number') {
    const predicted = String(answer || '').trim();
    const actual = Number(result);
    const minimumMatch = predicted.match(/^\+\s*(\d+)$/);
    correct = Number.isFinite(actual) && (minimumMatch ? actual >= Number(minimumMatch[1]) : Number(predicted) === actual);
  } else if (fieldType === 'team') {
    correct = acceptedAnswers.map(normalizeTeam).includes(normalizeTeam(answer));
  } else {
    correct = acceptedAnswers.map(normalize).includes(normalize(answer));
  }

  return { points: correct ? question.points : 0, correct };
}

function getMiniResult(question) {
  return String(state.miniResults[question.id] || '').trim();
}

function calculateMiniRanking() {
  return DATA.players.map(player => {
    const score = DATA.miniQuestions.reduce((acc, question) => {
      const result = getMiniResult(question);
      const answerScore = scoreMiniAnswer(question, question.answers[player.id], result);
      acc.points += answerScore.points;
      acc.correct += answerScore.correct ? 1 : 0;
      acc.resolved += result ? 1 : 0;
      return acc;
    }, { points: 0, correct: 0, resolved: 0 });
    return { ...player, miniPoints: score.points, miniCorrect: score.correct, miniResolved: score.resolved };
  }).sort((a,b) => b.miniPoints - a.miniPoints || b.miniCorrect - a.miniCorrect || a.name.localeCompare(b.name));
}

function html(strings, ...values) {
  return strings.map((s, i) => s + (values[i] ?? '')).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sortRows(rows, sort) {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const first = a[sort.key];
    const second = b[sort.key];
    const comparison = typeof first === 'string'
      ? first.localeCompare(second, 'es', { sensitivity: 'base' })
      : Number(first) - Number(second);
    return comparison * direction || a.position - b.position;
  });
}

function sortableHeader(table, key, label, sort) {
  const active = sort.key === key;
  const indicator = active ? (sort.direction === 'asc' ? '▲' : '▼') : '';
  const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const directionClass = active ? sort.direction : '';
  return `<th aria-sort="${ariaSort}"><button type="button" class="sort-button ${active ? 'active' : ''} ${directionClass}" data-sort-table="${table}" data-sort-key="${key}"><span>${indicator}</span>${label}</button></th>`;
}

function applyAdminMode() {
  const admin = isAdmin();
  document.querySelectorAll('[data-admin-only]').forEach(element => {
    element.hidden = !admin;
  });
  document.body.classList.toggle('admin-mode', admin);

  const settingsPanel = document.getElementById('settings');
  if (!admin && settingsPanel.classList.contains('active')) {
    document.querySelectorAll('.tab,.panel').forEach(element => element.classList.remove('active'));
    document.querySelector('[data-tab="ranking"]').classList.add('active');
    document.getElementById('ranking').classList.add('active');
  }

  renderAdminAccess();
}

function renderAdminAccess() {
  const container = document.getElementById('adminAccess');
  container.hidden = !ADMIN_REQUESTED;
  if (!ADMIN_REQUESTED) return;

  container.innerHTML = state.adminUser
    ? html`
      <div class="admin-session-row">
        <span class="admin-session">${escapeHtml(state.adminUser.email)}</span>
        <button type="button" data-admin-logout>Cerrar sesión</button>
      </div>
    `
    : html`
      <form id="adminLoginForm" class="admin-login">
        <input name="email" type="email" autocomplete="username" placeholder="Email admin" required />
        <input name="password" type="password" autocomplete="current-password" placeholder="Contraseña" required />
        <button type="submit">Entrar</button>
      </form>
      <span id="adminLoginError" class="admin-login-error" role="alert"></span>
    `;
}

function renderSummary() {
  const played = DATA.matches.filter(getResult).length;
  const ranking = calculateRanking();
  document.getElementById('summaryCards').innerHTML = html`
    <article class="card"><b>${DATA.players.length}</b><span>participantes</span></article>
    <article class="card"><b>${played}/${DATA.matches.length}</b><span>partidos con resultado</span></article>
    <article class="card"><b>${ranking[0] ? `⭐ ${ranking[0].name}` : '-'}</b><span>líder actual</span></article>
    <article class="card"><b>${ranking[0]?.total || 0}</b><span>puntos del líder</span></article>
    <article class="card"><b>${ranking.length ? `💩 ${ranking.at(-1).name}` : '-'}</b><span>el purria</span></article>
  `;
  document.getElementById('lastUpdate').textContent = localStorage.getItem(LS_KEYS.lastUpdate) || 'sin actualizar';
}

function renderRanking() {
  const q = normalize(document.getElementById('rankingSearch').value);
  const medals = ['🥇', '🥈', '🥉'];
  const ranking = calculateRanking();
  const rows = sortRows(ranking
    .map((player, index) => ({ ...player, position: index + 1 }))
    .filter(player => normalize(player.name).includes(q)), state.rankingSort);
  document.getElementById('rankingTable').innerHTML = html`
    <thead><tr>
      ${sortableHeader('ranking', 'position', '#', state.rankingSort)}
      <th>Participante</th>
      ${sortableHeader('ranking', 'total', 'Total', state.rankingSort)}
      ${sortableHeader('ranking', 'groupPoints', '1ª fase', state.rankingSort)}
      ${sortableHeader('ranking', 'exacts', 'Exactos', state.rankingSort)}
      ${sortableHeader('ranking', 'signs', 'Quiniela', state.rankingSort)}
      ${sortableHeader('ranking', 'knockoutPoints', 'Cruces', state.rankingSort)}
    </tr></thead>
    <tbody>${rows.map(player => html`
      <tr class="${player.position <= 3 ? `rank-${player.position}` : ''}">
        <td class="ranking-position">${medals[player.position - 1] || (player.position === ranking.length ? '💩' : player.position)}</td>
        <td>${player.name}</td>
        <td class="points">${player.total}</td>
        <td>${player.groupPoints}</td>
        <td>${player.exacts}</td>
        <td>${player.signs}</td>
        <td>${player.knockoutPoints}</td>
      </tr>`).join('')}</tbody>
  `;
}

function renderFilters() {
  const groupSelect = document.getElementById('groupFilter');
  if (groupSelect.options.length === 1) {
    [...new Set(DATA.matches.map(m => m.group))].forEach(g => groupSelect.insertAdjacentHTML('beforeend', `<option value="${g}">Grupo ${g}</option>`));
  }
  const teamSelect = document.getElementById('teamFilter');
  if (teamSelect.options.length === 1) {
    [...new Set(DATA.matches.flatMap(match => [match.team1, match.team2]))]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .forEach(team => teamSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(team)}">${teamLabel(team)}</option>`));
  }
  const playerSelect = document.getElementById('playerSelect');
  if (!playerSelect.options.length) DATA.players.forEach(p => playerSelect.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`));
  const knockoutPlayerSelect = document.getElementById('knockoutPlayerSelect');
  if (!knockoutPlayerSelect.options.length) DATA.players.forEach(p => knockoutPlayerSelect.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`));
}

function getMatchday(match) {
  const matchNumber = Number(match.id.split('-').pop());
  return Math.ceil(matchNumber / 2);
}

function findApiFixture(match) {
  const team1 = normalize(match.team1);
  const team2 = normalize(match.team2);
  return state.apiFixtures.find(apiMatch => {
    const apiTeam1 = normalize(apiMatch.team1 || apiMatch.homeTeam?.name || apiMatch.homeTeam?.shortName || '');
    const apiTeam2 = normalize(apiMatch.team2 || apiMatch.awayTeam?.name || apiMatch.awayTeam?.shortName || '');
    return (
      (apiTeam1 === team1 && apiTeam2 === team2) ||
      (apiTeam1 === team2 && apiTeam2 === team1)
    );
  }) || null;
}

function formatMatchSchedule(match) {
  const fixture = findApiFixture(match);
  const rawDate = fixture?.utcDate || fixture?.date || null;
  if (!rawDate) return 'Horario pendiente';

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return 'Horario pendiente';

  const hasTime = /T\d{2}:\d{2}/.test(String(rawDate));
  return new Intl.DateTimeFormat('es-ES', hasTime
    ? { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }
    : { dateStyle: 'medium', timeZone: 'Europe/Madrid' }
  ).format(date);
}

function renderMatchCard(match) {
  const result = getResult(match);
  return html`<article class="match-card" role="button" tabindex="0" data-match-id="${match.id}" aria-label="Ver predicciones de ${escapeHtml(match.team1)} contra ${escapeHtml(match.team2)}">
    <span class="pill">Grupo ${match.group} · ${match.id}</span>
    <h3 class="teams"><span>${teamLabel(match.team1)}</span><span class="versus">-</span><span>${teamLabel(match.team2)}</span></h3>
    <div class="match-schedule">${escapeHtml(formatMatchSchedule(match))}</div>
    <div class="match-score ${result ? '' : 'pending'}">${result ? `${result.home} - ${result.away}` : 'Pendiente'}</div>
    <div class="source">${result ? 'Resultado actualizado automáticamente' : 'Sin resultado disponible en la API'} · Ver predicciones</div>
  </article>`;
}

function openMatchPredictions(matchId) {
  const match = DATA.matches.find(item => item.id === matchId);
  if (!match) return;
  const result = getResult(match);
  const dialog = document.getElementById('matchPredictionsDialog');

  document.getElementById('matchPredictionsContent').innerHTML = html`
    <div class="predictions-dialog-head">
      <div>
        <span class="pill">Grupo ${match.group} · ${match.id}</span>
        <h2>${teamLabel(match.team1)} - ${teamLabel(match.team2)}</h2>
        <p class="match-schedule">${escapeHtml(formatMatchSchedule(match))}</p>
        <p>${result ? `Resultado: ${result.home}-${result.away}` : 'Partido pendiente'}</p>
      </div>
      <button type="button" class="dialog-close" data-close-predictions aria-label="Cerrar">×</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Participante</th><th>Predicción</th><th>Quiniela</th><th>Puntos</th></tr></thead>
        <tbody>${DATA.players.map(player => {
          const prediction = match.predictions[player.id];
          const score = scorePrediction(prediction, result);
          return html`
            <tr>
              <td>${escapeHtml(player.name)}</td>
              <td>${escapeHtml(prediction.score)}</td>
              <td>${escapeHtml(prediction.sign)}</td>
              <td class="${score.points ? 'ok' : 'muted'}">${score.points}</td>
            </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  `;

  dialog.showModal();
}

function renderMatches() {
  const group = document.getElementById('groupFilter').value;
  const team = document.getElementById('teamFilter').value;
  const status = document.getElementById('statusFilter').value;
  let matches = DATA.matches.filter(m => group === 'all' || m.group === group);
  matches = matches.filter(match => team === 'all' || match.team1 === team || match.team2 === team);
  matches = matches.filter(m => status === 'all' || (status === 'played' ? !!getResult(m) : !getResult(m)));

  const matchdays = [1, 2, 3]
    .map(number => {
      const matchdayMatches = matches.filter(match => getMatchday(match) === number);
      const groups = [...new Set(matchdayMatches.map(match => match.group))]
        .sort()
        .map(groupName => ({
          name: groupName,
          matches: matchdayMatches.filter(match => match.group === groupName)
        }));
      return { number, matches: matchdayMatches, groups };
    })
    .filter(matchday => matchday.matches.length);

  document.getElementById('matchesList').innerHTML = matchdays.length
    ? matchdays.map(matchday => html`
      <section class="matchday">
        <div class="matchday-head">
          <h3>Jornada ${matchday.number}</h3>
          <span>${matchday.matches.length} partidos</span>
        </div>
        <div class="matchday-groups">
          ${matchday.groups.map(groupBlock => html`
            <section class="match-group">
              <div class="match-group-head">
                <h4>Grupo ${groupBlock.name}</h4>
                <span>${groupBlock.matches.length} partidos</span>
              </div>
              <div class="match-grid">${groupBlock.matches.map(renderMatchCard).join('')}</div>
            </section>
          `).join('')}
        </div>
      </section>
    `).join('')
    : '<p class="empty-state">No hay partidos que coincidan con los filtros.</p>';
}

function getTournamentTeamList() {
  return getTournamentTeams(DATA.matches);
}

function buildTeamChartData(teamStats) {
  return TEAM_DETAIL_METRICS.map(metric => {
    const value = teamStats[metric.key] ?? 0;
    return { ...metric, value };
  });
}

function renderTeamChart(metric, maxValue) {
  const value = Number(metric.value) || 0;
  const percent = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  const inverseBad = metric.key === 'goalsAgainst' || metric.key === 'losses' || metric.key === 'failedToScore';
  return html`
    <article class="team-chart-card">
      <header>
        <h4>${escapeHtml(metric.label)}</h4>
        <span class="metric-value">${typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}</span>
      </header>
      <div class="chart-track" aria-hidden="true">
        <div class="chart-fill ${inverseBad ? 'bad' : ''}" style="width:${percent}%"></div>
      </div>
      <div class="team-detail-subtitle">
        <span>${percent.toFixed(0)}% del máximo del torneo</span>
      </div>
    </article>
  `;
}

function renderTeams() {
  const searchInput = document.getElementById('teamsSearch');
  const select = document.getElementById('teamsSelect');
  const list = document.getElementById('teamsList');
  const detail = document.getElementById('teamDetail');
  const count = document.getElementById('teamsListCount');
  const query = normalize(searchInput.value);
  const teams = getTournamentTeamList();
  const filteredTeams = teams.filter(team => normalize(team).includes(query));

  if (!state.selectedTeam || !teams.includes(state.selectedTeam)) {
    state.selectedTeam = teams[0] || '';
  }
  const selectedTeam = teams.includes(select.value) ? select.value : state.selectedTeam;

  if (!select.dataset.loaded) {
    select.innerHTML = teams.map(team => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`).join('');
    select.dataset.loaded = '1';
  }
  if (select.value !== selectedTeam) select.value = selectedTeam;
  state.selectedTeam = selectedTeam;

  if (list.dataset.teams !== String(teams.length)) {
    list.dataset.teams = String(teams.length);
  }

  const selectedStats = calculateTeamStats(selectedTeam, DATA.matches, getResult);
  const teamProfiles = teams.map(team => calculateTeamStats(team, DATA.matches, getResult));
  const maxByMetric = Object.fromEntries(TEAM_DETAIL_METRICS.map(metric => [
    metric.key,
    Math.max(...teamProfiles.map(profile => Number(profile[metric.key]) || 0), 0)
  ]));
  const selectedMatches = DATA.matches.filter(match => match.team1 === selectedTeam || match.team2 === selectedTeam);
  const recentMatches = selectedMatches.slice(-5).reverse();

  count.textContent = `${filteredTeams.length}/${teams.length}`;
  list.innerHTML = filteredTeams.map(team => {
    return html`
      <button class="team-list-item ${team === selectedTeam ? 'active' : ''}" type="button" data-team-select="${escapeHtml(team)}">
        <span>${teamLabel(team)}</span>
      </button>
    `;
  }).join('');

  const summaryCards = [
    ['Partidos', `${selectedStats.played}/${selectedStats.scheduled}`],
    ['Victorias', selectedStats.wins],
    ['Empates', selectedStats.draws],
    ['Derrotas', selectedStats.losses]
  ];

  detail.innerHTML = selectedTeam
    ? html`
      <div class="team-detail-head">
        <div>
          <h3>${teamLabel(selectedTeam)}</h3>
          <p>Detalle del equipo con estadísticas de la porra y resumen de su rendimiento actual.</p>
        </div>
        <div class="team-detail-subtitle">
          <span>${selectedStats.points} puntos</span>
          <span>${selectedStats.goalsFor} GF</span>
          <span>${selectedStats.goalsAgainst} GC</span>
          <span>${selectedStats.goalDifference >= 0 ? '+' : ''}${selectedStats.goalDifference} DG</span>
        </div>
      </div>
      <div class="team-summary-grid">
        ${summaryCards.map(([label, value]) => html`
          <article class="team-summary-card">
            <span>${label}</span>
            <b>${value}</b>
          </article>
        `).join('')}
      </div>
      <div class="team-chart-grid">
        ${buildTeamChartData(selectedStats).map(metric => renderTeamChart(metric, maxByMetric[metric.key])).join('')}
      </div>
      <div class="section-head">
        <h3>Últimos partidos</h3>
        <p class="hint">Los resultados más recientes de este equipo en la porra.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Partido</th><th>Resultado</th><th>Estado</th></tr></thead>
          <tbody>
            ${recentMatches.length ? recentMatches.map(match => {
              const result = getResult(match);
              const isHome = match.team1 === selectedTeam;
              const opponent = isHome ? match.team2 : match.team1;
              const score = result ? (isHome ? `${result.home}-${result.away}` : `${result.away}-${result.home}`) : 'Pendiente';
              return html`
                <tr>
                  <td>${teamLabel(selectedTeam)} - ${teamLabel(opponent)}</td>
                  <td>${result ? score : '<span class="muted">pendiente</span>'}</td>
                  <td>${result ? 'Jugado' : 'Pendiente'}</td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="3" class="empty-state">Todavía no hay partidos disponibles.</td></tr>'}
          </tbody>
        </table>
      </div>
    `
    : '<div class="team-empty">No hay equipos disponibles.</div>';
}

function calculateGroupStandings(group) {
  const matches = DATA.matches.filter(match => match.group === group);
  const teams = [...new Set(matches.flatMap(match => [match.team1, match.team2]))];
  const standings = teams.map((team, originalIndex) => ({
    team,
    originalIndex,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  }));
  const byTeam = Object.fromEntries(standings.map(team => [team.team, team]));

  for (const match of matches) {
    const result = getResult(match);
    if (!result) continue;

    const home = byTeam[match.team1];
    const away = byTeam[match.team2];
    home.goalsFor += result.home;
    home.goalsAgainst += result.away;
    away.goalsFor += result.away;
    away.goalsAgainst += result.home;

    if (result.home > result.away) {
      home.points += 3;
    } else if (result.home < result.away) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  standings.forEach(team => {
    team.goalDifference = team.goalsFor - team.goalsAgainst;
  });

  return standings.sort((a, b) =>
    b.points - a.points
    || b.goalDifference - a.goalDifference
    || b.goalsFor - a.goalsFor
    || a.originalIndex - b.originalIndex
  );
}

function renderGroupStandings() {
  const groups = [...new Set(DATA.matches.map(match => match.group))].sort();
  document.getElementById('groupStandingsList').innerHTML = groups.map(group => {
    const standings = calculateGroupStandings(group);
    return html`
      <section class="group-standing">
        <h3>Grupo ${group}</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Pos.</th><th>Selección</th><th>GF</th><th>GC</th><th>DG</th><th>Pts.</th></tr>
            </thead>
            <tbody>${standings.map((team, index) => html`
              <tr>
                <td class="group-position">${index + 1}</td>
                <td class="standing-team">${teamLabel(team.team)}</td>
                <td>${team.goalsFor}</td>
                <td>${team.goalsAgainst}</td>
                <td class="${team.goalDifference > 0 ? 'ok' : (team.goalDifference < 0 ? 'bad' : '')}">
                  ${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}
                </td>
                <td class="points">${team.points}</td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>
      </section>`;
  }).join('');
}

function calculateBestThirds() {
  const groups = [...new Set(DATA.matches.map(match => match.group))].sort();
  return groups
    .map((group, groupIndex) => ({
      ...calculateGroupStandings(group)[2],
      group,
      groupIndex
    }))
    .sort((a, b) =>
      b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || a.groupIndex - b.groupIndex
    )
    .slice(0, 8);
}

function renderBestThirds() {
  const bestThirds = calculateBestThirds();
  document.getElementById('bestThirdsTable').innerHTML = html`
    <thead>
      <tr><th>Pos.</th><th>Selección</th><th>Grupo</th><th>GF</th><th>GC</th><th>DG</th><th>Pts.</th></tr>
    </thead>
    <tbody>${bestThirds.map((team, index) => html`
      <tr class="qualified-third">
        <td class="group-position">${index + 1}</td>
        <td class="standing-team">${teamLabel(team.team)}</td>
        <td>${team.group}</td>
        <td>${team.goalsFor}</td>
        <td>${team.goalsAgainst}</td>
        <td class="${team.goalDifference > 0 ? 'ok' : (team.goalDifference < 0 ? 'bad' : '')}">
          ${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}
        </td>
        <td class="points">${team.points}</td>
      </tr>
    `).join('')}</tbody>
  `;
}

function calculateTopScorers() {
  const scorers = new Map();

  for (const match of state.apiFixtures) {
    const teamGoals = [
      [match.team1, match.goals1],
      [match.team2, match.goals2]
    ];

    for (const [apiTeam, goals] of teamGoals) {
      if (!Array.isArray(goals)) continue;
      const team = LOCAL_TEAM_BY_KEY.get(teamKey(apiTeam)) || apiTeam;

      for (const goal of goals) {
        if (!goal?.name || goal.owngoal) continue;
        const scorerKey = `${normalize(goal.name)}__${teamKey(apiTeam)}`;
        const scorer = scorers.get(scorerKey) || { name: goal.name, team, goals: 0 };
        scorer.goals += 1;
        scorers.set(scorerKey, scorer);
      }
    }
  }

  return [...scorers.values()]
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'es'))
    .slice(0, 8);
}

function renderTopScorers() {
  const scorers = calculateTopScorers();
  document.getElementById('topScorersTable').innerHTML = scorers.length
    ? html`
      <thead><tr><th>Pos.</th><th>Jugador</th><th>Selección</th><th>Goles</th></tr></thead>
      <tbody>${scorers.map((scorer, index) => html`
        <tr>
          <td class="group-position">${index + 1}</td>
          <td class="scorer-name">${escapeHtml(scorer.name)}</td>
          <td class="standing-team">${teamLabel(scorer.team)}</td>
          <td class="points scorer-goals">${scorer.goals}</td>
        </tr>
      `).join('')}</tbody>
    `
    : '<tbody><tr><td class="empty-state">Todavía no hay goleadores disponibles.</td></tr></tbody>';
}

function getStatsDataset(mode = state.statsMode) {
  return mode === 'teams' ? state.teamRankings : state.playerRankings;
}

function statsRowText(row) {
  return [row.position, ...(row.raw || [])].join(' ');
}

function formatStatsCountryCell(value) {
  const label = statsCountryLabel(value);
  const flag = statsCountryFlag(label);
  return `<span class="stats-country"><span class="stats-flag">${flag}</span><span>${escapeHtml(label)}</span></span>`;
}

function renderStatistics() {
  const table = document.getElementById('statsTable');
  const select = document.getElementById('statsRankingSelect');
  const meta = document.getElementById('statsMeta');
  const search = document.getElementById('statsSearch');
  const toggleRows = document.getElementById('statsToggleRows');
  const countHint = document.getElementById('statsCountHint');
  const mode = state.statsMode;
  const config = STATS_CONFIG[mode];
  const dataset = getStatsDataset(mode);
  const rankings = dataset?.rankings || [];

  document.querySelectorAll('[data-stats-mode]').forEach(button => {
    const active = button.dataset.statsMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  search.placeholder = config.searchPlaceholder;

  if (!dataset) {
    meta.textContent = state.statsErrors[mode] ? config.errorText : config.loadingText;
    select.innerHTML = '';
    table.innerHTML = `<tbody><tr><td class="empty-state">${escapeHtml(state.statsErrors[mode] ? config.errorText : 'Cargando estadísticas.')}</td></tr></tbody>`;
    countHint.textContent = '';
    toggleRows.hidden = true;
    return;
  }

  if (select.dataset.mode !== mode) {
    select.dataset.mode = mode;
    select.innerHTML = '';
    rankings.forEach(ranking => {
      select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(ranking.slug)}">${escapeHtml(ranking.label)}</option>`);
    });
    const savedSelection = state.statsSelections[mode];
    select.value = rankings.some(ranking => ranking.slug === savedSelection)
      ? savedSelection
      : (rankings[0]?.slug || '');
  }

  const selected = rankings.find(ranking => ranking.slug === select.value) || rankings[0];
  if (!selected) {
    meta.textContent = `No hay rankings de ${config.label.toLowerCase()} disponibles.`;
    table.innerHTML = '<tbody><tr><td class="empty-state">No hay estadísticas disponibles.</td></tr></tbody>';
    return;
  }

  if (select.value !== selected.slug) select.value = selected.slug;
  state.statsSelections[mode] = selected.slug;

  if (search.dataset.mode !== mode) {
    search.dataset.mode = mode;
    search.value = state.statsSearch[mode] || '';
  } else if (search.value !== state.statsSearch[mode]) {
    search.value = state.statsSearch[mode] || '';
  }

  const q = normalize(search.value);
  const rows = selected.rows.filter(row => !q || normalize(statsRowText(row)).includes(q));
  const visibleRows = state.statsExpanded[mode] ? rows : rows.slice(0, 10);
  const updatedAt = dataset.scrapedAt
    ? new Date(dataset.scrapedAt).toLocaleString('es-ES')
    : 'sin fecha';
  const hasMoreRows = rows.length > visibleRows.length;

  meta.innerHTML = html`
    ${config.label}: ${rankings.length} rankings · ${selected.rows.length} registros en este ranking · Actualizado: ${escapeHtml(updatedAt)}
    · <a href="${escapeHtml(selected.url)}" target="_blank" rel="noopener">ver fuente</a>
  `;
  countHint.textContent = rows.length
    ? `Mostrando ${visibleRows.length} de ${rows.length} filas${q ? ' filtradas' : ''}.`
    : 'No hay filas para mostrar.';
  toggleRows.hidden = !hasMoreRows && !state.statsExpanded[mode];
  toggleRows.textContent = state.statsExpanded[mode] ? 'Ver menos' : 'Ver todo';

  table.innerHTML = visibleRows.length
    ? html`
      <thead>
        <tr>
          ${selected.headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${visibleRows.map(row => html`
        <tr>
          ${selected.headers.map((_, index) => {
            const cell = row.raw?.[index] ?? '';
            const displayCell = mode === 'players' && index === 2
              ? formatStatsCountryCell(cell)
              : mode === 'teams' && index === 1
                ? formatStatsCountryCell(cell)
                : escapeHtml(cell);
            return `<td>${displayCell}</td>`;
          }).join('')}
        </tr>
      `).join('')}</tbody>
    `
    : `<tbody><tr><td class="empty-state">No hay ${config.label.toLowerCase()} que coincidan con la búsqueda.</td></tr></tbody>`;
}

function renderPlayerDetail() {
  const playerId = document.getElementById('playerSelect').value || DATA.players[0].id;
  const groups = [...new Set(DATA.matches.map(match => match.group))].sort();

  document.getElementById('playerGroups').innerHTML = groups.map(group => {
    const matches = DATA.matches.filter(match => match.group === group);
    const groupPoints = matches.reduce((total, match) => {
      return total + scorePrediction(match.predictions[playerId], getResult(match)).points;
    }, 0);

    return html`
      <section class="player-group">
        <div class="player-group-head">
          <h3>Grupo ${group}</h3>
          <span>${groupPoints} puntos</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Partido</th><th>Resultado</th><th>Predicción</th><th>Quiniela</th><th>Puntos</th></tr></thead>
            <tbody>${matches.map(match => {
              const result = getResult(match);
              const prediction = match.predictions[playerId];
              const score = scorePrediction(prediction, result);
              return html`
                <tr>
                  <td>${teamLabel(match.team1)} - ${teamLabel(match.team2)}</td>
                  <td>${result ? `${result.home}-${result.away}` : '<span class="muted">pendiente</span>'}</td>
                  <td>${prediction.score}</td>
                  <td>${prediction.sign}</td>
                  <td class="${score.points ? 'ok' : 'muted'}">${score.points}</td>
                </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </section>`;
  }).join('');
}

function knockoutPredictionStatus(team, stageReality) {
  if (!team || !stageReality.resolved) return 'pending';
  if (stageReality.teams.has(teamKey(team))) return 'correct';
  return stageReality.complete ? 'wrong' : 'pending';
}

function renderBracketTeam(team, status = 'pending') {
  const statusMark = status === 'correct' ? '✓' : (status === 'wrong' ? '×' : '');
  return `<div class="bracket-team ${status}"><span class="bracket-flag">${TEAM_FLAGS[team] || '🏳️'}</span><span>${escapeHtml(team || 'Por definir')}</span><span class="bracket-status">${statusMark}</span></div>`;
}

function renderBracketRound(stage, playerId, stageScore) {
  const teams = DATA.knockoutPredictions
    .filter(prediction => prediction.stage === stage)
    .sort((a, b) => a.slot - b.slot)
    .map(prediction => prediction.predictions[playerId] || '');

  const matches = [];
  for (let index = 0; index < teams.length; index += 2) {
    matches.push(html`
      <article class="bracket-match">
        <span class="bracket-match-number">Cruce ${index / 2 + 1}</span>
        ${renderBracketTeam(teams[index], knockoutPredictionStatus(teams[index], stageScore))}
        ${renderBracketTeam(teams[index + 1], knockoutPredictionStatus(teams[index + 1], stageScore))}
      </article>
    `);
  }

  return html`
    <section class="bracket-round" style="--matches:${matches.length}">
      <div class="bracket-round-head">
        <h3>${stageScore.label}</h3>
        <span>${stageScore.hits} aciertos · +${stageScore.points} pts</span>
        <small>${stageScore.resolved}/${stageScore.expected} selecciones confirmadas</small>
      </div>
      <div class="bracket-matches">${matches.join('')}</div>
    </section>
  `;
}

function renderKnockout() {
  const playerId = document.getElementById('knockoutPlayerSelect').value || DATA.players[0].id;
  const player = DATA.players.find(item => item.id === playerId) || DATA.players[0];
  const champion = DATA.knockoutPredictions.find(prediction => prediction.stage === '1º')?.predictions[playerId] || '';
  const knockout = calculatePlayerKnockout(playerId);
  const rounds = ['DIECISEISAVOS', 'OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'];
  const championScore = knockout.breakdown['1º'];

  document.getElementById('knockoutScoreSummary').innerHTML = html`
    <article class="knockout-total">
      <b>${knockout.points}</b>
      <span>puntos en cruces</span>
    </article>
    ${Object.entries(knockout.breakdown).map(([, score]) => html`
      <article>
        <strong>${score.label}</strong>
        <span>${score.hits} aciertos · +${score.points} pts</span>
      </article>
    `).join('')}
  `;

  document.getElementById('knockoutBracket').innerHTML = html`
    <div class="bracket-title">
      <span>Pronóstico de</span>
      <strong>${escapeHtml(player.name)}</strong>
    </div>
    <div class="bracket">
      ${rounds.map(stage => renderBracketRound(stage, playerId, knockout.breakdown[stage])).join('')}
      <section class="bracket-round champion-round">
        <div class="bracket-round-head">
          <h3>Campeón</h3>
          <span>${championScore.hits} aciertos · +${championScore.points} pts</span>
          <small>${championScore.resolved}/${championScore.expected} confirmado</small>
        </div>
        <div class="bracket-matches">
          <article class="bracket-match champion-card">
            <span class="trophy" aria-hidden="true">★</span>
            ${renderBracketTeam(champion, knockoutPredictionStatus(champion, championScore))}
          </article>
        </div>
      </section>
    </div>
  `;
}

function renderQuestionInput(question, result, dataAttribute) {
  const escapedResult = escapeHtml(result);
  const fieldType = MINI_FIELD_TYPES[question.id];
  const readOnly = isAdmin() ? '' : ' readonly aria-readonly="true"';
  if (fieldType === 'number') {
    return `<input type="number" min="0" step="1" inputmode="numeric" ${dataAttribute}="${question.id}" value="${escapedResult}" placeholder="Cantidad"${readOnly} />`;
  }
  if (fieldType === 'team') {
    return `<input type="text" list="teamOptions" ${dataAttribute}="${question.id}" value="${escapedResult}" placeholder="Selección"${readOnly} />`;
  }
  return `<input type="text" ${dataAttribute}="${question.id}" value="${escapedResult}" placeholder="Jugador o variantes"${readOnly} />`;
}

function questionFieldLabel(question) {
  const labels = { number: 'Cantidad', team: 'Selección', player: 'Jugador' };
  return labels[MINI_FIELD_TYPES[question.id]];
}

function renderMini() {
  const q = normalize(document.getElementById('miniRankingSearch').value);
  const ranking = calculateMiniRanking();
  const rows = sortRows(ranking
    .map((player, index) => ({ ...player, position: index + 1 }))
    .filter(player => normalize(player.name).includes(q)), state.miniRankingSort);
  const resolved = DATA.miniQuestions.filter(getMiniResult).length;
  const maxPoints = DATA.miniQuestions.reduce((total, question) => total + question.points, 0);

  document.getElementById('miniResultsHint').innerHTML = isAdmin()
    ? 'Puedes indicar variantes o empates con <strong>|</strong>.'
    : 'Resultados visibles en modo consulta. Solo el administrador puede modificarlos.';

  document.getElementById('teamOptions').innerHTML = [...new Set(DATA.matches.flatMap(match => [match.team1, match.team2]))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map(team => `<option value="${escapeHtml(team)}"></option>`)
    .join('');

  document.getElementById('miniSummaryCards').innerHTML = html`
    <article class="card"><b>${resolved}/${DATA.miniQuestions.length}</b><span>preguntas resueltas</span></article>
    <article class="card"><b>${ranking[0]?.name || '-'}</b><span>líder mini-porra</span></article>
    <article class="card"><b>${ranking[0]?.miniPoints || 0}</b><span>puntos del líder</span></article>
    <article class="card"><b>${maxPoints}</b><span>puntos máximos</span></article>
  `;

  document.getElementById('miniRankingTable').innerHTML = html`
    <thead><tr>
      ${sortableHeader('mini', 'position', '#', state.miniRankingSort)}
      <th>Participante</th>
      ${sortableHeader('mini', 'miniPoints', 'Puntos', state.miniRankingSort)}
      ${sortableHeader('mini', 'miniCorrect', 'Aciertos', state.miniRankingSort)}
      ${sortableHeader('mini', 'miniResolved', 'Corregidas', state.miniRankingSort)}
    </tr></thead>
    <tbody>${rows.map(player => html`
      <tr class="${player.position === 1 ? 'rank-1' : player.position === 2 ? 'rank-2' : ''}">
        <td>${player.position}</td>
        <td>${player.name}</td>
        <td class="points">${player.miniPoints}</td>
        <td>${player.miniCorrect}</td>
        <td>${player.miniResolved}/${DATA.miniQuestions.length}</td>
      </tr>`).join('')}
    </tbody>
  `;

  document.getElementById('miniResultsList').innerHTML = DATA.miniQuestions.map(question => html`
    <article class="mini-result-card">
      <div>
        <span class="pill">${question.id} · ${question.points} puntos</span>
        <h4>${question.question}</h4>
        <span class="field-type">${questionFieldLabel(question)}</span>
      </div>
      <div class="mini-result-actions">
        ${renderQuestionInput(question, getMiniResult(question), 'data-mini-result')}
        ${isAdmin() ? html`
          <button data-save-mini="${question.id}">Guardar</button>
          <button data-clear-mini="${question.id}">Limpiar</button>
        ` : ''}
      </div>
    </article>
  `).join('');

  document.getElementById('miniTable').innerHTML = html`
    <thead><tr><th>Pregunta</th><th>Resultado</th><th>Puntos</th>${DATA.players.map(p=>`<th>${p.name}</th>`).join('')}</tr></thead>
    <tbody>${DATA.miniQuestions.map(question => {
      const result = getMiniResult(question);
      return html`<tr>
        <td>${question.question}</td>
        <td>${result ? escapeHtml(result) : '<span class="muted">pendiente</span>'}</td>
        <td>${question.points}</td>
        ${DATA.players.map(player => {
          const answer = question.answers[player.id] || '';
          const score = scoreMiniAnswer(question, answer, result);
          return `<td class="${result ? (score.correct ? 'ok' : 'muted') : ''}">${escapeHtml(answer)}${score.correct ? ` (+${score.points})` : ''}</td>`;
        }).join('')}
      </tr>`;
    }).join('')}</tbody>`;
}

function renderSettings() {
  document.getElementById('apiUrlInput').value = state.apiUrl;
}

function renderAll() { renderSummary(); renderFilters(); renderRanking(); renderMatches(); renderTeams(); renderStatistics(); renderGroupStandings(); renderBestThirds(); renderTopScorers(); renderPlayerDetail(); renderKnockout(); renderMini(); renderSettings(); }

async function loadMiniResultsFromSupabase() {
  const { data, error } = await supabase
    .from('mini_results')
    .select('question_id,value');

  if (error) {
    console.error('No se pudieron cargar los resultados de la mini-porra desde Supabase:', error);
    return;
  }

  state.miniResults = Object.fromEntries(data.map(row => [row.question_id, row.value]));
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  renderMini();
}

async function loadStatsRankings() {
  const loadLocalRankings = async () => {
    const fetchRanking = async path => {
      const response = await fetch(`${import.meta.env.BASE_URL}${path}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    };

    const [players, teams] = await Promise.allSettled([
      fetchRanking('data/as-player-rankings.json'),
      fetchRanking('data/as-team-rankings.json')
    ]);

    return {
      players: players.status === 'fulfilled' ? players.value : null,
      teams: teams.status === 'fulfilled' ? teams.value : null,
      source: 'local'
    };
  };

  const loadSupabaseCache = async () => {
    const { data, error } = await supabase
      .from('as_rankings_cache')
      .select('kind,payload,updated_at');

    if (error) throw error;

    const byKind = Object.fromEntries((data || []).map(row => [row.kind, row]));
    return {
      players: byKind.players?.payload || null,
      teams: byKind.teams?.payload || null,
      source: 'supabase'
    };
  };

  let payload;
  try {
    payload = await loadSupabaseCache();
  } catch (error) {
    console.warn('No se pudo leer el cache de Supabase, usando JSON local:', error);
    payload = await loadLocalRankings();
  }

  if (!payload.players || !payload.teams) {
    const localPayload = await loadLocalRankings();
    payload.players ||= localPayload.players;
    payload.teams ||= localPayload.teams;
    payload.source = payload.source === 'supabase' ? 'supabase + local fallback' : 'local';
  }

  if (payload.players) {
    state.playerRankings = payload.players;
    state.statsErrors.players = false;
  } else {
    state.statsErrors.players = true;
    console.error('No se pudieron cargar los rankings de jugadores.');
  }

  if (payload.teams) {
    state.teamRankings = payload.teams;
    state.statsErrors.teams = false;
  } else {
    state.statsErrors.teams = true;
    console.error('No se pudieron cargar los rankings de equipos.');
  }

  renderStatistics();
}

async function refreshStatsRankings() {
  const button = document.getElementById('statsRefreshBtn');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Actualizando...';

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-as-rankings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY
      },
      body: '{}'
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    await loadStatsRankings();
    alert('Estadísticas actualizadas.');
  } catch (error) {
    console.error('No se pudo forzar el refresco de estadísticas:', error);
    alert('No se pudo forzar el refresco de estadísticas: ' + error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

async function initializeAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error('No se pudo recuperar la sesión de administrador:', error);
  state.adminUser = data.session?.user || null;
  applyAdminMode();
  renderAll();

  supabase.auth.onAuthStateChange((_event, session) => {
    state.adminUser = session?.user || null;
    applyAdminMode();
    renderAll();
  });
}

async function refreshFromApi(options = {}) {
  const silent = options?.silent === true;
  if (apiRefreshInProgress) return;
  apiRefreshInProgress = true;
  const btn = document.getElementById('refreshApiBtn');
  btn.disabled = true; btn.textContent = 'Actualizando...';
  try {
    const res = await fetch(state.apiUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.apiFixtures = json.matches || [];
    const resultByKey = {};
    for (const apiMatch of state.apiFixtures) {
      if (!apiMatch.score?.ft) continue;
      resultByKey[keyForTeams(apiMatch.team1, apiMatch.team2)] = {
        home: Number(apiMatch.score.ft[0]),
        away: Number(apiMatch.score.ft[1]),
        date: apiMatch.date || apiMatch.utcDate || null,
        utcDate: apiMatch.utcDate || apiMatch.date || null
      };
    }
    state.apiResults = {};
    for (const m of DATA.matches) {
      const found = resultByKey[keyForTeams(m.team1, m.team2)];
      if (found) state.apiResults[m.id] = found;
    }
    localStorage.setItem(LS_KEYS.lastUpdate, new Date().toLocaleString('es-ES'));
    renderAll();
  } catch (err) {
    if (!silent) alert('No se pudieron actualizar los resultados automáticos. Error: ' + err.message);
    console.error('Error al actualizar los resultados automáticos:', err);
  } finally {
    apiRefreshInProgress = false;
    btn.disabled = false;
    btn.textContent = 'Actualizar datos';
  }
}

async function saveMiniResult(id) {
  if (!isAdmin()) return;
  const result = document.querySelector(`[data-mini-result="${id}"]`).value.trim();
  if (!result) return alert('Introduce la respuesta correcta.');

  const { error } = await supabase
    .from('mini_results')
    .upsert({ question_id: id, value: result, updated_at: new Date().toISOString() });
  if (error) return alert('No se pudo guardar el resultado: ' + error.message);

  state.miniResults[id] = result;
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  renderAll();
}

async function clearMiniResult(id) {
  if (!isAdmin()) return;
  const { error } = await supabase
    .from('mini_results')
    .delete()
    .eq('question_id', id);
  if (error) return alert('No se pudo limpiar el resultado: ' + error.message);

  delete state.miniResults[id];
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  renderAll();
}

document.addEventListener('click', e => {
  const teamSelectButton = e.target.closest('[data-team-select]');
  if (teamSelectButton) {
    state.selectedTeam = teamSelectButton.dataset.teamSelect;
    const select = document.getElementById('teamsSelect');
    select.value = state.selectedTeam;
    renderTeams();
    document.getElementById('teamDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const statsModeButton = e.target.closest('[data-stats-mode]');
  if (statsModeButton) {
    state.statsMode = statsModeButton.dataset.statsMode;
    renderStatistics();
    return;
  }

  const sortButton = e.target.closest('[data-sort-table]');
  if (sortButton) {
    const sortState = sortButton.dataset.sortTable === 'ranking' ? state.rankingSort : state.miniRankingSort;
    const key = sortButton.dataset.sortKey;
    if (sortState.key === key) {
      sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.key = key;
      sortState.direction = 'asc';
    }
    sortButton.dataset.sortTable === 'ranking' ? renderRanking() : renderMini();
    return;
  }

  const matchCard = e.target.closest('[data-match-id]');
  if (matchCard) {
    openMatchPredictions(matchCard.dataset.matchId);
    return;
  }
  if (e.target.matches('[data-close-predictions]')) {
    document.getElementById('matchPredictionsDialog').close();
    return;
  }

  const tab = e.target.closest('.tab');
  if (tab) {
    document.querySelectorAll('.tab,.panel').forEach(el => el.classList.remove('active'));
    tab.classList.add('active'); document.getElementById(tab.dataset.tab).classList.add('active');
  }
  const saveMini = e.target.dataset.saveMini; if (saveMini) saveMiniResult(saveMini);
  const clearMini = e.target.dataset.clearMini; if (clearMini) clearMiniResult(clearMini);
  if (e.target.matches('[data-admin-logout]')) supabase.auth.signOut();
});

document.addEventListener('keydown', e => {
  const matchCard = e.target.closest?.('[data-match-id]');
  if (matchCard && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openMatchPredictions(matchCard.dataset.matchId);
  }
});

document.getElementById('matchPredictionsDialog').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});

document.addEventListener('submit', async e => {
  if (e.target.id !== 'adminLoginForm') return;
  e.preventDefault();
  const submitButton = e.target.querySelector('button[type="submit"]');
  const errorElement = document.getElementById('adminLoginError');
  const formData = new FormData(e.target);
  submitButton.disabled = true;
  errorElement.textContent = '';

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email'),
    password: formData.get('password')
  });

  if (error) {
    errorElement.textContent = 'Email o contraseña incorrectos.';
    submitButton.disabled = false;
  }
});

document.getElementById('refreshApiBtn').addEventListener('click', refreshFromApi);
document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
document.getElementById('liveAlertsBtn').addEventListener('click', async () => {
  const permission = await ensureLiveAlertsPermission();
  if (permission !== 'granted') {
    setLiveAlertsEnabled(false);
    updateLiveAlertsUi(permission === 'denied'
      ? 'Has bloqueado las notificaciones del navegador.'
      : 'No se han activado las alertas.');
    stopLiveAlertsPolling();
    return;
  }

  const enabled = !isLiveAlertsEnabled();
  setLiveAlertsEnabled(enabled);
  updateLiveAlertsUi();

  if (enabled) {
    await refreshLiveAlerts({ baseline: true });
    startLiveAlertsPolling();
  } else {
    stopLiveAlertsPolling();
    localStorage.removeItem(LS_KEYS.liveAlertsSnapshot);
  }
});
document.getElementById('testNotificationBtn').addEventListener('click', async () => {
  try {
    await triggerTestNotification();
    updateLiveAlertsUi('Prueba de notificación enviada.');
    alert('Notificación de prueba enviada.');
  } catch (error) {
    console.error('No se pudo lanzar la notificación de prueba:', error);
    alert('No se pudo lanzar la notificación de prueba: ' + error.message);
  }
});
document.getElementById('runLiveAlertsBtn').addEventListener('click', async () => {
  if (!isAdmin()) return;
  const button = document.getElementById('runLiveAlertsBtn');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Enviando...';
  try {
    const result = await triggerLiveAlertsSync();
    updateLiveAlertsUi(`Cron lanzado. ${result.live || 0} en juego, ${result.finished || 0} finalizados.`);
    if (isLiveAlertsEnabled()) {
      await refreshLiveAlerts();
    }
  } catch (error) {
    console.error('No se pudo forzar el cron de alertas:', error);
    alert('No se pudo forzar el cron de alertas: ' + error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
document.getElementById('simulateLiveGoalBtn').addEventListener('click', async () => {
  if (!isAdmin()) return;
  const button = document.getElementById('simulateLiveGoalBtn');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Simulando...';
  try {
    const result = await triggerSimulatedLiveGoal();
    updateLiveAlertsUi(`Gol simulado: ${result.matchId} (${result.goals} goles).`);
    if (isLiveAlertsEnabled()) {
      await refreshLiveAlerts();
    }
  } catch (error) {
    console.error('No se pudo simular el gol de prueba:', error);
    alert('No se pudo simular el gol de prueba: ' + error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  localStorage.removeItem(LS_KEYS.installDismissedUntil);
  document.getElementById('installBanner').hidden = true;
});
document.getElementById('reloadAppBtn').addEventListener('click', () => {
  const toast = document.getElementById('updateToast');
  const url = new URL(window.location.href);
  url.searchParams.set('version', toast.dataset.version?.slice(0, 8) || Date.now());
  window.location.replace(url);
});
document.getElementById('dismissUpdateBtn').addEventListener('click', () => {
  const toast = document.getElementById('updateToast');
  dismissedVersion = toast.dataset.version;
  toast.hidden = true;
});
document.getElementById('rankingSearch').addEventListener('input', renderRanking);
document.getElementById('miniRankingSearch').addEventListener('input', renderMini);
document.getElementById('groupFilter').addEventListener('change', renderMatches);
document.getElementById('teamFilter').addEventListener('change', renderMatches);
document.getElementById('statusFilter').addEventListener('change', renderMatches);
document.getElementById('teamsSearch').addEventListener('input', renderTeams);
document.getElementById('teamsSelect').addEventListener('change', e => {
  state.selectedTeam = e.target.value;
  renderTeams();
});
document.getElementById('playerSelect').addEventListener('change', renderPlayerDetail);
document.getElementById('knockoutPlayerSelect').addEventListener('change', renderKnockout);
document.getElementById('statsRankingSelect').addEventListener('change', e => {
  state.statsSelections[state.statsMode] = e.target.value;
  state.statsExpanded[state.statsMode] = false;
  renderStatistics();
});
document.getElementById('statsSearch').addEventListener('input', e => {
  state.statsSearch[state.statsMode] = e.target.value;
  renderStatistics();
});
document.getElementById('statsToggleRows').addEventListener('click', () => {
  state.statsExpanded[state.statsMode] = !state.statsExpanded[state.statsMode];
  renderStatistics();
});
document.getElementById('statsRefreshBtn').addEventListener('click', () => {
  if (!isAdmin()) return;
  refreshStatsRankings();
});
document.getElementById('saveApiUrlBtn').addEventListener('click', () => {
  if (!isAdmin()) return;
  state.apiUrl = document.getElementById('apiUrlInput').value.trim() || DEFAULT_API_URL;
  localStorage.setItem(LS_KEYS.apiUrl, state.apiUrl);
  alert('URL guardada');
});
document.getElementById('exportBtn').addEventListener('click', () => {
  if (!isAdmin()) return;
  const blob = new Blob([JSON.stringify({ miniResults: state.miniResults, apiUrl: state.apiUrl }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'porra-estado.json'; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById('importInput').addEventListener('change', async e => {
  if (!isAdmin()) return;
  const file = e.target.files[0]; if (!file) return;
  const json = JSON.parse(await file.text());
  state.miniResults = json.miniResults || state.miniResults;
  state.apiUrl = json.apiUrl || state.apiUrl;

  const rows = Object.entries(state.miniResults).map(([question_id, value]) => ({
    question_id,
    value,
    updated_at: new Date().toISOString()
  }));
  if (rows.length) {
    const { error } = await supabase.from('mini_results').upsert(rows);
    if (error) return alert('No se pudieron importar los resultados: ' + error.message);
  }

  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  localStorage.setItem(LS_KEYS.apiUrl, state.apiUrl);
  renderAll();
});

applyTheme(document.documentElement.dataset.theme);
applyAdminMode();
updateLiveAlertsUi();
renderAll();
refreshFromApi();
loadMiniResultsFromSupabase();
loadStatsRankings();
initializeAuth();
registerPwa();
setupInstallPrompt();
checkForAppUpdate();
startLiveAlertsPolling();
refreshLiveAlerts({ baseline: true });
setInterval(() => refreshFromApi({ silent: true }), API_REFRESH_INTERVAL_MS);
setInterval(checkForAppUpdate, VERSION_CHECK_INTERVAL_MS);
window.addEventListener('focus', checkForAppUpdate);
window.addEventListener('focus', () => refreshLiveAlerts().catch(() => {}));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForAppUpdate();
    refreshLiveAlerts().catch(() => {});
  }
});
