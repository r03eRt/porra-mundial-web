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

// ── Data loaders ───────────────────────────────────────────────────────────────

async function loadPorras() {
  const { data, error } = await supabase
    .from('porras')
    .select('id, slug, name, event_type, status, created_at')
    .order('created_at', { ascending: false });
  if (error) { state.error = error.message; state.porras = []; return; }
  state.porras = data || [];
}

async function loadDetail(porraId) {
  state.detailError = '';
  const [teamsRes, groupsRes, matchesRes] = await Promise.all([
    supabase.from('porra_teams').select('*').eq('porra_id', porraId).order('name'),
    supabase.from('porra_groups').select('*').eq('porra_id', porraId).order('name'),
    supabase.from('porra_matches').select('*').eq('porra_id', porraId).order('kickoff')
  ]);
  if (teamsRes.error) state.detailError = teamsRes.error.message;
  if (groupsRes.error) state.detailError = groupsRes.error.message;
  if (matchesRes.error) state.detailError = matchesRes.error.message;
  state.teams = teamsRes.data || [];
  state.groups = groupsRes.data || [];
  state.matches = matchesRes.data || [];
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
            <span class="muted"> · ${esc(p.event_type)} · ${esc(p.status)}</span>
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

  // Teams table
  const teamsRows = state.teams.map(t => {
    const grp = state.groups.find(g => g.id === t.group_id);
    return `<tr>
      <td>${esc(t.flag ?? '')}</td>
      <td>${esc(t.name)}</td>
      <td>${grp ? esc(grp.name) : '<span class="muted">—</span>'}</td>
      <td><button type="button" class="btn-danger btn-sm del-team" data-id="${esc(t.id)}">✕</button></td>
    </tr>`;
  }).join('');

  const groupOptions = state.groups.map(g =>
    `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
  const teamOptions = state.teams.map(t =>
    `<option value="${esc(t.id)}">${esc(t.flag ?? '')} ${esc(t.name)}</option>`).join('');

  // Matches table
  const matchRows = state.matches.map(m => {
    const t1 = state.teams.find(t => t.id === m.team1_id);
    const t2 = state.teams.find(t => t.id === m.team2_id);
    const when = m.kickoff ? new Date(m.kickoff).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const phase = m.phase === 'group' ? `Grupo ${m.group_label ?? ''}` : (KNOCKOUT_ROUNDS.find(r => r.key === m.phase)?.label ?? m.phase);
    return `<tr>
      <td>${esc(phase)}</td>
      <td>${t1 ? `${esc(t1.flag ?? '')} ${esc(t1.name)}` : '—'}</td>
      <td class="muted">vs</td>
      <td>${t2 ? `${esc(t2.flag ?? '')} ${esc(t2.name)}` : '—'}</td>
      <td>${esc(when)}</td>
      <td><button type="button" class="btn-danger btn-sm del-match" data-id="${esc(m.id)}">✕</button></td>
    </tr>`;
  }).join('');

  // Group options for match form
  const groupOptMatch = `<option value="">— sin grupo —</option>` +
    state.groups.map(g => `<option value="${esc(g.name)}">${esc(g.name)}</option>`).join('');
  const knockoutOpts = KNOCKOUT_ROUNDS.map(r =>
    `<option value="${esc(r.key)}">${esc(r.label)}</option>`).join('');

  return `
    <div class="detail-header">
      <button type="button" id="backBtn" class="btn-secondary">&larr; Volver</button>
      <h2 style="margin:0">${esc(p.name)}</h2>
      <code class="muted">${esc(p.slug)}</code>
    </div>
    ${state.detailError ? `<p class="error">${esc(state.detailError)}</p>` : ''}

    <!-- GRUPOS -->
    <section class="card">
      <h2>Grupos</h2>
      ${state.groups.length
        ? `<ul class="group-chips">${state.groups.map(g =>
            `<li>${esc(g.name)} <button type="button" class="btn-danger btn-sm del-group" data-id="${esc(g.id)}">✕</button></li>`
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
        <input name="flag" type="text" placeholder="🏴󠁧󠁢󠁥󠁮󠁧󠁿" style="width:60px" />
        <input name="teamName" type="text" placeholder="Nombre del equipo" required style="flex:1" />
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
            <thead><tr><th>Fase</th><th>Local</th><th></th><th>Visitante</th><th>Fecha</th><th></th></tr></thead>
            <tbody>${matchRows}</tbody>
          </table></div>`
        : `<p class="muted">Sin partidos todavía.</p>`}
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
  const { error } = await supabase.from('porra_groups').insert({ porra_id: state.currentPorra.id, name });
  if (error) { state.detailError = error.message; render(); return; }
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
}

async function handleAddTeam(form) {
  const errorEl = document.getElementById('teamError');
  const fd = new FormData(form);
  const name = String(fd.get('teamName') || '').trim();
  const flag = String(fd.get('flag') || '').trim() || null;
  const groupId = String(fd.get('groupId') || '').trim() || null;
  if (!name) return;
  const { error } = await supabase.from('porra_teams').insert({
    porra_id: state.currentPorra.id, name, flag, group_id: groupId || null
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
    team1_id: team1Id, team2_id: team2Id,
    phase, group_label: groupLabel,
    kickoff: kickoffRaw ? new Date(kickoffRaw).toISOString() : null,
    status: 'scheduled'
  });
  if (error) { errorEl.textContent = error.message; return; }
  form.reset();
  await loadDetail(state.currentPorra.id);
  render();
}

async function deleteTeam(id) {
  await supabase.from('porra_teams').delete().eq('id', id);
  await loadDetail(state.currentPorra.id);
  render();
}

async function deleteGroup(id) {
  await supabase.from('porra_groups').delete().eq('id', id);
  await loadDetail(state.currentPorra.id);
  render();
}

async function deleteMatch(id) {
  await supabase.from('porra_matches').delete().eq('id', id);
  await loadDetail(state.currentPorra.id);
  render();
}

// ── Event delegation ───────────────────────────────────────────────────────────

document.addEventListener('submit', e => {
  if (e.target.id === 'loginForm')    { e.preventDefault(); handleLogin(e.target); }
  if (e.target.id === 'createForm')   { e.preventDefault(); handleCreate(e.target); }
  if (e.target.id === 'addGroupForm') { e.preventDefault(); handleAddGroup(e.target); }
  if (e.target.id === 'addTeamForm')  { e.preventDefault(); handleAddTeam(e.target); }
  if (e.target.id === 'addMatchForm') { e.preventDefault(); handleAddMatch(e.target); }
});

document.addEventListener('click', e => {
  if (e.target.id === 'logoutBtn')              supabase.auth.signOut().then(refreshAuth);
  if (e.target.id === 'backBtn')                { state.currentPorra = null; render(); }
  if (e.target.classList.contains('open-porra')) openPorra(e.target.dataset.id);
  if (e.target.classList.contains('del-team'))   deleteTeam(e.target.dataset.id);
  if (e.target.classList.contains('del-group'))  deleteGroup(e.target.dataset.id);
  if (e.target.classList.contains('del-match'))  deleteMatch(e.target.dataset.id);
});

supabase.auth.onAuthStateChange(() => { refreshAuth(); });
refreshAuth();
