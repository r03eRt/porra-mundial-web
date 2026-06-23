import { createClient } from '@supabase/supabase-js';
import { scorePrediction } from '../../src/lib/porra-core.js';

const SUPABASE_URL = 'https://tsbjhbpdvewqysgmrhci.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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
  session: null,       // sesión Supabase Auth
  myPlayerId: null,    // player_id del usuario logueado en esta porra (o null)
  tab: 'ranking',
  myDraft: {}          // ediciones sin guardar: { match_id: "2-1" }
};

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
  const [teams, groups, matches, players, predictions] = await Promise.all([
    supabase.from('porra_teams').select('*').eq('porra_id', id).order('position'),
    supabase.from('porra_groups').select('*').eq('porra_id', id).order('position'),
    supabase.from('porra_matches').select('*').eq('porra_id', id).order('position'),
    supabase.from('porra_players').select('*').eq('porra_id', id).order('position'),
    supabase.from('porra_predictions').select('*').eq('porra_id', id)
  ]);
  state.teams = teams.data || [];
  state.groups = groups.data || [];
  state.matches = matches.data || [];
  state.players = players.data || [];
  state.predictions = predictions.data || [];

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
}

// ---------------------------------------------------------------------------
// Helpers de dominio
// ---------------------------------------------------------------------------
function teamName(teamId) {
  const t = state.teams.find(x => x.team_id === teamId);
  return t ? t.name : (teamId || '—');
}
function teamFlag(teamId) {
  const t = state.teams.find(x => x.team_id === teamId);
  return t && t.flag ? t.flag : '';
}
function scoringConfig() {
  const s = state.porra?.scoring || {};
  return { groupExact: s.groupExact ?? 3, groupSign: s.groupSign ?? 1 };
}
function matchResult(match) {
  if (match.result_home === null || match.result_away === null) return null;
  return { home: match.result_home, away: match.result_away };
}
function predictionFor(playerId, matchId) {
  return state.predictions.find(p => p.player_id === playerId && p.match_id === matchId) || null;
}

