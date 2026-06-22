// Crea una cuenta de Supabase Auth (email + contraseña) por jugador.
//
// - NO toca usuarios existentes (incluido tu admin): si el email ya existe, lo salta.
// - Emails ficticios: <player_id>@porrazo.local, confirmados (email_confirm: true).
// - Guarda email + contraseña + user id en supabase/player-auth-credentials.txt
//   (ese archivo está en .gitignore; contiene secretos, no lo subas).
//
// Uso:
//   export SUPABASE_URL="https://tsbjhbpdvewqysgmrhci.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="<tu service_role key (secreta, del panel API)>"
//   node supabase/create-player-users.mjs
//
// La service_role key NO debe ir en el frontend ni subirse al repo. Es solo para
// este script local de administración.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_DOMAIN = process.env.PLAYER_EMAIL_DOMAIN || 'porrazo.local';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Faltan variables de entorno SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Defínelas antes de ejecutar (ver cabecera del script).');
  process.exit(1);
}

// Carga la lista de jugadores desde data/porra-data.js (misma fuente que la app).
const dataSrc = readFileSync(new URL('../data/porra-data.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
new Function('window', dataSrc)(sandbox.window);
const players = sandbox.window.PORRA_DATA.players.map(p => ({ id: p.id, name: p.name }));

// Contraseña aleatoria legible (12 chars hex) por jugador.
function makePassword() {
  return randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).padEnd(12, '0');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const results = [];

for (const player of players) {
  const email = `${player.id}@${EMAIL_DOMAIN}`;
  const password = makePassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { player_id: player.id, name: player.name, role: 'player' }
  });

  if (error) {
    // 422 / "already been registered" -> ya existe: lo respetamos y saltamos.
    const msg = String(error.message || '');
    if (/already.*registered|already exists|duplicate/i.test(msg)) {
      console.log(`= ${player.name.padEnd(12)} (${email}) ya existe, se salta.`);
      results.push({ id: player.id, name: player.name, email, password: '(ya existía, sin cambios)', status: 'skipped' });
    } else {
      console.error(`✗ ${player.name.padEnd(12)} (${email}) ERROR: ${msg}`);
      results.push({ id: player.id, name: player.name, email, password: '', status: 'error: ' + msg });
    }
    continue;
  }

  console.log(`✓ ${player.name.padEnd(12)} (${email}) creado.`);
  results.push({ id: player.id, name: player.name, email, password, userId: data.user?.id || '', status: 'created' });
}

// Guarda credenciales en un archivo local (gitignored).
const outPath = new URL('../supabase/player-auth-credentials.txt', import.meta.url);
const lines = [
  `# Credenciales de Supabase Auth de los jugadores — ${new Date().toISOString()}`,
  `# Proyecto: ${SUPABASE_URL}`,
  `# MANTENER PRIVADO. No subir al repo.`,
  '',
  ...results.map(r => `${r.name}\t${r.email}\t${r.password}\t[${r.status}]`)
];
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

const created = results.filter(r => r.status === 'created').length;
const skipped = results.filter(r => r.status === 'skipped').length;
const errored = results.filter(r => r.status.startsWith('error')).length;
console.log(`\nResumen: ${created} creados, ${skipped} ya existían, ${errored} errores.`);
console.log(`Credenciales guardadas en: supabase/player-auth-credentials.txt`);
