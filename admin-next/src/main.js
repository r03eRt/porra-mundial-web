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
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semifinales' },
  { key: 'final', label: 'Final' }
];

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
  detailError: '',
  error: ''
};

const $app = document.getElementById('app');
const $session = document.getElementById('session');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

function syncCurrentPorraFromList() {
  if (!state.currentPorra) return;
  state.currentPorra = state.porras.find(p => p.id === state.currentPorra.id) || state.currentPorra;
}

function groupMatchKey(groupId, team1Id, team2Id) {
  return [groupId || '', ...[team1Id, team2Id].sort()].join('::');
}

function buildGroupMatches(firstKickoffRaw) {
  const existing = new Set(state.matches
    .filter(match => (match.phase ?? match.stage) === 'group')
    .map(match => groupMatchKey(
      match.group_id ?? match.group_label,
      match.team1_id ?? match.team1,
      match.team2_id ?? match.team2
    )));
  const firstKickoff = firstKickoffRaw ? new Date(firstKickoffRaw) : null;
  const rows = [];

  for (const group of state.groups) {
    const groupTeams = state.teams
      .filter(team => team.group_id === group.group_id)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    for (let i = 0; i < groupTeams.length; i += 1) {
      for (let j = i + 1; j < groupTeams.length; j += 1) {
        const team1 = groupTeams[i];
        const team2 = groupTeams[j];
        const matchKey = groupMatchKey(group.group_id, team1.team_id, team2.team_id);
        if (existing.has(matchKey)) continue;
        const kickoff = firstKickoff
          ? new Date(firstKickoff.getTime() + rows.length * 2 * 60 * 60 * 1000).toISOString()
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
          status: 'scheduled'
        });
        existing.add(matchKey);
      }
    }
  }

  return rows;
}

// ── Data loaders ───────────────────────────────────────────────────────────────

async function loadPorras() {
  const { data, error } = await supabase
    .from('porras')
    .select('id, slug, name, event_type, status, created_at')
    .order('created_at', { ascending: false });
  if (error) { state.error = error.message; state.porras = []; return; }
  state.porras = (data || []).map(p => ({ ...p, status: normalizePorraStatus(p.status) }));
  syncCurrentPorraFromList();
}