function computeRanking() {
  const scoring = scoringConfig();
  const groupMatches = state.matches.filter(m => m.stage === 'group');
  return state.players.map(player => {
    let points = 0, exact = 0, sign = 0;
    for (const match of groupMatches) {
      const result = matchResult(match);
      if (!result) continue;
      const pred = predictionFor(player.player_id, match.match_id);
      if (!pred) continue;
      const r = scorePrediction({ score: pred.score }, result, scoring);
      points += r.points;
      if (r.exact) exact++;
      else if (r.sign) sign++;
    }
    return { player, points, exact, sign };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact);
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
  renderSessionBar();
  renderTabs();

  switch (state.tab) {
    case 'ranking': renderRanking(); break;
    case 'matches': renderMatches(); break;
    case 'mine': renderMyPorra(); break;
    default: renderRanking();
  }
}

function renderNoSlug() {
  $title.textContent = 'Porra';
  $tabs.innerHTML = '';
  $session.innerHTML = '';
  $app.innerHTML = `<div class="card"><p>Abre una porra con la URL <code>/p/&lt;slug&gt;</code>.</p></div>`;
}
function renderNotFound() {
  $title.textContent = 'Porra';
  $tabs.innerHTML = '';
  $session.innerHTML = '';
  $app.innerHTML = `<div class="card"><p>No existe ninguna porra con el slug <strong>${esc(state.slug)}</strong>.</p></div>`;
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

function renderTabs() {
  const tabs = [
    { key: 'ranking', label: 'Clasificación' },
    { key: 'matches', label: 'Partidos' }
  ];
  if (state.myPlayerId) tabs.push({ key: 'mine', label: 'Mi porra' });
  $tabs.innerHTML = tabs.map(t =>
    `<button class="tab ${state.tab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`
  ).join('');
}

function renderRanking() {
  const rows = computeRanking();
  const played = state.matches.filter(m => m.stage === 'group' && matchResult(m)).length;
  $app.innerHTML = `
    <div class="card">
      <h2>Clasificación</h2>
      <p class="muted">${played} partido(s) de grupo con resultado.</p>
      <table class="data">
        <thead><tr><th>#</th><th>Jugador</th><th>Puntos</th><th>Exactos</th><th>Signo</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr class="${r.player.player_id === state.myPlayerId ? 'me' : ''}">
              <td>${i + 1}</td>
              <td>${esc(r.player.name)}</td>
              <td><strong>${r.points}</strong></td>
              <td>${r.exact}</td>
              <td>${r.sign}</td>
            </tr>`).join('') || `<tr><td colspan="5" class="muted">Sin jugadores todavía.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function renderMatches() {
  const groupMatches = state.matches.filter(m => m.stage === 'group');
  $app.innerHTML = `
    <div class="card">
      <h2>Partidos</h2>
      <table class="data">
        <thead><tr><th>Grupo</th><th>Partido</th><th>Resultado</th></tr></thead>
        <tbody>
          ${groupMatches.map(m => {
            const r = matchResult(m);
            return `<tr>
              <td>${esc(m.group_id || '')}</td>
              <td>${teamFlag(m.team1)} ${esc(teamName(m.team1))} – ${esc(teamName(m.team2))} ${teamFlag(m.team2)}</td>
              <td>${r ? `${r.home} - ${r.away}` : '<span class="muted">pendiente</span>'}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="3" class="muted">Sin partidos todavía.</td></tr>`}
        </tbody>
      </table>
    </div>`;
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
    <div class="card">
      <h2>Mi porra</h2>
      <p class="muted">${open
        ? `Edición abierta · cierre: ${deadlineTxt}`
        : `Edición cerrada (la porra no está abierta o pasó el deadline).`}</p>
      <table class="data">
        <thead><tr><th>Grupo</th><th>Partido</th><th>Mi marcador</th></tr></thead>
        <tbody>
          ${groupMatches.map(m => {
            const saved = predictionFor(state.myPlayerId, m.match_id);
            const val = state.myDraft[m.match_id] ?? (saved ? saved.score : '');
            return `<tr>
              <td>${esc(m.group_id || '')}</td>
              <td>${teamFlag(m.team1)} ${esc(teamName(m.team1))} – ${esc(teamName(m.team2))} ${teamFlag(m.team2)}</td>
              <td><input class="score-input" data-match="${esc(m.match_id)}"
                   value="${esc(val)}" placeholder="2-1" ${open ? '' : 'disabled'} /></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${open ? `<div class="actions"><button data-action="save-mine" class="primary">Guardar</button>
        <span id="save-status" class="muted"></span></div>` : ''}
    </div>`;
}

function renderLoginForm() {
  $app.innerHTML = `
    <div class="card narrow">
      <h2>Entrar para jugar</h2>
      <form id="login-form">
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

  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  if (action === 'show-login') { renderLoginForm(); return; }
  if (action === 'logout') {
    await supabase.auth.signOut();
    await refreshSession();
    state.tab = 'ranking';
    render();
    return;
  }
  if (action === 'save-mine') { await saveMine(); return; }
});

document.addEventListener('input', (e) => {
  const input = e.target.closest('.score-input');
  if (input) state.myDraft[input.dataset.match] = input.value.trim();
});

document.addEventListener('submit', async (e) => {
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
  if (!rows.length) { if (status) status.textContent = 'Nada que guardar.'; return; }

  const { error } = await supabase
    .from('porra_predictions')
    .upsert(rows, { onConflict: 'porra_id,player_id,match_id' });

  if (error) { if (status) status.textContent = 'Error: ' + error.message; return; }

  // Refrescar predicciones en memoria
  const { data } = await supabase.from('porra_predictions')
    .select('*').eq('porra_id', state.porra.id);
  state.predictions = data || [];
  state.myDraft = {};
  if (status) status.textContent = 'Guardado ✓';
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
