import { createClient } from '@supabase/supabase-js';
import { scorePrediction } from '../../src/lib/porra-core.js';
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
  myDraft: {},         // ediciones sin guardar: { match_id: "2-1" }
  playerDetailId: null, // jugador seleccionado en "Detalle jugador"
  matchGoalsExpanded: {}, // { match_id: true } goleadores desplegados
  selectedTeamId: null, // equipo seleccionado en "Equipos"
  teamsQuery: ''         // texto del buscador de equipos
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
  const $sub = document.getElementById('porra-subtitle');
  if ($sub) $sub.textContent = PORRA_STATUS_LABELS[state.porra.status] || '';
  renderSessionBar();

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
  { key: 'mini', label: 'Mini-porra', ready: false },
  { key: 'matches', label: 'Partidos', ready: true },
  { key: 'knockout', label: 'Cruces', ready: false },
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

function renderRanking() {
  const rows = computeRanking();
  const played = state.matches.filter(m => m.stage === 'group' && matchResult(m)).length;
  $app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Clasificación porra</h2>
        <span class="hint">${played} partido(s) de grupo con resultado</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th class="table-center">#</th><th>Participante</th><th class="table-center">Puntos</th><th class="table-center">Exactos</th><th class="table-center">Signo</th></tr></thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr class="${i < 3 ? 'rank-' + (i + 1) : ''}">
                <td class="ranking-position">${i + 1}</td>
                <td class="${r.player.player_id === state.myPlayerId ? 'standing-team' : ''}">${esc(r.player.name)}${r.player.player_id === state.myPlayerId ? ' <span class="pill">tú</span>' : ''}</td>
                <td class="table-center points">${r.points}</td>
                <td class="table-center">${r.exact}</td>
                <td class="table-center">${r.sign}</td>
              </tr>`).join('') || `<tr><td colspan="5" class="empty-state">Sin jugadores todavía.</td></tr>`}
          </tbody>
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
          <thead><tr><th>Grupo</th><th>Partido</th><th class="table-center">Mi marcador</th></tr></thead>
          <tbody>
            ${groupMatches.map(m => {
              const saved = predictionFor(state.myPlayerId, m.match_id);
              const val = state.myDraft[m.match_id] ?? (saved ? saved.score : '');
              return `<tr>
                <td>${esc(m.group_id || '')}</td>
                <td>${teamFlag(m.team1)} ${esc(teamName(m.team1))} – ${esc(teamName(m.team2))} ${teamFlag(m.team2)}</td>
                <td class="table-center"><input class="score-input" data-match="${esc(m.match_id)}"
                     value="${esc(val)}" placeholder="2-1" ${open ? '' : 'disabled'} /></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${open ? `<div class="actions"><button data-action="save-mine" class="primary">Guardar</button>
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
  if (input) { state.myDraft[input.dataset.match] = input.value.trim(); return; }

  const search = e.target.closest('[data-action="teams-search"]');
  if (search) {
    state.teamsQuery = search.value;
    const caret = search.selectionStart;
    render();
    const again = document.querySelector('[data-action="teams-search"]');
    if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch {} }
  }
});

document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-action="select-player"]');
  if (sel) { state.playerDetailId = sel.value; render(); }
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
