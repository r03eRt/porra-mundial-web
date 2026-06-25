const fs = require('fs');
const path = require('path');
const payload = JSON.parse(fs.readFileSync(path.join(__dirname, 'wc2026-payload.json'), 'utf8'));

// Escapar para literal SQL: comilla simple -> doble comilla simple
const json = JSON.stringify(payload).replace(/'/g, "''");
const url = payload.sourceUrl.replace(/'/g, "''");

const sql = `-- Seed inicial del caché de resultados (snapshot de Wikipedia ES, Mundial 2026).
-- Generado por scraping-wikipedia/build-payload.js + gen-seed.js a partir del HTML
-- de Wikipedia. Reaplicar tras un re-scrape: este upsert sobrescribe el payload del
-- evento. Requiere antes la migración 20260625160000_event_results_cache.sql.

insert into public.event_results_cache (event, payload, source, source_url, updated_at)
values (
  'worldcup-2026',
  '${json}'::jsonb,
  'wikipedia-es',
  '${url}',
  now()
)
on conflict (event) do update set
  payload = excluded.payload,
  source = excluded.source,
  source_url = excluded.source_url,
  updated_at = now();
`;

const out = path.join(__dirname, '..', 'supabase', 'seed-event-results-cache-worldcup-2026.sql');
fs.writeFileSync(out, sql);
console.log('Seed SQL escrito a supabase/' + path.basename(out));
console.log('Tamaño:', (sql.length / 1024).toFixed(1), 'KB');
