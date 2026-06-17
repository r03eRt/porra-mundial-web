import { createClient } from '@supabase/supabase-js';
import { KNOCKOUT_STAGES, buildPlayerKnockoutBracket } from './lib/knockout-bracket.js';
import { normalize, parseScore, playerNamesMatch, signFromScore, statsCountryFlag, statsCountryLabel } from './lib/statistics-utils.js';
import { TEAM_DETAIL_METRICS, calculateTeamStats, getTournamentTeams } from './lib/team-stats.js';
import { buildFinalNotification, buildGoalNotification, collectLiveAlertEvents } from './lib/live-alerts.js';
import { simulateProbabilities } from './lib/probabilities.js';

const DATA = window.PORRA_DATA;
const DEFAULT_API_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const API_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const API_FETCH_TIMEOUT_MS = 10000;
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LIVE_ALERTS_POLL_INTERVAL_MS = 60 * 1000;
const API_RESUME_REFRESH_THRESHOLD_MS = 2 * 60 * 1000;
const PWA_ENABLED = false;
const SUPABASE_URL = 'https://tsbjhbpdvewqysgmrhci.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw';
const WORLDCUP_RESULTS_TABLE = 'worldcup_results_cache';
const WORLDCUP_RESULTS_KIND = 'openfootball-2026';
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
  comparePlayers: []
};
let apiRefreshInProgress = false;
let dismissedVersion = null;
let serviceWorkerRegistration = null;
let deferredInstallPrompt = null;
let liveAlertsPollTimer = null;
let liveAlertsRefreshInFlight = false;
let appToastTimer = null;
let lastApiRefreshAt = Number(localStorage.getItem(LS_KEYS.apiRefreshAt) || 0);
let lastVersionCheckAt = 0;
let lastResumeRefreshAt = 0;
let lastLiveAlertsKickAt = 0;
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

function updateLiveAlertsUi() {
  const button = document.getElementById('liveAlertsBtn');
  if (!button) return;

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

function kickLiveAlertsRefresh({ baseline = false } = {}) {
  const now = Date.now();
  if (!baseline && now - lastLiveAlertsKickAt < 15000) return;
  lastLiveAlertsKickAt = now;
  refreshLiveAlerts({ baseline }).catch(() => {});
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

function renderSummary() {
  const played = DATA.matches.filter(getResult).length;
  const ranking = calculateRanking();
  const lastUpdate = localStorage.getItem(LS_KEYS.lastUpdate) || 'sin actualizar';
  document.getElementById('summaryCards').innerHTML = html`
    <article class="card"><b>${DATA.players.length}</b><span>participantes</span></article>
    <article class="card"><b>${played}/${DATA.matches.length}</b><span>partidos con resultado</span></article>
    <article class="card"><b>${ranking[0] ? `⭐ ${ranking[0].name}` : '-'}</b><span>líder actual</span></article>
    <article class="card"><b>${ranking[0]?.total || 0}</b><span>puntos del líder</span></article>
    <article class="card"><b>${ranking.length ? `💩 ${ranking[ranking.length - 1].name}` : '-'}</b><span>el purria</span></article>
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
      ${sortableHeader('ranking', 'signs', 'Aciertos', state.rankingSort)}
      ${sortableHeader('ranking', 'knockoutPoints', 'Cruces', state.rankingSort)}
    </tr></thead>
    <tbody>${rows.map(player => html`
      <tr class="${player.position <= 3 ? `rank-${player.position}` : ''}">
        <td class="ranking-position">${medals[player.position - 1] || (player.position === ranking.length ? '💩' : player.position)}</td>
        <td>${player.name}</td>
        <td class="points">${player.total}</td>
        <td>${player.groupPoints}</td>
        <td>${player.exacts}</td>
        <td>${player.signs + player.exacts}</td>
        <td>${player.knockoutPoints}</td>
      </tr>`).join('')}</tbody>
  `;
}

function compareStatus(score) {
  if (!score.points) return { label: 'Fallado', className: 'bad' };
  if (score.exact) return { label: 'Exacto', className: 'ok' };
  return { label: 'Quiniela', className: 'points' };
}

function comparePlayerCard(player, prediction, result, index) {
  const score = scorePrediction(prediction, result);
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

function renderAll() { renderSummary(); renderFilters(); renderRanking(); renderProbabilities(); renderCompare(); renderMatches(); renderTeams(); renderStatistics(); renderGroupStandings(); renderBestThirds(); renderTopScorers(); renderPlayerDetail(); renderKnockout(); renderMini(); renderSettings(); }

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
  if (data.updated_at) {
    localStorage.setItem(LS_KEYS.lastUpdate, new Date(data.updated_at).toLocaleString('es-ES'));
  }
  return true;
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
  renderHeaderSyncStatus();
  state.rankingLoading = !Object.keys(state.apiResults).length;
  if (state.rankingLoading) renderRanking();
  const btn = document.getElementById('refreshApiBtn');
  btn.disabled = true; btn.textContent = 'Actualizando...';
  try {
    const syncResponse = await fetchJsonWithTimeout(`${SUPABASE_URL}/functions/v1/sync-worldcup-results`, {
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
  } catch (err) {
    console.warn('Fallo leyendo resultados desde Supabase cacheado. Intentando fallback directo...', err);
    try {
      const res = await fetchJsonWithTimeout(state.apiUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      applyResultsPayload(json);
      state.rankingLoading = false;
      localStorage.setItem(LS_KEYS.lastUpdate, new Date().toLocaleString('es-ES'));
      renderAll();
    } catch (fallbackError) {
      state.rankingLoading = false;
      renderRanking();
      if (!silent) alert('No se pudieron actualizar los resultados automáticos. Error: ' + fallbackError.message);
      console.error('Error al actualizar los resultados automáticos:', fallbackError);
    }
  } finally {
    apiRefreshInProgress = false;
    btn.disabled = false;
    btn.textContent = 'Actualizar datos';
    renderHeaderSyncStatus();
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

applyTheme(document.documentElement.dataset.theme);
applyAdminMode();
updateLiveAlertsUi();
renderAll();
initializeResultsFlow();
loadMiniResultsFromSupabase();
loadStatsRankings();
initializeAuth();
disablePwa();
registerPwa();
setupInstallPrompt();
checkForAppUpdate();
startLiveAlertsPolling();
kickLiveAlertsRefresh({ baseline: true });
setInterval(() => refreshFromApi({ silent: true }), API_REFRESH_INTERVAL_MS);
setInterval(checkForAppUpdate, VERSION_CHECK_INTERVAL_MS);
window.addEventListener('focus', checkForAppUpdate);
window.addEventListener('focus', maybeRefreshFromApiOnResume);
window.addEventListener('online', maybeRefreshFromApiOnResume);
window.addEventListener('focus', () => kickLiveAlertsRefresh());
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  checkForAppUpdate();
  maybeRefreshFromApiOnResume();
  kickLiveAlertsRefresh();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForAppUpdate();
    maybeRefreshFromApiOnResume();
    kickLiveAlertsRefresh();
  }
});
