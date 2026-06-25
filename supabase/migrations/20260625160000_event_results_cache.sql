-- Caché de resultados de eventos para la plataforma multi-porra (app nueva).
--
-- Equivale al worldcup_results_cache de la legacy, pero GENÉRICO por evento/fuente:
-- una fila por evento (Mundial 2026, futura Eurocopa, etc.) identificada por `event`.
-- Guarda el JSON CRUDO ya estructurado scrapeado de la fuente (hoy: Wikipedia ES).
--
-- El payload (jsonb) contiene todas las secciones que necesita la app nueva:
--   {
--     source, sourceUrl, event,
--     meta:       { totalMatches, playedMatches, totalGoals, groups },
--     teams:      [ { code, name } ],                        -- catálogo con código FIFA
--     matches:    [ { num, stage, group, round, team1, team2, code1, code2,
--                     played, score_home, score_away, date, time, stadium, city,
--                     report, goals: { home:[…], away:[…] } } ],
--     topScorers: [ { name, team_code, team, goals, penalties } ],   -- ranking agregado
--     standings:  { A: [ { code, name, pj, pg, pe, pp, gf, gc, dg, pts } ], … },
--     knockout:   [ { round, matches: [ { num, team1, team2, code1, code2, … } ] } ]
--   }
-- Cada gol: { name, minutes:[…], penalty, owngoal }.
--
-- FLUJO PREVISTO (no incluido en esta migración):
--   1. Edge Function `sync-wikipedia-results` (cron) escribe/actualiza esta tabla.
--   2. Un proceso de sync mapea el payload a `porra_matches` de la porra elegida.
--      REGLA DE FALLBACK: el resultado MANUAL del admin gana siempre — el sync solo
--      rellena partidos cuyo result_home/result_away esté vacío (NULL). Nunca pisa
--      un resultado que el admin haya introducido a mano.
--
-- Esta migración SOLO crea la tabla + RLS. El seed inicial (snapshot de Wikipedia)
-- se aplica aparte con supabase/seed-event-results-cache-worldcup-2026.sql.

create table if not exists public.event_results_cache (
  event text not null,                  -- p.ej. 'worldcup-2026'
  payload jsonb not null,
  source text not null default 'wikipedia-es',
  source_url text,
  updated_at timestamptz not null default now(),
  primary key (event)
);

alter table public.event_results_cache enable row level security;

revoke all on table public.event_results_cache from anon, authenticated;
grant select on table public.event_results_cache to anon, authenticated;
-- Escritura solo autenticada (Edge Function usa service_role, que ignora RLS).
grant insert, update, delete on table public.event_results_cache to authenticated;

-- Lectura pública: la app nueva (pública y admin) lee el caché sin sesión.
drop policy if exists "Event results cache is public" on public.event_results_cache;
create policy "Event results cache is public"
  on public.event_results_cache
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated can insert event results cache" on public.event_results_cache;
create policy "Authenticated can insert event results cache"
  on public.event_results_cache
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated can update event results cache" on public.event_results_cache;
create policy "Authenticated can update event results cache"
  on public.event_results_cache
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete event results cache" on public.event_results_cache;
create policy "Authenticated can delete event results cache"
  on public.event_results_cache
  for delete
  to authenticated
  using (true);
