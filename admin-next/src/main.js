import { createClient } from '@supabase/supabase-js';

// Mismo proyecto Supabase que la app legacy; la publishable key es pública.
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

const state = {
  user: null,
  isAdmin: false,
  loading: true,
  porras: [],
  error: ''
};

const $app = document.getElementById('app');
const $session = document.getElementById('session');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function loadPorras() {
  const { data, error } = await supabase
    .from('porras')
    .select('id, slug, name, event_type, status, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    state.error = error.message;
    state.porras = [];
    return;
  }
  state.porras = data || [];
}

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

function renderSession() {
  if (state.user) {
    $session.innerHTML = `
      <span>${escapeHtml(state.user.email)}${state.isAdmin ? ' · admin' : ''}</span>
      <button type="button" id="logoutBtn">Salir</button>
    `;
  } else {
    $session.innerHTML = '';
  }
}

function render() {
  renderSession();

  if (state.loading) {
    $app.innerHTML = `<p class="muted">Cargando…</p>`;
    return;
  }

  if (!state.user) {
    $app.innerHTML = `
      <section class="card">
        <h2>Acceso administrador</h2>
        <form id="loginForm" class="form">
          <input name="email" type="email" placeholder="Email" autocomplete="username" required />
          <input name="password" type="password" placeholder="Contraseña" autocomplete="current-password" required />
          <button type="submit">Entrar</button>
          <span class="error" id="loginError"></span>
        </form>
      </section>
    `;
    return;
  }

  if (!state.isAdmin) {
    $app.innerHTML = `
      <section class="card">
        <h2>Sin permisos</h2>
        <p class="muted">Tu cuenta no es administrador de plataforma, así que no puede crear porras.</p>
      </section>
    `;
    return;
  }

  const eventOptions = EVENT_TYPES
    .map(e => `<option value="${e.value}">${escapeHtml(e.label)}</option>`)
    .join('');
  const featureChecks = FEATURES
    .map(f => `<label class="check"><input type="checkbox" name="feature" value="${f.key}" checked /> ${escapeHtml(f.label)}</label>`)
    .join('');
  const porrasList = state.porras.length
    ? state.porras.map(p => `
        <li class="porra-row">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <span class="muted"> · ${escapeHtml(p.event_type)} · ${escapeHtml(p.status)}</span>
          </div>
          <code>${escapeHtml(p.slug)}</code>
        </li>
      `).join('')
    : `<li class="muted">Aún no hay porras. Crea la primera.</li>`;

  $app.innerHTML = `
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
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ''}
    </section>
  `;

  // Autorrellenar slug a partir del nombre mientras no se haya tocado a mano.
  const form = document.getElementById('createForm');
  const nameInput = form.querySelector('[name=name]');
  const slugInput = form.querySelector('[name=slug]');
  let slugTouched = false;
  slugInput.addEventListener('input', () => { slugTouched = true; });
  nameInput.addEventListener('input', () => {
    if (!slugTouched) slugInput.value = slugify(nameInput.value);
  });
}

async function handleLogin(form) {
  const errorEl = document.getElementById('loginError');
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  errorEl.textContent = '';
  const fd = new FormData(form);
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get('email') || ''),
    password: String(fd.get('password') || '')
  });
  if (error) {
    errorEl.textContent = 'Email o contraseña incorrectos.';
    btn.disabled = false;
    return;
  }
  await refreshAuth();
}

async function handleCreate(form) {
  const errorEl = document.getElementById('createError');
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  errorEl.textContent = '';
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const slug = (String(fd.get('slug') || '').trim() || slugify(name));
  const eventType = String(fd.get('event_type') || 'custom');
  const deadlineRaw = String(fd.get('deadline') || '');
  const features = {};
  for (const f of FEATURES) features[f.key] = false;
  form.querySelectorAll('[name=feature]:checked').forEach(el => { features[el.value] = true; });

  const payload = {
    name,
    slug,
    event_type: eventType,
    status: 'draft',
    owner: state.user.id,
    predictions_deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
    scoring: { groupExact: 3, groupSign: 2 },
    features
  };

  const { error } = await supabase.from('porras').insert(payload);
  if (error) {
    errorEl.textContent = error.message.includes('duplicate')
      ? 'Ese identificador (slug) ya existe, elige otro.'
      : `No se pudo crear: ${error.message}`;
    btn.disabled = false;
    return;
  }
  await loadPorras();
  render();
}

document.addEventListener('submit', e => {
  if (e.target.id === 'loginForm') { e.preventDefault(); handleLogin(e.target); }
  if (e.target.id === 'createForm') { e.preventDefault(); handleCreate(e.target); }
});

document.addEventListener('click', e => {
  if (e.target.id === 'logoutBtn') supabase.auth.signOut().then(refreshAuth);
});

supabase.auth.onAuthStateChange(() => { refreshAuth(); });
refreshAuth();
