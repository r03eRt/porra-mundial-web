import { createClient } from '@supabase/supabase-js';
import { KNOCKOUT_STAGES, buildPlayerKnockoutBracket } from './lib/knockout-bracket.js';
import { calculateBestCurrentStreak, calculateMostChosenPrediction, historyPositionChange, pickNextPendingMatch, scorePrediction } from './lib/porra-core.js';
import { normalize, parseScore, playerNamesMatch, statsCountryFlag, statsCountryLabel } from './lib/statistics-utils.js';
import { TEAM_DETAIL_METRICS, calculateTeamStats, getTournamentTeams } from './lib/team-stats.js';
import { simulateProbabilities } from './lib/probabilities.js';

const DATA = window.PORRA_DATA;
const DEFAULT_API_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const API_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const API_FETCH_TIMEOUT_MS = 10000;
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const API_RESUME_REFRESH_THRESHOLD_MS = 2 * 60 * 1000;
const PWA_ENABLED = false;
const SUPABASE_URL = 'https://tsbjhbpdvewqysgmrhci.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw';
const WORLDCUP_RESULTS_TABLE = 'worldcup_results_cache';
const WORLDCUP_RESULTS_KIND = 'openfootball-2026';
const AS_LIVE_MATCH_TABLE = 'as_live_match_cache';
const AS_LIVE_MATCH_KIND = 'worldcup-2026';
const AS_LIVE_MATCH_ACTIVE_REFRESH_MS = 90 * 1000;
const AS_LIVE_MATCH_IDLE_REFRESH_MS = 15 * 60 * 1000;
const AS_LIVE_MATCH_FETCH_TIMEOUT_MS = 15000;
const AS_LIVE_MATCH_FINAL_GRACE_MS = 5 * 60 * 1000;
const AS_LIVE_MATCH_UI_TICK_MS = 30 * 1000;
const adminParam = new URLSearchParams(window.location.search).get('admin');
const ADMIN_REQUESTED = new URLSearchParams(window.location.search).has('admin')
  && !['0', 'false', 'no'].includes(String(adminParam).toLowerCase());
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const LS_KEYS = {
  mini: 'porra.miniResults.v1',
  apiUrl: 'porra.apiUrl.v1',
  apiResults: 'porra.apiResults.v1',
  apiFixtures: 'porra.apiFixtures.v1',
  apiRefreshAt: 'porra.apiRefreshAt.v1',
  lastUpdate: 'porra.lastUpdate.v1',
  softAlertsSnapshot: 'porra.softAlerts.snapshot.v1',
  softAlertsSeen: 'porra.softAlerts.seen.v1',
  goalAlertSnapshot: 'porra.goalAlertSnapshot.v1',
  liveNotificationsEnabled: 'porra.liveNotifications.enabled.v1',
  theme: 'porra.theme.v1',
  installDismissedUntil: 'porra.installBanner.dismissedUntil.v1'
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
  apiResults: loadStoredJson(LS_KEYS.apiResults, {}),
  apiFixtures: loadStoredJson(LS_KEYS.apiFixtures, []),
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
  activeTab: 'ranking',
  rankingLoading: !Object.keys(loadStoredJson(LS_KEYS.apiResults, {})).length,
  probabilities: null,
  probabilitiesKey: '',
  probabilitiesError: '',
  probabilitiesExpanded: { players: false, teams: false, mini: false },
  groupStandingsView: 'actual',
  matchGoalsExpanded: {},
  compareMatchId: '',
  comparePlayers: [],
  historyCheckpointId: ''
  ,
  asLiveMatch: null
};
let apiRefreshInProgress = false;
let asLiveMatchRefreshInProgress = false;
let dismissedVersion = null;
let serviceWorkerRegistration = null;
let deferredInstallPrompt = null;
let appToastTimer = null;
let appToastQueueTimer = null;
let liveEventToastQueueTimer = null;
let asLiveMatchRefreshTimer = null;
let lastApiRefreshAt = Number(localStorage.getItem(LS_KEYS.apiRefreshAt) || 0);
let lastAsLiveMatchRefreshAt = 0;
let lastVersionCheckAt = 0;
let lastResumeRefreshAt = 0;
const INSTALL_BANNER_DISMISS_MS = 3 * 24 * 60 * 60 * 1000;

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
const LOCAL_MATCH_BY_FIXTURE_KEY = new Map(DATA.matches
  .map(match => [keyForTeams(match.team1, match.team2), match]));
const MATCH_ORDER_INDEX = new Map(DATA.matches
  .map((match, index) => [match.id, index]));
const CHAMPION_PREDICTIONS_BY_PLAYER = DATA.knockoutPredictions
  .filter(prediction => prediction.stage === '1º')
  .reduce((acc, prediction) => Object.assign(acc, prediction.predictions || {}), {});
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

function championPredictionFor(playerId) {
  return CHAMPION_PREDICTIONS_BY_PLAYER[playerId] || '';
}

function teamFlag(team) {
  return TEAM_FLAGS[team] || '🏳️';
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

function loadStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function persistApiCache() {
  localStorage.setItem(LS_KEYS.apiResults, JSON.stringify(state.apiResults || {}));
  localStorage.setItem(LS_KEYS.apiFixtures, JSON.stringify(state.apiFixtures || []));
  localStorage.setItem(LS_KEYS.apiRefreshAt, String(lastApiRefreshAt || 0));
}

function applyResultsPayload(payload, { updatedAt } = {}) {
  state.apiFixtures = Array.isArray(payload?.matches) ? payload.matches : [];
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
  for (const match of DATA.matches) {
    const found = resultByKey[keyForTeams(match.team1, match.team2)];
    if (found) state.apiResults[match.id] = found;
  }
  lastApiRefreshAt = updatedAt ? new Date(updatedAt).getTime() || Date.now() : Date.now();
  persistApiCache();
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = API_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Timeout al cargar datos tras ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isAdmin() {
  return Boolean(state.adminUser);
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
  const now = Date.now();
  if (now - lastVersionCheckAt < 15000) return;
  lastVersionCheckAt = now;
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
  if (!PWA_ENABLED) return;
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

async function disablePwa() {
  const installBanner = document.getElementById('installBanner');
  if (installBanner) installBanner.hidden = true;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));

    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys
        .filter(key => key.startsWith('porrazo-'))
        .map(key => caches.delete(key)));
    }
  } catch (error) {
    console.warn('No se pudo desactivar la PWA antigua:', error);
  }
}

function showAppToast(message, duration = 2400) {
  const toast = document.getElementById('appToast');
  const text = document.getElementById('appToastMessage');
  if (!toast || !text) return;

  text.textContent = message;
  toast.hidden = false;

  if (appToastTimer) clearTimeout(appToastTimer);
  appToastTimer = setTimeout(() => {
    toast.hidden = true;
    appToastTimer = null;
  }, duration);
}

function canUseGoalNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function areLiveNotificationsEnabled() {
  return localStorage.getItem(LS_KEYS.liveNotificationsEnabled) === '1';
}

function setLiveNotificationsEnabled(enabled) {
  localStorage.setItem(LS_KEYS.liveNotificationsEnabled, enabled ? '1' : '0');
}

function updateGoalNotificationsButton() {
  const button = document.getElementById('goalNotificationsBtn');
  if (!button) return;
  if (!canUseGoalNotifications()) {
    button.hidden = true;
    return;
  }

  button.hidden = false;
  const permission = Notification.permission;
  const enabled = areLiveNotificationsEnabled();
  if (permission === 'granted') {
    button.textContent = `Avisos partido: ${enabled ? 'ON' : 'OFF'}`;
    button.title = enabled ? 'Desactivar notificaciones del directo' : 'Activar notificaciones del directo';
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  } else if (permission === 'denied') {
    button.textContent = 'Avisos partido: bloqueados';
    button.title = 'El navegador ha bloqueado las notificaciones';
    button.setAttribute('aria-pressed', 'false');
  } else {
    button.textContent = 'Activar avisos partido';
    button.title = 'Permitir notificaciones de inicio, goles y final';
    button.setAttribute('aria-pressed', 'false');
  }
}

async function requestGoalNotificationsPermission() {
  if (!canUseGoalNotifications()) {
    showAppToast('Este navegador no soporta notificaciones.');
    return;
  }

  if (Notification.permission === 'granted') {
    const enabled = !areLiveNotificationsEnabled();
    setLiveNotificationsEnabled(enabled);
    showAppToast(enabled ? 'Avisos del partido activados.' : 'Avisos del partido desactivados.');
    updateGoalNotificationsButton();
    return;
  }

  if (Notification.permission === 'denied') {
    showAppToast('Las notificaciones están bloqueadas en el navegador.');
    updateGoalNotificationsButton();
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    setLiveNotificationsEnabled(true);
  }
  updateGoalNotificationsButton();
  showAppToast(permission === 'granted' ? 'Avisos del partido activados.' : 'No se activaron los avisos del partido.');
}

function buildGoalAlertSnapshot(payload) {
  const match = payload?.match;
  if (!match || !Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore)) return null;

  return {
    matchId: match.id || '',
    homeTeam: match.homeTeam || '',
    awayTeam: match.awayTeam || '',
    homeScore: Number(match.homeScore),
    awayScore: Number(match.awayScore),
    live: Boolean(payload?.live),
    scorerSummary: match.scorerSummary || '',
    status: match.status || '',
    headline: match.headline || ''
  };
}

function isHalftimeStatus(status) {
  const normalizedStatus = String(status || '').toLowerCase();
  return normalizedStatus.includes('descanso') || normalizedStatus.includes('intermedio');
}

function loadGoalAlertSnapshot() {
  return loadStoredJson(LS_KEYS.goalAlertSnapshot, null);
}

function saveGoalAlertSnapshot(snapshot) {
  if (!snapshot) {
    localStorage.removeItem(LS_KEYS.goalAlertSnapshot);
    return;
  }
  localStorage.setItem(LS_KEYS.goalAlertSnapshot, JSON.stringify(snapshot));
}