async function loadDetail(porraId) {
  state.detailError = '';
  const [teamsRes, groupsRes, matchesRes, playersRes] = await Promise.all([
    supabase.from('porra_teams').select('*').eq('porra_id', porraId).order('name'),
    supabase.from('porra_groups').select('*').eq('porra_id', porraId).order('name'),
    supabase.from('porra_matches').select('*').eq('porra_id', porraId).order('kickoff'),
    supabase.from('porra_players').select('*').eq('porra_id', porraId).order('joined_at')
  ]);
  if (teamsRes.error) state.detailError = teamsRes.error.message;
  if (groupsRes.error) state.detailError = groupsRes.error.message;
  if (matchesRes.error) state.detailError = matchesRes.error.message;
  if (playersRes.error) state.detailError = playersRes.error.message;
  state.teams = teamsRes.data || [];
  state.groups = groupsRes.data || [];
  state.matches = matchesRes.data || [];
  state.players = playersRes.data || [];
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
  const porrasList = state.porras.length
    ? state.porras.map(p => `
        <li class="porra-row">
          <div>
            <strong>${esc(p.name)}</strong>
            <span class="muted"> · ${esc(p.event_type)} · ${esc(porraStatusLabel(p.status))}</span>
          </div>
          <button type="button" class="btn-secondary open-porra" data-id="${esc(p.id)}">&rarr; Gestionar</button>
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

  const playersRows = state.players.map(player => `
    <tr>
      <td>${esc(player.display_name ?? player.name ?? player.player_id)}</td>
      <td><code>${esc(player.player_id)}</code></td>
      <td>${esc(player.joined_at ? new Date(player.joined_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—')}</td>
      <td><button type="button" class="btn-danger btn-sm del-player" data-id="${esc(player.player_id)}">✕</button></td>
    </tr>
  `).join('');

  // Teams table
  const teamsRows = state.teams.map(t => {
    const grp = state.groups.find(g => g.group_id === t.group_id);
    const flag = t.flag || flagForTeam(t.name);
    return `<tr>
      <td>${esc(flag)}</td>
      <td>${esc(t.name)}</td>
      <td>${grp ? esc(grp.name) : '<span class="muted">—</span>'}</td>
      <td><button type="button" class="btn-danger btn-sm del-team" data-id="${esc(t.team_id)}">✕</button></td>
    </tr>`;
  }).join('');

  const groupOptions = state.groups.map(g =>
    `<option value="${esc(g.group_id)}">${esc(g.name)}</option>`).join('');
  const teamOptions = state.teams.map(t =>
    `<option value="${esc(t.team_id)}">${esc(t.flag || flagForTeam(t.name))} ${esc(t.name)}</option>`).join('');
  const catalogTeamOptions = TEAM_CATALOG.map(t =>
    `<option value="${esc(t.name)}">${esc(t.flag)} ${esc(t.name)}</option>`).join('');

  // Matches table
  const matchRows = state.matches.map(m => {
    const team1Id = m.team1_id ?? m.team1;
    const team2Id = m.team2_id ?? m.team2;
    const t1 = state.teams.find(t => t.team_id === team1Id);
    const t2 = state.teams.find(t => t.team_id === team2Id);
    const when = m.kickoff ? new Date(m.kickoff).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const phaseKey = m.phase ?? (m.stage === 'group' ? 'group' : m.round_key);
    const phase = phaseKey === 'group'
      ? (m.group_label ?? m.group_id ? `Grupo ${m.group_label ?? m.group_id}` : 'Fase de grupos')
      : (KNOCKOUT_ROUNDS.find(r => r.key === phaseKey)?.label ?? phaseKey ?? '—');
    const scoreHome = m.score_home ?? m.result_home ?? '';
    const scoreAway = m.score_away ?? m.result_away ?? '';
    const matchStatus = m.status ?? ((scoreHome !== '' && scoreAway !== '') ? 'finished' : 'scheduled');
    return `<tr>
      <td>${esc(phase)}</td>
      <td>${t1 ? `${esc(t1.flag || flagForTeam(t1.name))} ${esc(t1.name)}` : '—'}</td>
      <td>
        <form class="score-form" data-id="${esc(m.match_id)}">
          <input name="score_home" type="number" min="0" inputmode="numeric" value="${esc(scoreHome)}" aria-label="Marcador local" />
          <span class="muted">-</span>
          <input name="score_away" type="number" min="0" inputmode="numeric" value="${esc(scoreAway)}" aria-label="Marcador visitante" />
          <button type="submit" class="btn-secondary btn-sm">Guardar</button>
        </form>
      </td>
      <td>${t2 ? `${esc(t2.flag || flagForTeam(t2.name))} ${esc(t2.name)}` : '—'}</td>
      <td>${esc(when)}</td>
      <td>${esc(matchStatus === 'finished' ? 'Finalizado' : 'Pendiente')}</td>
      <td><button type="button" class="btn-danger btn-sm del-match" data-id="${esc(m.match_id)}">✕</button></td>
    </tr>`;
  }).join('');

  // Group options for match form
  const groupOptMatch = `<option value="">— sin grupo —</option>` +
    state.groups.map(g => `<option value="${esc(g.group_id)}">${esc(g.name)}</option>`).join('');
  const knockoutOpts = KNOCKOUT_ROUNDS.map(r =>
    `<option value="${esc(r.key)}">${esc(r.label)}</option>`).join('');

  return `
    <div class="detail-header">
      <button type="button" id="backBtn" class="btn-secondary">&larr; Volver</button>
      <h2 style="margin:0">${esc(p.name)}</h2>
      <code class="muted">${esc(p.slug)}</code>
      <span class="status-pill">${esc(porraStatusLabel(p.status))}</span>
      <button type="button" id="advanceStatusBtn" class="btn-secondary" ${nextStatus ? '' : 'disabled'}>
        ${nextStatus ? `Pasar a ${esc(porraStatusLabel(nextStatus).toLowerCase())}` : 'Porra cerrada'}
      </button>
    </div>
    ${state.detailError ? `<p class="error">${esc(state.detailError)}</p>` : ''}

    <!-- JUGADORES -->
    <section class="card">
      <h2>Jugadores <span class="muted">(${state.players.length})</span></h2>
      ${state.players.length
        ? `<div class="table-wrap"><table class="data-table">
            <thead><tr><th>Nombre</th><th>ID jugador</th><th>Alta</th><th></th></tr></thead>
            <tbody>${playersRows}</tbody>
          </table></div>`
        : `<p class="muted">Sin jugadores todavía.</p>`}
      <form id="addPlayerForm" class="form inline-form" style="margin-top:.75rem">
        <input name="email" type="email" placeholder="jugador@correo.com" required style="flex:1" />
        <button type="submit">+ Añadir jugador</button>
      </form>
      <span class="error" id="playerError"></span>
    </section>

    <!-- GRUPOS -->
    <section class="card">
      <h2>Grupos</h2>
      ${state.groups.length
        ? `<ul class="group-chips">${state.groups.map(g =>
            `<li>${esc(g.name)} <button type="button" class="btn-danger btn-sm del-group" data-id="${esc(g.group_id)}">✕</button></li>`
          ).join('')}</ul>`
        : `<p class="muted">Sin grupos todavía.</p>`}
      <form id="addGroupForm" class="form inline-form">
        <input name="groupName" type="text" placeholder="A" maxlength="10" style="width:80px" required />
        <button type="submit">+ Añadir grupo</button>
      </form>
    </section>

    <!-- EQUIPOS -->
    <section class="card">
      <h2>Equipos <span class="muted">(${state.teams.length})</span></h2>
      ${state.teams.length
        ? `<div class="table-wrap"><table class="data-table">
            <thead><tr><th></th><th>Nombre</th><th>Grupo</th><th></th></tr></thead>
            <tbody>${teamsRows}</tbody>
          </table></div>`
        : `<p class="muted">Sin equipos todavía.</p>`}
      <form id="addTeamForm" class="form inline-form" style="margin-top:.75rem">
        <select name="catalogTeam" id="catalogTeam" style="flex:1" required>
          <option value="">Equipo</option>
          ${catalogTeamOptions}
          <option value="__custom">Personalizado</option>
        </select>
        <input name="flag" id="customTeamFlag" type="text" placeholder="Bandera" style="width:80px;display:none" />
        <input name="teamName" id="customTeamName" type="text" placeholder="Nombre del equipo" style="flex:1;display:none" />
        <select name="groupId" style="width:120px">
          <option value="">Sin grupo</option>
          ${groupOptions}
        </select>
        <button type="submit">+ Añadir</button>
      </form>
      <span class="error" id="teamError"></span>
    </section>

    <!-- PARTIDOS -->
    <section class="card">
      <h2>Partidos <span class="muted">(${state.matches.length})</span></h2>
      ${state.matches.length
        ? `<div class="table-wrap"><table class="data-table">
            <thead><tr><th>Fase</th><th>Local</th><th>Resultado</th><th>Visitante</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
            <tbody>${matchRows}</tbody>
          </table></div>`
        : `<p class="muted">Sin partidos todavía.</p>`}
      <form id="generateGroupMatchesForm" class="form inline-form" style="margin-top:.75rem">
        <label>Fecha inicial (opcional)
          <input name="firstKickoff" type="datetime-local" />
        </label>
        <button type="submit">Generar fase de grupos</button>
      </form>
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
  let slugTouched = false;
  slugInput.addEventListener('input', () => { slugTouched = true; });
  nameInput.addEventListener('input', () => {
    if (!slugTouched) slugInput.value = slugify(nameInput.value);
  });
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
  const deadlineRaw = String(fd.get('deadline') || '');
  const features = {};
  for (const f of FEATURES) features[f.key] = false;
  form.querySelectorAll('[name=feature]:checked').forEach(el => { features[el.value] = true; });

  const { error } = await supabase.from('porras').insert({
    name, slug, event_type: eventType, status: 'draft',
    owner: state.user.id,
    predictions_deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
    scoring: { groupExact: 3, groupSign: 2 },
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
  if (!state.currentPorra) return;
  await loadDetail(id);
  render();
}

async function handleAddGroup(form) {
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

async function handleAddTeam(form) {
  const errorEl = document.getElementById('teamError');
  const fd = new FormData(form);
  const catalogTeam = String(fd.get('catalogTeam') || '').trim();
  const customName = String(fd.get('teamName') || '').trim();
  const customFlag = String(fd.get('flag') || '').trim();
  const name = catalogTeam === '__custom' ? customName : catalogTeam;
  const flag = catalogTeam === '__custom' ? (customFlag || flagForTeam(customName)) : flagForTeam(catalogTeam);
  const groupId = String(fd.get('groupId') || '').trim() || null;
  if (!name) return;
  const { error } = await supabase.from('porra_teams').insert({
    porra_id: state.currentPorra.id,
    team_id: makeEntityId('team'),
    name,
    flag: flag || null,
    group_id: groupId || null
  });
  if (error) { errorEl.textContent = error.message; return; }
  form.reset();
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
  const rows = buildGroupMatches(firstKickoffRaw);
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

async function handleAddPlayer(form) {
  const errorEl = document.getElementById('playerError');
  const btn = form.querySelector('button[type=submit]');
  const email = String(new FormData(form).get('email') || '').trim();
  if (!email) return;
  btn.disabled = true;
  errorEl.textContent = '';
  const { error } = await supabase.rpc('pp_add_player_by_email', {
    p_porra_id: state.currentPorra.id,
    p_email: email
  });
  if (error) {
    errorEl.textContent = error.message;
    btn.disabled = false;
    return;
  }
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
}

async function saveMatchResult(form) {
  const matchId = form.dataset.id;
  const fd = new FormData(form);
  const homeRaw = String(fd.get('score_home') || '').trim();
  const awayRaw = String(fd.get('score_away') || '').trim();
  if (homeRaw === '' || awayRaw === '') {
    state.detailError = 'Introduce los dos marcadores antes de guardar.';
    render();
    return;
  }
  const scoreHome = Number(homeRaw);
  const scoreAway = Number(awayRaw);
  if (!Number.isInteger(scoreHome) || !Number.isInteger(scoreAway) || scoreHome < 0 || scoreAway < 0) {
    state.detailError = 'Los marcadores deben ser números enteros iguales o mayores que 0.';
    render();
    return;
  }
  const { error } = await supabase
    .from('porra_matches')
    .update({
      score_home: scoreHome,
      score_away: scoreAway,
      result_home: scoreHome,
      result_away: scoreAway,
      status: 'finished'
    })
    .eq('porra_id', state.currentPorra.id)
    .eq('match_id', matchId);
  if (error) { state.detailError = error.message; render(); return; }
  await loadDetail(state.currentPorra.id);
  render();
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
  if (e.target.id === 'addGroupForm') { e.preventDefault(); handleAddGroup(e.target); }
  if (e.target.id === 'addTeamForm')  { e.preventDefault(); handleAddTeam(e.target); }
  if (e.target.id === 'addMatchForm') { e.preventDefault(); handleAddMatch(e.target); }
  if (e.target.id === 'generateGroupMatchesForm') { e.preventDefault(); handleGenerateGroupMatches(e.target); }
  if (e.target.classList.contains('score-form')) { e.preventDefault(); saveMatchResult(e.target); }
});

document.addEventListener('click', e => {
  if (e.target.id === 'logoutBtn')              supabase.auth.signOut().then(refreshAuth);
  if (e.target.id === 'backBtn')                { state.currentPorra = null; render(); }
  if (e.target.id === 'advanceStatusBtn')       advancePorraStatus();
  if (e.target.classList.contains('open-porra')) openPorra(e.target.dataset.id);
  if (e.target.classList.contains('del-player')) deletePlayer(e.target.dataset.id);
  if (e.target.classList.contains('del-team'))   deleteTeam(e.target.dataset.id);
  if (e.target.classList.contains('del-group'))  deleteGroup(e.target.dataset.id);
  if (e.target.classList.contains('del-match'))  deleteMatch(e.target.dataset.id);
});

supabase.auth.onAuthStateChange(() => { refreshAuth(); });
refreshAuth();