function buildGoalAlertEvents(previousSnapshot, nextSnapshot) {
  if (!previousSnapshot || !nextSnapshot) return [];

  const events = [];
  const sameMatch = previousSnapshot.matchId && previousSnapshot.matchId === nextSnapshot.matchId;

  if (!previousSnapshot.live && nextSnapshot.live) {
    events.push({
      title: 'Empieza el partido',
      message: `${nextSnapshot.homeTeam} - ${nextSnapshot.awayTeam} ya está en juego.`,
      detail: nextSnapshot.headline || ''
    });
  }

  if (sameMatch) {
    if (
      previousSnapshot.live
      && nextSnapshot.live
      && !isHalftimeStatus(previousSnapshot.status)
      && isHalftimeStatus(nextSnapshot.status)
    ) {
      events.push({
        title: 'Descanso',
        message: `Descanso en ${nextSnapshot.homeTeam} - ${nextSnapshot.awayTeam}: ${nextSnapshot.homeScore}-${nextSnapshot.awayScore}.`,
        detail: nextSnapshot.headline || ''
      });
    }

    const homeDelta = nextSnapshot.homeScore - previousSnapshot.homeScore;
    const awayDelta = nextSnapshot.awayScore - previousSnapshot.awayScore;
    const totalDelta = homeDelta + awayDelta;

    if (homeDelta >= 0 && awayDelta >= 0 && totalDelta > 0) {
      const teamLabel = homeDelta > 0 && awayDelta > 0
        ? `${nextSnapshot.homeTeam} y ${nextSnapshot.awayTeam}`
        : (homeDelta > 0 ? nextSnapshot.homeTeam : nextSnapshot.awayTeam);
      const prefix = totalDelta > 1 ? 'Goles' : 'Gol';
      events.push({
        title: prefix,
        message: `${prefix} de ${teamLabel}: ${nextSnapshot.homeTeam} ${nextSnapshot.homeScore}-${nextSnapshot.awayScore} ${nextSnapshot.awayTeam}.`,
        detail: nextSnapshot.scorerSummary || ''
      });
    }

    if (previousSnapshot.live && !nextSnapshot.live) {
      events.push({
        title: 'Final del partido',
        message: `${nextSnapshot.homeTeam} ${nextSnapshot.homeScore}-${nextSnapshot.awayScore} ${nextSnapshot.awayTeam}.`,
        detail: nextSnapshot.headline || ''
      });
    }
  }

  return events;
}

function notifyGoalAlert(event) {
  if (!event?.message) return;

  if (!areLiveNotificationsEnabled()) return;

  showAppToast(event.message, 4200);

  if (!canUseGoalNotifications() || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;

  try {
    const notification = new Notification(event.title || 'Aviso del partido', {
      body: event.detail ? `${event.message} ${event.detail}` : event.message,
      tag: `goal-alert:${Date.now()}`,
      silent: false
    });
    notification.onclick = () => window.focus();
  } catch (error) {
    console.warn('No se pudo mostrar la notificación de gol:', error);
  }
}

function enqueueLiveEventNotifications(events) {
  if (!events.length) return;

  if (liveEventToastQueueTimer) {
    clearTimeout(liveEventToastQueueTimer);
    liveEventToastQueueTimer = null;
  }

  const queue = events.slice(0, 3);
  const showNext = index => {
    if (index >= queue.length) {
      liveEventToastQueueTimer = null;
      return;
    }
    notifyGoalAlert(queue[index]);
    liveEventToastQueueTimer = setTimeout(() => showNext(index + 1), 3000);
  };

  showNext(0);
}

function processGoalAlertPayload(payload) {
  const nextSnapshot = buildGoalAlertSnapshot(payload);
  const previousSnapshot = loadGoalAlertSnapshot();
  const events = buildGoalAlertEvents(previousSnapshot, nextSnapshot);
  enqueueLiveEventNotifications(events);
  saveGoalAlertSnapshot(nextSnapshot);
}

function loadSoftAlertSnapshot() {
  return loadStoredJson(LS_KEYS.softAlertsSnapshot, null);
}

function saveSoftAlertSnapshot(snapshot) {
  localStorage.setItem(LS_KEYS.softAlertsSnapshot, JSON.stringify(snapshot));
}

function loadSeenSoftAlerts() {
  const stored = loadStoredJson(LS_KEYS.softAlertsSeen, []);
  return Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : [];
}

function saveSeenSoftAlerts(ids) {
  localStorage.setItem(LS_KEYS.softAlertsSeen, JSON.stringify(ids.slice(-80)));
}

function buildSoftAlertSnapshot() {
  const ranking = calculateRanking();
  return {
    leaderId: ranking[0]?.id || '',
    leaderName: ranking[0]?.name || '',
    leaderPoints: ranking[0]?.total || 0,
    results: Object.fromEntries(DATA.matches
      .map(match => {
        const result = getResult(match);
        return result ? [match.id, `${result.home}-${result.away}`] : null;
      })
      .filter(Boolean)),
    playedMatches: DATA.matches.filter(getResult).length
  };
}

function buildSoftAlertEvents(previousSnapshot, nextSnapshot) {
  if (!previousSnapshot?.results) return [];

  const previousResults = previousSnapshot.results || {};
  const nextResults = nextSnapshot.results || {};
  const events = [];

  const finishedMatches = DATA.matches.filter(match => !previousResults[match.id] && nextResults[match.id]);
  if (finishedMatches.length) {
    const firstMatch = finishedMatches[0];
    const score = nextResults[firstMatch.id];
    const extraCount = finishedMatches.length - 1;
    const summary = extraCount > 0 ? ` y ${extraCount} más` : '';
    events.push({
      id: `match-finished:${finishedMatches.map(match => `${match.id}:${nextResults[match.id]}`).join('|')}`,
      message: `Final: ${firstMatch.team1} ${score} ${firstMatch.team2}${summary}.`
    });
  }

  if (
    previousSnapshot.leaderId
    && nextSnapshot.leaderId
    && previousSnapshot.leaderId !== nextSnapshot.leaderId
  ) {
    events.push({
      id: `leader-changed:${nextSnapshot.leaderId}:${nextSnapshot.leaderPoints}`,
      message: `Nuevo líder de la porra: ${nextSnapshot.leaderName} con ${nextSnapshot.leaderPoints} puntos.`
    });
  }

  const resultsChanged = previousSnapshot.playedMatches !== nextSnapshot.playedMatches
    || Object.keys(previousResults).length !== Object.keys(nextResults).length
    || Object.entries(nextResults).some(([matchId, score]) => previousResults[matchId] !== score);

  if (resultsChanged) {
    events.push({
      id: `ranking-updated:${nextSnapshot.playedMatches}:${nextSnapshot.leaderId}:${nextSnapshot.leaderPoints}`,
      message: 'Clasificación actualizada según los últimos resultados.'
    });
  }

  return events;
}

function enqueueSoftAlertToasts(events) {
  if (!events.length) return;

  const seen = loadSeenSoftAlerts();
  const unseenEvents = events.filter(event => !seen.includes(event.id));
  if (!unseenEvents.length) return;

  saveSeenSoftAlerts([...seen, ...unseenEvents.map(event => event.id)]);

  if (appToastQueueTimer) {
    clearTimeout(appToastQueueTimer);
    appToastQueueTimer = null;
  }

  const queue = unseenEvents.slice(0, 3);
  const showNext = index => {
    if (index >= queue.length) {
      appToastQueueTimer = null;
      return;
    }
    showAppToast(queue[index].message);
    appToastQueueTimer = setTimeout(() => showNext(index + 1), 2800);
  };

  showNext(0);
}

function processSoftAlerts() {
  const previousSnapshot = loadSoftAlertSnapshot();
  const nextSnapshot = buildSoftAlertSnapshot();
  const events = buildSoftAlertEvents(previousSnapshot, nextSnapshot);
  saveSoftAlertSnapshot(nextSnapshot);
  enqueueSoftAlertToasts(events);
}

function setupInstallPrompt() {
  const installBanner = document.getElementById('installBanner');
  if (!PWA_ENABLED) {
    installBanner.hidden = true;
    return;
  }
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
  const api = getResultFromMap(match, state.apiResults);
  if (api) return { ...api, source: 'api' };
  return null;
}

function getResultFromMap(match, resultsMap = {}) {
  const api = resultsMap?.[match.id];
  if (api && Number.isFinite(api.home) && Number.isFinite(api.away)) return { ...api, source: 'api' };
  return null;
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

function getKnockoutRealityFromFixtures(fixtures = state.apiFixtures) {
  const reality = {};

  for (const [stage, config] of Object.entries(KNOCKOUT_SCORING)) {
    const teams = new Set();

    if (config.apiRound) {
      fixtures
        .filter(match => match.round === config.apiRound)
        .flatMap(match => [match.team1, match.team2])
        .filter(isTournamentTeam)
        .forEach(team => teams.add(teamKey(team)));
    }

    if (config.previousRound) {
      fixtures
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

function getKnockoutReality() {
  return getKnockoutRealityFromFixtures(state.apiFixtures);
}

function calculatePlayerKnockoutFromReality(playerId, reality) {
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

function calculatePlayerKnockout(playerId, reality = getKnockoutReality()) {
  return calculatePlayerKnockoutFromReality(playerId, reality);
}

function calculateRankingFromData(resultsMap = state.apiResults, fixtures = state.apiFixtures) {
  const knockoutReality = getKnockoutRealityFromFixtures(fixtures);
  return DATA.players.map(player => {
    const group = DATA.matches.reduce((acc, match) => {
      const result = getResultFromMap(match, resultsMap);
      const sc = scorePrediction(match.predictions[player.id], result, DATA.meta.scoring);
      acc.points += sc.points;
      acc.exacts += sc.exact ? 1 : 0;
      acc.signs += (!sc.exact && sc.sign) ? 1 : 0;
      acc.played += result ? 1 : 0;
      return acc;
    }, { points: 0, exacts: 0, signs: 0, played: 0 });
    const knockout = calculatePlayerKnockoutFromReality(player.id, knockoutReality);
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

function calculateRanking() {
  return calculateRankingFromData(state.apiResults, state.apiFixtures);
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
    correct = acceptedAnswers.some(value => playerNamesMatch(answer, value));
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

function sortableHeader(table, key, label, sort, className = '') {
  const active = sort.key === key;
  const indicator = active ? (sort.direction === 'asc' ? '▲' : '▼') : '';
  const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const directionClass = active ? sort.direction : '';
  return `<th class="${className}" aria-sort="${ariaSort}"><button type="button" class="sort-button ${className} ${active ? 'active' : ''} ${directionClass}" data-sort-table="${table}" data-sort-key="${key}"><span>${indicator}</span>${label}</button></th>`;
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
  const shouldShowAdminAccess = ADMIN_REQUESTED || Boolean(state.adminUser);
  container.hidden = !shouldShowAdminAccess;
  if (!shouldShowAdminAccess) return;

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

function formatRelativeUpdateTime(timestamp) {
  if (!timestamp) return 'sin actualizar';
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'hace menos de 1 min';
  if (diffMinutes === 1) return 'hace 1 min';
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return 'hace 1 h';
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? 'hace 1 día' : `hace ${diffDays} días`;
}

function renderHeaderSyncStatus() {
  const headerLastUpdate = document.getElementById('headerLastUpdate');
  if (!headerLastUpdate) return;

  const lastUpdateLabel = localStorage.getItem(LS_KEYS.lastUpdate) || 'sin actualizar';
  const hasCachedResults = Object.keys(state.apiResults || {}).length > 0;
  const sourceLabel = apiRefreshInProgress
    ? 'Actualizando resultados...'
    : (hasCachedResults ? 'Mostrando resultados guardados y sincronizados' : 'Pendiente de cargar resultados');
  const freshnessLabel = lastApiRefreshAt
    ? `${formatRelativeUpdateTime(lastApiRefreshAt)}`
    : 'sin datos en caché';

  headerLastUpdate.innerHTML = html`
    <strong>${escapeHtml(sourceLabel)}</strong>
    <br />
    <span>Última actualización: ${escapeHtml(lastUpdateLabel)} · ${escapeHtml(freshnessLabel)}</span>
  `;
}

function getAsLiveMatchRefreshIntervalMs() {
  return isAsLiveMatchVisible(state.asLiveMatch) ? AS_LIVE_MATCH_ACTIVE_REFRESH_MS : AS_LIVE_MATCH_IDLE_REFRESH_MS;
}

function getAsLiveMinuteBadge(payload) {
  const match = payload?.match;
  if (!payload?.live || !match) {
    return match?.minuteLabel || (Number.isFinite(match?.minute) ? String(match.minute) : '');
  }

  const baseMinute = Number.isFinite(match?.minute) ? Number(match.minute) : null;
  const baseLabel = match?.minuteLabel || (baseMinute !== null ? String(baseMinute) : '');
  if (baseMinute === null) {
    return baseLabel;
  }

  const updatedAtMs = payload?.updatedAt ? new Date(payload.updatedAt).getTime() : NaN;
  if (!Number.isFinite(updatedAtMs)) {
    return baseLabel;
  }

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - updatedAtMs) / 60000));
  const liveMinute = Math.min(130, baseMinute + elapsedMinutes);
  return String(liveMinute);
}

function isAsLiveMatchVisible(payload) {
  if (!payload?.match) return false;
  if (payload.live) return true;
  if (!payload.showUntil) return false;
  const showUntilTs = new Date(payload.showUntil).getTime();
  return Number.isFinite(showUntilTs) && showUntilTs > Date.now();
}

function findLocalMatchForAsLiveMatch(match) {
  if (!match?.homeTeam || !match?.awayTeam) return null;

  const normalizedHome = normalizeTeam(match.homeTeam);
  const normalizedAway = normalizeTeam(match.awayTeam);

  return DATA.matches.find(item => (
    normalizeTeam(item.team1) === normalizedHome
    && normalizeTeam(item.team2) === normalizedAway
  )) || null;
}

function getAsLiveMatchFallbackResult(match) {
  const payload = state.asLiveMatch;
  if (!payload?.match || payload.live) return null;

  const localMatch = findLocalMatchForAsLiveMatch(payload.match);
  if (!localMatch || localMatch.id !== match?.id) return null;
  if (!Number.isFinite(payload.match.homeScore) || !Number.isFinite(payload.match.awayScore)) return null;

  return {
    home: Number(payload.match.homeScore),
    away: Number(payload.match.awayScore),
    source: 'as-live-fallback'
  };
}

function getResultForNextMatchFallback(match) {
  return getResult(match) || getAsLiveMatchFallbackResult(match);
}

function renderAsLiveMatchCard() {
  const payload = state.asLiveMatch;
  const match = payload?.match || null;
  const articleUrl = match?.articleUrl || '';
  const localMatch = findLocalMatchForAsLiveMatch(match);
  const isVisible = isAsLiveMatchVisible(payload);
  const isLive = Boolean(payload?.live && match);
  const isFinal = Boolean(match && isVisible && !isLive);
  const freshLabel = payload?.updatedAt
    ? formatRelativeUpdateTime(new Date(payload.updatedAt).getTime())
    : 'sin actualizar';

  if (!match || !isVisible) {
    return '';
  }

  const liveMinuteLabel = getAsLiveMinuteBadge(payload);
  const liveBadge = isLive ? (liveMinuteLabel ? `${liveMinuteLabel}'` : (match.status || 'En juego')) : 'Final';
  const summaryLine = match.scorerSummary || 'Abrir directo en AS';
  const headline = match.headline || `${match.homeTeam} - ${match.awayTeam}`;
  const cardAttributes = localMatch
    ? `role="button" tabindex="0" data-match-id="${localMatch.id}" aria-label="Ver predicciones de ${escapeHtml(localMatch.team1)} contra ${escapeHtml(localMatch.team2)}"`
    : (articleUrl ? `role="button" tabindex="0" data-external-url="${escapeHtml(articleUrl)}" aria-label="Abrir directo de AS de ${escapeHtml(match.homeTeam)} contra ${escapeHtml(match.awayTeam)}"` : '');

  return html`
    <article
      class="card live-match-card ${localMatch ? 'summary-match-card' : (articleUrl ? 'summary-external-card' : '')}"
      ${cardAttributes}
    >
      <div class="live-match-top">
        <span class="live-match-chip ${isLive ? 'is-live' : ''}">${isLive ? '<span class="live-match-dot" aria-hidden="true"></span>En directo' : 'Resultado final'}</span>
        <span class="live-match-chip">AS · ${escapeHtml(match.group || 'Mundial')}</span>
      </div>
      <div class="live-match-scoreline">
        <span>${escapeHtml(match.homeTeam)}</span>
        <strong>${match.homeScore} - ${match.awayScore}</strong>
        <span>${escapeHtml(match.awayTeam)}</span>
      </div>
      <div class="live-match-meta">
        <span class="live-match-minute">${escapeHtml(liveBadge)}</span>
        <span>${escapeHtml(freshLabel)}</span>
      </div>
      <b>${escapeHtml(headline)}</b>
      <span>${escapeHtml(summaryLine)}</span>
      <span class="card-detail">
        ${localMatch ? 'Toca para ver todas las predicciones' : 'Actualizacion automatica desde AS'}
        ${isFinal ? ` · visible 5 min tras el final` : ''}
        ${articleUrl ? ` · <button type="button" class="match-link-button" data-external-url="${escapeHtml(articleUrl)}" aria-label="Abrir directo de AS">Abrir AS</button>` : ''}
      </span>
    </article>
  `;
}

function renderSummary() {
  const played = DATA.matches.filter(getResult).length;
  const ranking = calculateRanking();
  const lastUpdate = localStorage.getItem(LS_KEYS.lastUpdate) || 'sin actualizar';
  const nextMatch = pickNextPendingMatch(DATA.matches, getResultForNextMatchFallback, getMatchScheduleTimestamp);
  const hasLiveMatch = isAsLiveMatchVisible(state.asLiveMatch);
  const bestStreak = calculateBestCurrentStreak(
    DATA.players,
    DATA.matches.filter(match => getResult(match)).sort(compareMatchesForDisplay),
    (match, player) => match.predictions[player.id],
    match => getResult(match),
    DATA.meta.scoring
  );
  const mostChosenPrediction = nextMatch ? calculateMostChosenPrediction(nextMatch, DATA.players) : null;
  document.getElementById('summaryCards').innerHTML = html`
    ${renderAsLiveMatchCard()}
    ${hasLiveMatch ? '' : html`
      <article class="card next-match-card ${nextMatch ? 'summary-match-card' : ''}" ${nextMatch ? `role="button" tabindex="0" data-match-id="${nextMatch.id}" aria-label="Ver predicciones de ${escapeHtml(nextMatch.team1)} contra ${escapeHtml(nextMatch.team2)}"` : ''}>
        <b>${nextMatch ? `${TEAM_FLAGS[nextMatch.team1] || '🏳️'} ${nextMatch.team1}<span class="next-match-separator">-</span>${TEAM_FLAGS[nextMatch.team2] || '🏳️'} ${nextMatch.team2}` : '-'}</b>
        <span>${nextMatch ? 'siguiente partido' : 'sin partidos pendientes'}</span>
        <span class="card-detail">${nextMatch ? formatMatchSchedule(nextMatch) : ''}</span>
        <span class="card-detail">${mostChosenPrediction ? `Pronóstico más elegido: ${mostChosenPrediction.score} · ${mostChosenPrediction.votes} voto${mostChosenPrediction.votes === 1 ? '' : 's'}` : ''}</span>
      </article>
    `}
    <article class="card"><b>${played}/${DATA.matches.length}</b><span>partidos con resultado</span></article>
    <article class="card"><b>${ranking[0] ? `⭐ ${ranking[0].name}` : '-'}</b><span>líder actual</span></article>
    <article class="card"><b>${ranking[0]?.total || 0}</b><span>puntos del líder</span></article>
    <article class="card"><b>${ranking.length ? `💩 ${ranking[ranking.length - 1].name}` : '-'}</b><span>el purria</span></article>
    <article class="card">
      <b>${bestStreak ? `🔥 ${bestStreak.player.name}` : '-'}</b>
      <span>${bestStreak ? 'mejor racha actual' : 'sin rachas activas'}</span>
      <span class="card-detail">${bestStreak ? `${bestStreak.streak} acierto${bestStreak.streak === 1 ? '' : 's'} seguido${bestStreak.streak === 1 ? '' : 's'}` : ''}</span>
    </article>
  `;
  renderHeaderSyncStatus();
  document.getElementById('lastUpdate').textContent = lastUpdate;
}

function renderRanking() {
  if (state.rankingLoading && !Object.keys(state.apiResults).length) {
    document.getElementById('rankingTable').innerHTML = html`
      <tbody>
        <tr>
          <td class="loading-cell">
            <span class="loading-spinner" aria-hidden="true"></span>
            <span>Cargando clasificación...</span>
          </td>
        </tr>
      </tbody>
    `;
    return;
  }

  const q = normalize(document.getElementById('rankingSearch').value);
  const medals = ['🥇', '🥈', '🥉'];
  const ranking = calculateRanking();
  const historySnapshots = buildHistoricalSnapshots();
  const previousSnapshot = historySnapshots.length > 1 ? historySnapshots[historySnapshots.length - 2] : null;
  const rows = sortRows(ranking
    .map((player, index) => ({
      ...player,
      position: index + 1,
      hits: player.signs + player.exacts,
      championPick: championPredictionFor(player.id)
    }))
    .filter(player => normalize(player.name).includes(q)), state.rankingSort);
  document.getElementById('rankingTable').innerHTML = html`
    <thead><tr>
      ${sortableHeader('ranking', 'position', '#', state.rankingSort, 'table-center')}
      <th class="table-center">Mov.</th>
      <th>Participante</th>
      ${sortableHeader('ranking', 'total', 'Total', state.rankingSort, 'table-center')}
      ${sortableHeader('ranking', 'groupPoints', '1ª fase', state.rankingSort, 'table-center')}
      ${sortableHeader('ranking', 'exacts', 'Exactos', state.rankingSort, 'table-center')}
      ${sortableHeader('ranking', 'hits', 'Aciertos', state.rankingSort, 'table-center')}
      ${sortableHeader('ranking', 'knockoutPoints', 'Cruces', state.rankingSort, 'table-center')}
      ${sortableHeader('ranking', 'championPick', 'Campeón', state.rankingSort, 'table-center')}
    </tr></thead>
    <tbody>${rows.map(player => {
      const movement = historyPositionChange(player, previousSnapshot);
      return html`
      <tr class="${player.position <= 3 ? `rank-${player.position}` : ''}">
        <td class="ranking-position">${medals[player.position - 1] || (player.position === ranking.length ? '💩' : player.position)}</td>
        <td class="table-center ${movement.className}" title="${movement.label}">${movement.symbol}${movement.delta ? ` ${movement.delta}` : ''}</td>
        <td>${player.name}</td>
        <td class="table-center points">${player.total}</td>
        <td class="table-center">${player.groupPoints}</td>
        <td class="table-center">${player.exacts}</td>
        <td class="table-center">${player.signs + player.exacts}</td>
        <td class="table-center">${player.knockoutPoints}</td>
        <td class="table-center" title="${player.championPick ? escapeHtml(player.championPick) : 'Sin campeón'}">${player.championPick ? escapeHtml(teamFlag(player.championPick)) : '-'}</td>
      </tr>`;
    }).join('')}</tbody>
  `;
}

function buildHistoricalSnapshots() {
  const playedEntries = state.apiFixtures
    .map(fixture => {
      if (!Array.isArray(fixture?.score?.ft) || fixture.score.ft.length < 2) return null;
      const match = LOCAL_MATCH_BY_FIXTURE_KEY.get(keyForTeams(fixture.team1, fixture.team2));
      if (!match) return null;

      return {
        fixture,
        match,
        result: {
          home: Number(fixture.score.ft[0]),
          away: Number(fixture.score.ft[1]),
          date: fixture.date || fixture.utcDate || null,
          utcDate: fixture.utcDate || fixture.date || null
        },
        timestamp: parseApiFixtureDateTime(fixture)?.getTime() || Number.POSITIVE_INFINITY
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const timeDiff = a.timestamp - b.timestamp;
      if (timeDiff) return timeDiff;
      return (MATCH_ORDER_INDEX.get(a.match.id) || 0) - (MATCH_ORDER_INDEX.get(b.match.id) || 0);
    });

  const cumulativeResults = {};
  const cumulativeFixtures = [];

  return playedEntries.map((entry, index) => {
    cumulativeResults[entry.match.id] = entry.result;
    cumulativeFixtures.push(entry.fixture);

    const ranking = calculateRankingFromData(cumulativeResults, cumulativeFixtures)
      .map((player, position) => ({ ...player, position: position + 1 }));

    return {
      id: entry.match.id,
      order: index + 1,
      match: entry.match,
      fixture: entry.fixture,
      result: entry.result,
      ranking,
      leader: ranking[0] || null,
      playedMatches: index + 1
    };
  });
}

function historyCheckpointLabel(snapshot) {
  return `${snapshot.order}. ${snapshot.match.team1} ${snapshot.result.home}-${snapshot.result.away} ${snapshot.match.team2}`;
}

function historyLineColor(index) {
  const palette = ['#53e0b4', '#5da9ff', '#ffd76a', '#ff8f6b', '#c08cff', '#7ce2ff', '#ff6b6b', '#8bd450', '#f6c177', '#7aa2f7', '#f7768e', '#9ece6a', '#bb9af7', '#e0af68', '#73daca', '#c0caf5'];
  return palette[index % palette.length];
}

function renderHistoryChart(snapshots, snapshot) {
  const container = document.getElementById('historyChart');
  if (!container || !snapshots.length) return;
  const mobileOnlyTop = window.matchMedia('(max-width: 760px)').matches;

  const width = Math.max(720, snapshots.length * 56);
  const height = 320;
  const padding = { top: 18, right: 22, bottom: 34, left: mobileOnlyTop ? 88 : 126 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const playerCount = DATA.players.length;
  const maxIndex = Math.max(1, snapshots.length - 1);
  const maxPosition = Math.max(1, playerCount - 1);
  const selectedIndex = Math.max(0, snapshots.findIndex(item => item.id === snapshot.id));

  const xFor = index => padding.left + (chartWidth * (maxIndex ? index / maxIndex : 0));
  const yFor = position => padding.top + (chartHeight * (maxPosition ? (position - 1) / maxPosition : 0));

  const visiblePlayerIds = new Set((mobileOnlyTop ? snapshot.ranking.slice(0, 8) : snapshot.ranking).map(player => player.id));
  const series = DATA.players
    .filter(player => visiblePlayerIds.has(player.id))
    .map((player, index) => {
      const color = historyLineColor(index);
      const points = snapshots.map((item, snapshotIndex) => {
        const row = item.ranking.find(entry => entry.id === player.id);
      return {
        snapshotId: item.id,
        snapshotIndex,
        position: row?.position || playerCount,
        total: row?.total || 0
      };
    });
    const selectedPoint = points[selectedIndex] || points[points.length - 1];
      return { player, color, points, selectedPoint };
    });

  const horizontalMarks = Array.from(new Set([1, Math.ceil(playerCount / 2), playerCount])).sort((a, b) => a - b);
  const lineMarkup = series.map(item => {
    const path = item.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.snapshotIndex).toFixed(1)} ${yFor(point.position).toFixed(1)}`).join(' ');
    const selectedX = xFor(item.selectedPoint.snapshotIndex).toFixed(1);
    const selectedY = yFor(item.selectedPoint.position).toFixed(1);
    const firstPoint = item.points[0];
    const firstY = yFor(firstPoint.position).toFixed(1);
    return `
      <path d="${path}" fill="none" stroke="${item.color}" stroke-width="${item.player.id === snapshot.leader?.id ? 3.5 : 2}" stroke-linecap="round" stroke-linejoin="round" opacity="${item.player.id === snapshot.leader?.id ? 1 : 0.7}" />
      <text x="${(padding.left - 8).toFixed(1)}" y="${(Number(firstY) + 2).toFixed(1)}" fill="${item.color}" font-size="7" font-weight="700" text-anchor="end">${escapeHtml(item.player.name)}</text>
      <circle cx="${selectedX}" cy="${selectedY}" r="${item.player.id === snapshot.leader?.id ? 4.5 : 3.2}" fill="${item.color}" />
    `;
  }).join('');

  const gridMarkup = horizontalMarks.map(mark => `
    <g>
      <line x1="${padding.left}" y1="${yFor(mark).toFixed(1)}" x2="${width - padding.right}" y2="${yFor(mark).toFixed(1)}" stroke="rgba(153,166,194,0.18)" stroke-width="1" />
      <text x="${padding.left - 10}" y="${(yFor(mark) + 4).toFixed(1)}" fill="var(--muted)" font-size="11" text-anchor="end">${mark}</text>
    </g>
  `).join('');

  const xLabelsMarkup = snapshots.map((item, index) => `
    <text x="${xFor(index).toFixed(1)}" y="${height - 10}" fill="var(--muted)" font-size="10" text-anchor="middle">${item.order}</text>
  `).join('');

  const markerX = xFor(selectedIndex).toFixed(1);
  const legend = series
    .slice()
    .sort((a, b) => a.selectedPoint.position - b.selectedPoint.position || b.selectedPoint.total - a.selectedPoint.total)
    .map(item => `
      <div class="history-legend-item">
        <span class="history-legend-swatch" style="background:${item.color}"></span>
        <span class="history-legend-name">${escapeHtml(item.player.name)}</span>
        <span class="history-legend-meta">#${item.selectedPoint.position} · ${item.selectedPoint.total} pts</span>
      </div>
    `).join('');

  container.innerHTML = html`
    <div class="history-chart-head">
      <div>
        <h3>Gráfica de posiciones</h3>
        <p class="hint">${mobileOnlyTop ? 'La gráfica muestra los 8 mejores del punto seleccionado en móvil.' : 'La gráfica muestra a todos los participantes en escritorio.'} La línea vertical marca el partido histórico activo.</p>
      </div>
      <span class="pill">${mobileOnlyTop ? 'Top 8' : `${series.length} jugadores`} · ${snapshots.length} hitos</span>
    </div>
    <div class="history-chart-wrap">
      <svg class="history-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfica histórica de posiciones">
        <rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" rx="14" fill="rgba(16,24,43,0.6)" stroke="rgba(153,166,194,0.14)" />
        ${gridMarkup}
        <line x1="${markerX}" y1="${padding.top}" x2="${markerX}" y2="${height - padding.bottom}" stroke="rgba(255,215,106,0.7)" stroke-width="2" stroke-dasharray="6 6" />
        ${lineMarkup}
        ${xLabelsMarkup}
      </svg>
    </div>
    <div class="history-chart-legend">${legend}</div>
  `;
}

function renderHistory() {
  const select = document.getElementById('historyCheckpointSelect');
  const slider = document.getElementById('historyCheckpointSlider');
  const summary = document.getElementById('historySummary');
  const chart = document.getElementById('historyChart');
  const table = document.getElementById('historyTable');
  if (!select || !slider || !summary || !chart || !table) return;

  const snapshots = buildHistoricalSnapshots();
  if (!snapshots.length) {
    select.innerHTML = '<option value="">Sin partidos resueltos</option>';
    summary.innerHTML = '<p class="empty-state">Aún no hay suficientes resultados para construir el histórico.</p>';
    chart.innerHTML = '';
    table.innerHTML = '';
    return;
  }

  if (!state.historyCheckpointId || !snapshots.some(snapshot => snapshot.id === state.historyCheckpointId)) {
    state.historyCheckpointId = snapshots[snapshots.length - 1].id;
  }

  select.innerHTML = snapshots.map(snapshot => `
    <option value="${snapshot.id}">${escapeHtml(historyCheckpointLabel(snapshot))}</option>
  `).join('');
  select.value = state.historyCheckpointId;
  slider.min = '1';
  slider.max = String(snapshots.length);

  const snapshot = snapshots.find(item => item.id === state.historyCheckpointId) || snapshots[snapshots.length - 1];
  slider.value = String(snapshot.order);
  const previousSnapshot = snapshots.find(item => item.order === snapshot.order - 1) || null;
  const leaderChange = previousSnapshot?.leader && snapshot.leader && previousSnapshot.leader.id !== snapshot.leader.id;
  const medals = ['🥇', '🥈', '🥉'];

  renderHistoryChart(snapshots, snapshot);

  summary.innerHTML = html`
    <article class="card">
      <b>${snapshot.playedMatches}/${DATA.matches.length}</b>
      <span>partidos computados</span>
    </article>
    <article class="card">
      <b>${snapshot.leader ? `⭐ ${snapshot.leader.name}` : '-'}</b>
      <span>líder tras este partido</span>
    </article>
    <article class="card">
      <b>${snapshot.leader?.total || 0}</b>
      <span>puntos del líder</span>
    </article>
    <article class="card">
      <b>${leaderChange ? 'Sí' : 'No'}</b>
      <span>cambio de líder</span>
    </article>
  `;

  table.innerHTML = html`
    <thead><tr>
      <th>#</th>
      <th>Mov.</th>
      <th>Participante</th>
      <th>Total</th>
      <th>1ª fase</th>
      <th>Exactos</th>
      <th>Aciertos</th>
      <th>Cruces</th>
      <th>Jugados</th>
    </tr></thead>
    <tbody>${snapshot.ranking.map(player => {
      const movement = historyPositionChange(player, previousSnapshot);
      return html`
      <tr class="${player.position <= 3 ? `rank-${player.position}` : ''}">
        <td class="ranking-position">${medals[player.position - 1] || player.position}</td>
        <td class="${movement.className}" title="${movement.label}">${movement.symbol}${movement.delta ? ` ${movement.delta}` : ''}</td>
        <td>${escapeHtml(player.name)}</td>
        <td class="points">${player.total}</td>
        <td>${player.groupPoints}</td>
        <td>${player.exacts}</td>
        <td>${player.signs + player.exacts}</td>
        <td>${player.knockoutPoints}</td>
        <td>${player.played}</td>
      </tr>`;
    }).join('')}</tbody>
  `;
}

function compareStatus(score) {
  if (!score.points) return { label: 'Fallado', className: 'bad' };
  if (score.exact) return { label: 'Exacto', className: 'ok' };
  return { label: 'Quiniela', className: 'points' };
}

function comparePlayerCard(player, prediction, result, index) {
  const score = scorePrediction(prediction, result, DATA.meta.scoring);
  const status = result ? compareStatus(score) : { label: 'Pendiente', className: 'muted' };
  return html`
    <article class="compare-card">
      <div class="compare-card-head">
        <span class="pill">Participante</span>
        <div class="compare-card-actions">
          <button type="button" class="match-link-button" data-compare-remove="${index}">Quitar</button>
        </div>
      </div>
      <h3>${escapeHtml(player.name)}</h3>
      <div class="compare-main-score">${escapeHtml(prediction.score)}</div>
      <div class="compare-subline">Quiniela: <strong>${escapeHtml(prediction.sign)}</strong></div>
      <div class="compare-subline">Estado: <span class="${status.className}">${status.label}</span></div>
      <div class="compare-points">+${score.points} pts</div>
    </article>
  `;
}

function compareAddCard() {
  const selectedIds = new Set(state.comparePlayers);
  const selectOptions = DATA.players
    .filter(player => !selectedIds.has(player.id))
    .map(player => `<option value="${player.id}">${escapeHtml(player.name)}</option>`)
    .join('');

  return html`
    <article class="compare-card compare-card-empty">
      <span class="pill">Comparación</span>
      <h3>Jugadores</h3>
      <p class="compare-subline">Selecciona directamente qué jugador quieres comparar en este partido.</p>
      <div class="compare-picker">
        <select data-compare-player-select ${selectOptions ? '' : 'disabled'}>
          <option value="">Jugador a comparar...</option>
          ${selectOptions}
        </select>
      </div>
      ${!selectOptions ? '<p class="hint">Ya están añadidos todos los jugadores disponibles.</p>' : ''}
    </article>
  `;
}

function comparePlayerCards(match, result) {
  const selectedPlayers = state.comparePlayers
    .map(playerId => DATA.players.find(player => player.id === playerId))
    .filter(Boolean);

  if (!selectedPlayers.length) return '';
  return selectedPlayers.map((player, index) => {
    const prediction = match.predictions[player.id];
    return comparePlayerCard(player, prediction, result, index);
  }).join('');
}

function compareResultCard(match, result) {
  return html`
    <article class="compare-card compare-card-result">
      <span class="pill">Resultado</span>
      <h3>${teamLabel(match.team1)} - ${teamLabel(match.team2)}</h3>
      <div class="compare-main-score ${result ? '' : 'pending'}">${result ? `${result.home} - ${result.away}` : 'Pendiente'}</div>
      <div class="compare-subline">${escapeHtml(formatMatchSchedule(match))}</div>
      ${result ? renderGoalBreakdown(match) : '<div class="compare-subline muted">Aún sin resultado disponible.</div>'}
    </article>
  `;
}

function compareMatchLabel(match) {
  return `Grupo ${match.group} · ${match.team1} - ${match.team2}`;
}

function renderCompare() {
  const matchSelect = document.getElementById('compareMatchSelect');
  const summary = document.getElementById('compareSummary');
  const cards = document.getElementById('compareCards');

  if (state.compareMatchId && !DATA.matches.some(match => match.id === state.compareMatchId)) {
    state.compareMatchId = '';
  }
  if (!Array.isArray(state.comparePlayers)) {
    state.comparePlayers = [];
  }
  state.comparePlayers = state.comparePlayers.filter(playerId => DATA.players.some(player => player.id === playerId));

  matchSelect.innerHTML = [
    '<option value="">Selecciona un partido...</option>',
    ...DATA.matches.map(match => `<option value="${match.id}">${escapeHtml(compareMatchLabel(match))}</option>`)
  ].join('');
  matchSelect.value = state.compareMatchId;

  const match = DATA.matches.find(item => item.id === state.compareMatchId);
  if (!match) {
    summary.innerHTML = html`
      <article class="card">
        <b>0</b>
        <span>partidos añadidos</span>
      </article>
      <article class="card">
        <b>0</b>
        <span>jugadores añadidos</span>
      </article>
    `;
    cards.innerHTML = '<p class="empty-state">Selecciona un partido para añadirlo al comparador y luego ve incorporando jugadores uno a uno.</p>';
    return;
  }

  const result = getResult(match);

  summary.innerHTML = html`
    <article class="card">
      <b>${match.id}</b>
      <span>${teamLabel(match.team1)} - ${teamLabel(match.team2)}</span>
    </article>
    <article class="card">
      <b>${result ? `${result.home}-${result.away}` : 'Pendiente'}</b>
      <span>resultado real</span>
    </article>
    <article class="card">
      <b>${state.comparePlayers.length}</b>
      <span>jugadores añadidos</span>
    </article>
  `;

  cards.innerHTML = [
    compareResultCard(match, result),
    compareAddCard(),
    comparePlayerCards(match, result)
  ].join('');
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

function scheduleTeamTokens(team) {
  return [team, apiNameFor(team)]
    .filter(Boolean)
    .flatMap(value => [value, normalize(value)])
    .filter(Boolean);
}

function parseApiFixtureDateTime(fixture) {
  const rawDate = fixture?.utcDate || fixture?.date || '';
  const rawTime = fixture?.time || '';
  if (!rawDate) return null;

  if (fixture?.utcDate) {
    const direct = new Date(fixture.utcDate);
    return Number.isNaN(direct.getTime()) ? null : direct;
  }

  const dateMatch = String(rawDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(rawTime).match(/^(\d{2}):(\d{2})(?:\s+UTC([+-]\d+))?$/i);
  if (!dateMatch) {
    const fallback = new Date(rawDate);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, year, month, day] = dateMatch;
  if (!timeMatch) {
    return new Date(`${year}-${month}-${day}T12:00:00Z`);
  }

  const [, hours, minutes, offsetRaw] = timeMatch;
  const offsetHours = Number(offsetRaw || 0);
  const utcHour = Number(hours) - offsetHours;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), utcHour, Number(minutes), 0));
}

function findApiFixtureInfo(match) {
  const localTeam1Tokens = scheduleTeamTokens(match.team1);
  const localTeam2Tokens = scheduleTeamTokens(match.team2);
  for (const apiMatch of state.apiFixtures) {
    const apiTeam1 = normalize(apiMatch.team1 || apiMatch.homeTeam?.name || apiMatch.homeTeam?.shortName || '');
    const apiTeam2 = normalize(apiMatch.team2 || apiMatch.awayTeam?.name || apiMatch.awayTeam?.shortName || '');
    const apiTokens1 = [apiTeam1, normalize(apiMatch.homeTeam?.name || ''), normalize(apiMatch.homeTeam?.shortName || '')].filter(Boolean);
    const apiTokens2 = [apiTeam2, normalize(apiMatch.awayTeam?.name || ''), normalize(apiMatch.awayTeam?.shortName || '')].filter(Boolean);
    const direct = localTeam1Tokens.some(token => apiTokens1.includes(token)) && localTeam2Tokens.some(token => apiTokens2.includes(token));
    if (direct) return { fixture: apiMatch, swapped: false };
    const swapped = localTeam1Tokens.some(token => apiTokens2.includes(token)) && localTeam2Tokens.some(token => apiTokens1.includes(token));
    if (swapped) return { fixture: apiMatch, swapped: true };
  }
  return null;
}

function findApiFixture(match) {
  return findApiFixtureInfo(match)?.fixture || null;
}

function getMatchGoalBreakdown(match) {
  const fixtureInfo = findApiFixtureInfo(match);
  if (!fixtureInfo?.fixture) return null;

  const { fixture, swapped } = fixtureInfo;
  const homeGoals = swapped ? (fixture.goals2 || []) : (fixture.goals1 || []);
  const awayGoals = swapped ? (fixture.goals1 || []) : (fixture.goals2 || []);

  return {
    team1: homeGoals.map(goal => ({
      name: goal.name || '',
      minute: goal.minute || '',
      penalty: Boolean(goal.penalty),
      ownGoal: Boolean(goal.owngoal)
    })),
    team2: awayGoals.map(goal => ({
      name: goal.name || '',
      minute: goal.minute || '',
      penalty: Boolean(goal.penalty),
      ownGoal: Boolean(goal.owngoal)
    }))
  };
}

function formatGoalEvent(goal) {
  if (!goal?.name) return '';
  const marker = goal.ownGoal ? '↺ P.P.' : (goal.penalty ? '🎯' : '⚽');
  const minute = goal.minute ? `${escapeHtml(goal.minute)}'` : '';
  return `<span class="goal-event"><span class="goal-marker">${marker}</span><span>${escapeHtml(goal.name)}${minute ? ` ${minute}` : ''}</span></span>`;
}

function renderGoalBreakdown(match) {
  const goals = getMatchGoalBreakdown(match);
  const result = getResult(match);
  if (!result || !goals) return '';

  const lines = [];
  if (goals.team1.length) {
    lines.push(html`
      <div class="goal-line">
        <strong>${teamLabel(match.team1)}</strong>
        <div class="goal-events">${goals.team1.map(formatGoalEvent).join('')}</div>
      </div>
    `);
  }
  if (goals.team2.length) {
    lines.push(html`
      <div class="goal-line">
        <strong>${teamLabel(match.team2)}</strong>
        <div class="goal-events">${goals.team2.map(formatGoalEvent).join('')}</div>
      </div>
    `);
  }
  if (!lines.length) return '';

  return `<div class="match-goals">${lines.join('')}</div>`;
}

function formatMatchSchedule(match) {
  const fixture = findApiFixture(match);
  if (!fixture) return 'Horario pendiente';

  const date = parseApiFixtureDateTime(fixture);
  if (!date) return 'Horario pendiente';

  const hasTime = Boolean(fixture.utcDate || fixture.time);
  return new Intl.DateTimeFormat('es-ES', hasTime
    ? { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone: 'Europe/Madrid' }
    : { dateStyle: 'medium', timeZone: 'Europe/Madrid' }
  ).format(date);
}

function getMatchScheduleTimestamp(match) {
  const fixture = findApiFixture(match);
  const date = fixture ? parseApiFixtureDateTime(fixture) : null;
  return date ? date.getTime() : Number.POSITIVE_INFINITY;
}

function compareMatchesForDisplay(a, b) {
  const playedA = !!getResult(a);
  const playedB = !!getResult(b);
  if (playedA !== playedB) return playedA ? 1 : -1;

  const timeDiff = getMatchScheduleTimestamp(a) - getMatchScheduleTimestamp(b);
  if (timeDiff) return timeDiff;

  return a.team1.localeCompare(b.team1, 'es') || a.team2.localeCompare(b.team2, 'es');
}

function getMatchdaySortKey(matchday) {
  const pending = matchday.matches.filter(match => !getResult(match));
  if (!pending.length) return Number.POSITIVE_INFINITY;
  return Math.min(...pending.map(getMatchScheduleTimestamp));
}

function renderMatchCard(match) {
  const result = getResult(match);
  const goalsExpanded = Boolean(state.matchGoalsExpanded[match.id]);
  return html`<article class="match-card" role="button" tabindex="0" data-match-id="${match.id}" aria-label="Ver predicciones de ${escapeHtml(match.team1)} contra ${escapeHtml(match.team2)}">
    <span class="pill">Grupo ${match.group} · ${match.id}</span>
    <h3 class="teams"><span>${teamLabel(match.team1)}</span><span class="versus">-</span><span>${teamLabel(match.team2)}</span></h3>
    <div class="match-schedule">${escapeHtml(formatMatchSchedule(match))}</div>
    <div class="match-score ${result ? '' : 'pending'}">${result ? `${result.home} - ${result.away}` : 'Pendiente'}</div>
    ${result ? html`
      <div class="match-card-actions">
        <button type="button" class="match-link-button" data-toggle-goals="${match.id}" aria-expanded="${goalsExpanded}">
          ${goalsExpanded ? 'Ocultar goleadores' : 'Ver goleadores'}
        </button>
      </div>
      ${goalsExpanded ? renderGoalBreakdown(match) : ''}
    ` : ''}
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
        ${result ? renderGoalBreakdown(match) : ''}
      </div>
      <button type="button" class="dialog-close" data-close-predictions aria-label="Cerrar">×</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Participante</th><th>Predicción</th><th>Quiniela</th><th>Puntos</th></tr></thead>
        <tbody>${DATA.players.map(player => {
          const prediction = match.predictions[player.id];
          const score = scorePrediction(prediction, result, DATA.meta.scoring);
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
  matches = [...matches].sort(compareMatchesForDisplay);

  const matchdays = [1, 2, 3]
    .map(number => {
      const matchdayMatches = matches.filter(match => getMatchday(match) === number).sort(compareMatchesForDisplay);
      const groups = [...new Set(matchdayMatches.map(match => match.group))]
        .sort()
        .map(groupName => ({
          name: groupName,
          matches: matchdayMatches.filter(match => match.group === groupName).sort(compareMatchesForDisplay)
        }));
      return { number, matches: matchdayMatches, groups };
    })
    .sort((a, b) => getMatchdaySortKey(a) - getMatchdaySortKey(b) || a.number - b.number)
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
          <thead><tr><th>Partido</th><th>Resultado</th><th>Goles</th><th>Estado</th></tr></thead>
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
                  <td class="goal-cell">${result ? renderGoalBreakdown(match) : '<span class="muted">-</span>'}</td>
                  <td>${result ? 'Jugado' : 'Pendiente'}</td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="4" class="empty-state">Todavía no hay partidos disponibles.</td></tr>'}
          </tbody>
        </table>
      </div>
    `
    : '<div class="team-empty">No hay equipos disponibles.</div>';
}

function resultFromPrediction(prediction) {
  const parsed = parseScore(prediction?.score);
  return parsed ? { home: parsed[0], away: parsed[1] } : null;
}

function calculateGroupStandings(group, getStandingsResult = getResult) {
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
    const result = getStandingsResult(match);
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
  const select = document.getElementById('groupStandingsView');
  const hint = document.getElementById('groupStandingsHint');
  if (!select.dataset.loaded) {
    select.innerHTML = `<option value="actual">Actual</option>${DATA.players.map(player => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join('')}`;
    select.dataset.loaded = '1';
  }
  if (![...select.options].some(option => option.value === state.groupStandingsView)) {
    state.groupStandingsView = 'actual';
  }
  if (select.value !== state.groupStandingsView) select.value = state.groupStandingsView;

  const selectedPlayer = DATA.players.find(player => player.id === state.groupStandingsView) || null;
  const getStandingsResult = selectedPlayer
    ? match => resultFromPrediction(match.predictions[selectedPlayer.id])
    : getResult;
  hint.textContent = selectedPlayer
    ? `Clasificación proyectada según cómo ${selectedPlayer.name} ha puesto los resultados de la fase de grupos.`
    : 'Actualizada automáticamente con los resultados disponibles.';

  const groups = [...new Set(DATA.matches.map(match => match.group))].sort();
  document.getElementById('groupStandingsList').innerHTML = groups.map(group => {
    const standings = calculateGroupStandings(group, getStandingsResult);
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
    .slice(0, 15);
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
      return total + scorePrediction(match.predictions[playerId], getResult(match), DATA.meta.scoring).points;
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
              const score = scorePrediction(prediction, result, DATA.meta.scoring);
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

function renderBracketRound(stage, teams, stageScore, { matchOffset = 0, side = 'left' } = {}) {
  const matches = [];
  for (let index = 0; index < teams.length; index += 2) {
    matches.push(html`
      <article class="bracket-match ${side === 'right' ? 'right-side' : ''}">
        <span class="bracket-match-number">Cruce ${matchOffset + index / 2 + 1}</span>
        ${renderBracketTeam(teams[index], knockoutPredictionStatus(teams[index], stageScore))}
        ${renderBracketTeam(teams[index + 1], knockoutPredictionStatus(teams[index + 1], stageScore))}
      </article>
    `);
  }

  return html`
    <section class="bracket-round ${side === 'right' ? 'right-bracket-round' : ''}" style="--matches:${matches.length}">
      <div class="bracket-round-head">
        <h3>${stageScore.label}</h3>
        <span>${stageScore.hits} aciertos · +${stageScore.points} pts</span>
        <small>${stageScore.resolved}/${stageScore.expected} selecciones confirmadas</small>
      </div>
      <div class="bracket-matches">${matches.join('')}</div>
    </section>
  `;
}

function renderFinalRound(finalTeams, champion, finalScore, championScore) {
  return html`
    <section class="bracket-round bracket-final-round">
      <div class="bracket-round-head">
        <h3>Final</h3>
        <span>${finalScore.hits} aciertos · +${finalScore.points} pts</span>
        <small>${finalScore.resolved}/${finalScore.expected} selecciones confirmadas</small>
      </div>
      <div class="bracket-matches">
        <article class="bracket-match">
          <span class="bracket-match-number">Final</span>
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

function renderKnockout() {
  const playerId = document.getElementById('knockoutPlayerSelect').value || DATA.players[0].id;
  const player = DATA.players.find(item => item.id === playerId) || DATA.players[0];
  const champion = DATA.knockoutPredictions.find(prediction => prediction.stage === '1º')?.predictions[playerId] || '';
  const knockout = calculatePlayerKnockout(playerId);
  const bracket = buildPlayerKnockoutBracket(DATA.knockoutPredictions, playerId, teamKey);
  const championScore = knockout.breakdown['1º'];
  const halfRounds = KNOCKOUT_STAGES.slice(0, -1);
  const leftRounds = halfRounds.map(stage => ({
    stage,
    teams: bracket[stage].slice(0, bracket[stage].length / 2),
    matchOffset: 0
  }));
  const rightRounds = halfRounds.map(stage => ({
    stage,
    teams: bracket[stage].slice(bracket[stage].length / 2),
    matchOffset: bracket[stage].length / 4
  })).reverse();

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
      ${leftRounds.map(({ stage, teams, matchOffset }) => renderBracketRound(stage, teams, knockout.breakdown[stage], { matchOffset })).join('')}
      ${renderFinalRound(bracket.FINAL, champion, knockout.breakdown.FINAL, championScore)}
      ${rightRounds.map(({ stage, teams, matchOffset }) => renderBracketRound(stage, teams, knockout.breakdown[stage], { matchOffset, side: 'right' })).join('')}
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

function getProbabilitiesKey() {
  return JSON.stringify({
    apiResults: state.apiResults,
    miniResults: state.miniResults,
    playerRankings: state.playerRankings?.scrapedAt || state.playerRankings?.source || '',
    teamRankings: state.teamRankings?.scrapedAt || state.teamRankings?.source || ''
  });
}

function ensureProbabilities() {
  const key = getProbabilitiesKey();
  if (state.probabilities && state.probabilitiesKey === key) return state.probabilities;

  try {
    state.probabilities = simulateProbabilities({
      data: DATA,
      apiResults: state.apiResults,
      apiFixtures: state.apiFixtures,
      miniResults: state.miniResults,
      playerRankings: state.playerRankings,
      teamRankings: state.teamRankings
    });
    state.probabilitiesKey = key;
    state.probabilitiesError = '';
  } catch (error) {
    state.probabilities = null;
    state.probabilitiesError = error.message;
    console.error('No se pudieron calcular las probabilidades:', error);
  }

  return state.probabilities;
}

function formatProbability(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatAveragePoints(value) {
  return Number(value || 0).toFixed(1);
}

function probabilityRows(rows, expanded) {
  return expanded ? rows : rows.slice(0, 8);
}

function renderProbabilities() {
  const meta = document.getElementById('probabilitiesMeta');
  const playersTable = document.getElementById('probabilitiesPlayersTable');
  const teamsTable = document.getElementById('probabilitiesTeamsTable');
  const miniTable = document.getElementById('probabilitiesMiniTable');
  const playersToggle = document.getElementById('probabilitiesPlayersToggle');
  const teamsToggle = document.getElementById('probabilitiesTeamsToggle');
  const miniToggle = document.getElementById('probabilitiesMiniToggle');

  if (!Object.keys(state.apiResults).length) {
    meta.textContent = 'Esperando resultados para calcular la simulación.';
    playersTable.innerHTML = '<tbody><tr><td class="empty-state">Todavía no hay datos suficientes.</td></tr></tbody>';
    teamsTable.innerHTML = '<tbody><tr><td class="empty-state">Todavía no hay datos suficientes.</td></tr></tbody>';
    miniTable.innerHTML = '<tbody><tr><td class="empty-state">Todavía no hay datos suficientes.</td></tr></tbody>';
    playersToggle.hidden = true;
    teamsToggle.hidden = true;
    miniToggle.hidden = true;
    return;
  }

  const probabilities = ensureProbabilities();
  if (!probabilities) {
    meta.textContent = state.probabilitiesError || 'No se pudo calcular la simulación.';
    playersTable.innerHTML = '<tbody><tr><td class="empty-state">No se pudieron calcular las probabilidades.</td></tr></tbody>';
    teamsTable.innerHTML = '<tbody><tr><td class="empty-state">No se pudieron calcular las probabilidades.</td></tr></tbody>';
    miniTable.innerHTML = '<tbody><tr><td class="empty-state">No se pudieron calcular las probabilidades.</td></tr></tbody>';
    playersToggle.hidden = true;
    teamsToggle.hidden = true;
    miniToggle.hidden = true;
    return;
  }

  meta.textContent = `Simulación Monte Carlo (${probabilities.meta.iterations} iteraciones) · ${probabilities.meta.pendingMatches} partidos pendientes · ${probabilities.meta.resolvedMiniQuestions}/${DATA.miniQuestions.length} preguntas mini resueltas.`;
  const currentRanking = new Map(calculateRanking().map(player => [player.id, player.total]));
  const currentMiniRanking = new Map(calculateMiniRanking().map(player => [player.id, player.miniPoints]));

  const playerRows = probabilityRows(probabilities.players, state.probabilitiesExpanded.players);
  playersTable.innerHTML = html`
    <thead><tr><th>#</th><th>Participante</th><th>Prob. ganar</th><th>Media pts</th><th>Puntos actuales</th></tr></thead>
    <tbody>${playerRows.map((player, index) => html`
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(player.name)}</td>
        <td class="points">${formatProbability(player.winProbability)}</td>
        <td>${formatAveragePoints(player.averagePoints)}</td>
        <td>${currentRanking.get(player.id) || 0}</td>
      </tr>
    `).join('')}</tbody>
  `;
  playersToggle.hidden = probabilities.players.length <= 8;
  playersToggle.textContent = state.probabilitiesExpanded.players ? 'Ver menos' : `Ver todos (${probabilities.players.length})`;

  const teamRows = probabilityRows(probabilities.teams, state.probabilitiesExpanded.teams);
  teamsTable.innerHTML = html`
    <thead><tr><th>#</th><th>Selección</th><th>1/16</th><th>1/8</th><th>1/4</th><th>Semis</th><th>Final</th><th>Campeón</th></tr></thead>
    <tbody>${teamRows.map((team, index) => html`
      <tr>
        <td>${index + 1}</td>
        <td>${teamLabel(team.team)}</td>
        <td>${formatProbability(team.dieciseisavos)}</td>
        <td>${formatProbability(team.octavos)}</td>
        <td>${formatProbability(team.cuartos)}</td>
        <td>${formatProbability(team.semis)}</td>
        <td>${formatProbability(team.final)}</td>
        <td class="points">${formatProbability(team.champion)}</td>
      </tr>
    `).join('')}</tbody>
  `;
  teamsToggle.hidden = probabilities.teams.length <= 8;
  teamsToggle.textContent = state.probabilitiesExpanded.teams ? 'Ver menos' : `Ver todas (${probabilities.teams.length})`;

  const miniRows = probabilityRows(probabilities.miniPlayers, state.probabilitiesExpanded.mini);
  miniTable.innerHTML = html`
    <thead><tr><th>#</th><th>Participante</th><th>Prob. ganar</th><th>Media pts</th><th>Puntos actuales</th></tr></thead>
    <tbody>${miniRows.map((player, index) => html`
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(player.name)}</td>
        <td class="points">${formatProbability(player.winProbability)}</td>
        <td>${formatAveragePoints(player.averagePoints)}</td>
        <td>${currentMiniRanking.get(player.id) || 0}</td>
      </tr>
    `).join('')}</tbody>
  `;
  miniToggle.hidden = probabilities.miniPlayers.length <= 8;
  miniToggle.textContent = state.probabilitiesExpanded.mini ? 'Ver menos' : `Ver todos (${probabilities.miniPlayers.length})`;
}

function renderSettings() {
  document.getElementById('apiUrlInput').value = state.apiUrl;
}

function renderAll() { renderSummary(); renderFilters(); renderRanking(); renderHistory(); renderProbabilities(); renderCompare(); renderMatches(); renderTeams(); renderStatistics(); renderGroupStandings(); renderBestThirds(); renderTopScorers(); renderPlayerDetail(); renderKnockout(); renderMini(); renderSettings(); }

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

async function bootstrapWorldcupResultsCache() {
  try {
    const loaded = await loadWorldcupResultsCache();
    if (loaded) {
      state.rankingLoading = false;
      renderAll();
    }
    return loaded;
  } catch (error) {
    console.warn('No se pudo cargar el cache de resultados desde Supabase:', error);
    return false;
  }
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

async function loadWorldcupResultsCache() {
  const { data, error } = await supabase
    .from(WORLDCUP_RESULTS_TABLE)
    .select('kind,payload,updated_at')
    .eq('kind', WORLDCUP_RESULTS_KIND)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) return false;

  applyResultsPayload(data.payload, { updatedAt: data.updated_at || data.payload.scrapedAt });
  processSoftAlerts();
  if (data.updated_at) {
    localStorage.setItem(LS_KEYS.lastUpdate, new Date(data.updated_at).toLocaleString('es-ES'));
  }
  return true;
}

function applyAsLiveMatchPayload(payload, { updatedAt } = {}) {
  const nextPayload = payload
    ? {
      ...payload,
      updatedAt: updatedAt || payload.scrapedAt || null
    }
    : null;
  processGoalAlertPayload(nextPayload);
  state.asLiveMatch = nextPayload;
  lastAsLiveMatchRefreshAt = state.asLiveMatch?.updatedAt
    ? (new Date(state.asLiveMatch.updatedAt).getTime() || Date.now())
    : 0;
}

async function loadAsLiveMatchCache() {
  const { data, error } = await supabase
    .from(AS_LIVE_MATCH_TABLE)
    .select('kind,payload,updated_at')
    .eq('kind', AS_LIVE_MATCH_KIND)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) {
    applyAsLiveMatchPayload(null);
    return false;
  }

  applyAsLiveMatchPayload(data.payload, { updatedAt: data.updated_at || data.payload.scrapedAt });
  return true;
}

function scheduleAsLiveMatchRefresh() {
  if (asLiveMatchRefreshTimer) {
    clearTimeout(asLiveMatchRefreshTimer);
  }

  asLiveMatchRefreshTimer = setTimeout(() => {
    refreshAsLiveMatch({ silent: true });
  }, getAsLiveMatchRefreshIntervalMs());
}

async function refreshAsLiveMatch(options = {}) {
  const silent = options?.silent === true;
  const force = options?.force === true;
  if (asLiveMatchRefreshInProgress) return;
  asLiveMatchRefreshInProgress = true;

  try {
    const syncUrl = new URL(`${SUPABASE_URL}/functions/v1/sync-as-live-match`);
    if (force) syncUrl.searchParams.set('force', '1');
    const response = await fetchJsonWithTimeout(syncUrl, {
      method: 'GET',
      cache: 'no-store'
    }, AS_LIVE_MATCH_FETCH_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload.ok === false) {
      throw new Error(payload.error || 'No se pudo sincronizar el directo de AS.');
    }

    await loadAsLiveMatchCache();
    renderSummary();
    return true;
  } catch (error) {
    console.warn('No se pudo actualizar el directo de AS:', error);
    if (!silent) {
      showAppToast('No se pudo actualizar el directo de AS.');
    }
    return false;
  } finally {
    asLiveMatchRefreshInProgress = false;
    scheduleAsLiveMatchRefresh();
  }
}

async function refreshStatsRankings(options = {}) {
  const buttonId = options?.buttonId || 'statsRefreshBtn';
  const notifyWithAlert = options?.notifyWithAlert !== false;
  const button = document.getElementById(buttonId);
  if (!button) return false;
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
    if (notifyWithAlert) alert('Estadísticas actualizadas.');
    return true;
  } catch (error) {
    console.error('No se pudo forzar el refresco de estadísticas:', error);
    if (notifyWithAlert) alert('No se pudo forzar el refresco de estadísticas: ' + error.message);
    return false;
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
  const force = options?.force === true;
  if (apiRefreshInProgress) return;
  apiRefreshInProgress = true;
  renderHeaderSyncStatus();
  state.rankingLoading = !Object.keys(state.apiResults).length;
  if (state.rankingLoading) renderRanking();
  const btn = document.getElementById('refreshApiBtn');
  btn.disabled = true; btn.textContent = 'Actualizando...';
  try {
    const syncUrl = new URL(`${SUPABASE_URL}/functions/v1/sync-worldcup-results`);
    if (force) syncUrl.searchParams.set('force', '1');
    const syncResponse = await fetchJsonWithTimeout(syncUrl, {
      method: 'GET',
      cache: 'no-store'
    });

    if (!syncResponse.ok) throw new Error(`HTTP ${syncResponse.status}`);

    const syncPayload = await syncResponse.json();
    if (syncPayload.ok === false) {
      throw new Error(syncPayload.error || 'No se pudo sincronizar el cache de resultados.');
    }

    const loaded = await loadWorldcupResultsCache();
    if (!loaded) {
      throw new Error('Supabase no devolvió resultados cacheados tras la sincronización.');
    }

    state.rankingLoading = false;
    localStorage.setItem(LS_KEYS.lastUpdate, new Date().toLocaleString('es-ES'));
    renderAll();
    return true;
  } catch (err) {
    console.warn('Fallo leyendo resultados desde Supabase cacheado. Intentando fallback directo...', err);
    try {
      const res = await fetchJsonWithTimeout(state.apiUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      applyResultsPayload(json);
      processSoftAlerts();
      state.rankingLoading = false;
      localStorage.setItem(LS_KEYS.lastUpdate, new Date().toLocaleString('es-ES'));
      renderAll();
      return true;
    } catch (fallbackError) {
      state.rankingLoading = false;
      renderRanking();
      if (!silent) alert('No se pudieron actualizar los resultados automáticos. Error: ' + fallbackError.message);
      console.error('Error al actualizar los resultados automáticos:', fallbackError);
      return false;
    }
  } finally {
    apiRefreshInProgress = false;
    btn.disabled = false;
    btn.textContent = 'Actualizar datos';
    renderHeaderSyncStatus();
  }
}

async function runAdminManualSync(buttonId, busyLabel, task, successMessage, errorMessage) {
  if (!isAdmin()) return;
  const button = document.getElementById(buttonId);
  if (!button) return;

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;

  try {
    const ok = await task();
    showAppToast(ok ? successMessage : errorMessage, ok ? 2400 : 3600);
  } catch (error) {
    console.error(errorMessage, error);
    showAppToast(errorMessage, 3600);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function maybeRefreshFromApiOnResume() {
  const now = Date.now();
  if (now - lastResumeRefreshAt < 15000) return;
  lastResumeRefreshAt = now;
  if (apiRefreshInProgress || !navigator.onLine) return;
  if (!lastApiRefreshAt || (Date.now() - lastApiRefreshAt) >= API_RESUME_REFRESH_THRESHOLD_MS) {
    refreshFromApi({ silent: true });
  }
}

function maybeRefreshAsLiveMatchOnResume() {
  if (asLiveMatchRefreshInProgress || !navigator.onLine) return;
  if (!lastAsLiveMatchRefreshAt || (Date.now() - lastAsLiveMatchRefreshAt) >= getAsLiveMatchRefreshIntervalMs()) {
    refreshAsLiveMatch({ silent: true });
  } else {
    scheduleAsLiveMatchRefresh();
  }
}

async function saveMiniResult(id) {
  if (!isAdmin()) return;
  const result = document.querySelector(`[data-mini-result="${id}"]`).value.trim();
  if (!result) return alert('Introduce la respuesta correcta.');
  const question = DATA.miniQuestions.find(item => item.id === id);

  const { error } = await supabase
    .from('mini_results')
    .upsert({ question_id: id, value: result, updated_at: new Date().toISOString() });
  if (error) return alert('No se pudo guardar el resultado: ' + error.message);

  state.miniResults[id] = result;
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  renderAll();
  showAppToast(`Resultado guardado${question ? `: ${question.id}` : ''}.`);
}

async function clearMiniResult(id) {
  if (!isAdmin()) return;
  const question = DATA.miniQuestions.find(item => item.id === id);
  const { error } = await supabase
    .from('mini_results')
    .delete()
    .eq('question_id', id);
  if (error) return alert('No se pudo limpiar el resultado: ' + error.message);

  delete state.miniResults[id];
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  renderAll();
  showAppToast(`Resultado eliminado${question ? `: ${question.id}` : ''}.`);
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

  const toggleGoalsButton = e.target.closest('[data-toggle-goals]');
  if (toggleGoalsButton) {
    e.stopPropagation();
    const matchId = toggleGoalsButton.dataset.toggleGoals;
    state.matchGoalsExpanded[matchId] = !state.matchGoalsExpanded[matchId];
    renderMatches();
    return;
  }
  const compareRemoveButton = e.target.closest('[data-compare-remove]');
  if (compareRemoveButton) {
    const index = Number(compareRemoveButton.dataset.compareRemove);
    if (Number.isInteger(index) && index >= 0) {
      state.comparePlayers.splice(index, 1);
    }
    renderCompare();
    return;
  }
  const externalCard = e.target.closest('[data-external-url]');
  if (externalCard) {
    window.open(externalCard.dataset.externalUrl, '_blank', 'noopener');
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

  if (e.target.id === 'probabilitiesPlayersToggle') {
    state.probabilitiesExpanded.players = !state.probabilitiesExpanded.players;
    renderProbabilities();
    return;
  }
  if (e.target.id === 'probabilitiesTeamsToggle') {
    state.probabilitiesExpanded.teams = !state.probabilitiesExpanded.teams;
    renderProbabilities();
    return;
  }
  if (e.target.id === 'probabilitiesMiniToggle') {
    state.probabilitiesExpanded.mini = !state.probabilitiesExpanded.mini;
    renderProbabilities();
    return;
  }

  const tab = e.target.closest('.tab');
  if (tab) {
    document.querySelectorAll('.tab,.panel').forEach(el => el.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    return;
  }
  const saveMini = e.target.dataset.saveMini; if (saveMini) saveMiniResult(saveMini);
  const clearMini = e.target.dataset.clearMini; if (clearMini) clearMiniResult(clearMini);
  if (e.target.matches('[data-admin-logout]')) supabase.auth.signOut();
});

document.addEventListener('keydown', e => {
  const externalCard = e.target.closest?.('[data-external-url]');
  if (externalCard && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    window.open(externalCard.dataset.externalUrl, '_blank', 'noopener');
    return;
  }
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
document.getElementById('goalNotificationsBtn').addEventListener('click', requestGoalNotificationsPermission);
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
document.getElementById('historyCheckpointSelect').addEventListener('change', e => {
  state.historyCheckpointId = e.target.value;
  renderHistory();
});
document.getElementById('historyCheckpointSlider').addEventListener('input', e => {
  const snapshots = buildHistoricalSnapshots();
  const order = Number(e.target.value);
  const snapshot = snapshots.find(item => item.order === order);
  if (!snapshot) return;
  state.historyCheckpointId = snapshot.id;
  renderHistory();
});
document.getElementById('miniRankingSearch').addEventListener('input', renderMini);
document.getElementById('groupFilter').addEventListener('change', renderMatches);
document.getElementById('teamFilter').addEventListener('change', renderMatches);
document.getElementById('statusFilter').addEventListener('change', renderMatches);
document.getElementById('compareMatchSelect').addEventListener('change', e => {
  state.compareMatchId = e.target.value;
  renderCompare();
});
document.getElementById('groupStandingsView').addEventListener('change', e => {
  state.groupStandingsView = e.target.value;
  renderGroupStandings();
});
document.getElementById('teamsSearch').addEventListener('input', renderTeams);
document.addEventListener('change', e => {
  const comparePlayerSelect = e.target.closest('[data-compare-player-select]');
  if (!comparePlayerSelect) return;
  if (comparePlayerSelect.value && !state.comparePlayers.includes(comparePlayerSelect.value)) {
    state.comparePlayers.push(comparePlayerSelect.value);
  }
  renderCompare();
});
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
document.getElementById('forceResultsSyncBtn').addEventListener('click', () => {
  runAdminManualSync(
    'forceResultsSyncBtn',
    'Refrescando...',
    () => refreshFromApi({ silent: true, force: true }),
    'Caché de resultados refrescada.',
    'No se pudo refrescar la caché de resultados.'
  );
});
document.getElementById('forceLiveMatchSyncBtn').addEventListener('click', () => {
  runAdminManualSync(
    'forceLiveMatchSyncBtn',
    'Refrescando...',
    () => refreshAsLiveMatch({ silent: true, force: true }),
    'Caché del directo AS refrescada.',
    'No se pudo refrescar la caché del directo AS.'
  );
});
document.getElementById('forceRankingsSyncBtn').addEventListener('click', () => {
  runAdminManualSync(
    'forceRankingsSyncBtn',
    'Refrescando...',
    () => refreshStatsRankings({ buttonId: 'forceRankingsSyncBtn', notifyWithAlert: false }),
    'Caché de rankings AS refrescada.',
    'No se pudo refrescar la caché de rankings AS.'
  );
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

async function initializeResultsFlow() {
  const loadedFromSupabase = await bootstrapWorldcupResultsCache();
  if (!loadedFromSupabase || !lastApiRefreshAt || (Date.now() - lastApiRefreshAt) >= API_RESUME_REFRESH_THRESHOLD_MS) {
    refreshFromApi({ silent: true });
  }
}

async function initializeAsLiveMatchFlow() {
  try {
    const loaded = await loadAsLiveMatchCache();
    renderSummary();
    if (!loaded || !lastAsLiveMatchRefreshAt || (Date.now() - lastAsLiveMatchRefreshAt) >= getAsLiveMatchRefreshIntervalMs()) {
      refreshAsLiveMatch({ silent: true });
      return;
    }
  } catch (error) {
    console.warn('No se pudo cargar el cache del directo de AS:', error);
  }

  scheduleAsLiveMatchRefresh();
}

applyTheme(document.documentElement.dataset.theme);
applyAdminMode();
updateGoalNotificationsButton();
renderAll();
initializeResultsFlow();
initializeAsLiveMatchFlow();
loadMiniResultsFromSupabase();
loadStatsRankings();
initializeAuth();
disablePwa();
registerPwa();
setupInstallPrompt();
checkForAppUpdate();
setInterval(() => refreshFromApi({ silent: true }), API_REFRESH_INTERVAL_MS);
setInterval(checkForAppUpdate, VERSION_CHECK_INTERVAL_MS);
setInterval(() => {
  if (!isAsLiveMatchVisible(state.asLiveMatch)) return;
  renderSummary();
}, AS_LIVE_MATCH_UI_TICK_MS);
window.addEventListener('online', maybeRefreshFromApiOnResume);
window.addEventListener('online', maybeRefreshAsLiveMatchOnResume);
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  maybeRefreshFromApiOnResume();
  maybeRefreshAsLiveMatchOnResume();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    maybeRefreshFromApiOnResume();
    maybeRefreshAsLiveMatchOnResume();
  }
});
