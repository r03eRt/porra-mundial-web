create table if not exists public.mini_results (
  question_id text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.as_rankings_cache (
  kind text primary key,
  payload jsonb not null,
  source text not null default 'as.com',
  updated_at timestamptz not null default now()
);

create table if not exists public.worldcup_results_cache (
  kind text primary key,
  payload jsonb not null,
  source text not null default 'openfootball',
  updated_at timestamptz not null default now()
);

create table if not exists public.as_live_match_cache (
  kind text primary key,
  payload jsonb not null,
  source text not null default 'as.com',
  updated_at timestamptz not null default now()
);

create table if not exists public.prediction_overrides (
  player_id text not null,
  scope text not null,
  entity_id text not null,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (player_id, scope, entity_id)
);

alter table public.mini_results enable row level security;
alter table public.as_rankings_cache enable row level security;
alter table public.worldcup_results_cache enable row level security;
alter table public.as_live_match_cache enable row level security;
alter table public.prediction_overrides enable row level security;

revoke all on table public.mini_results from anon, authenticated;
grant select on table public.mini_results to anon, authenticated;
grant insert, update, delete on table public.mini_results to authenticated;

revoke all on table public.as_rankings_cache from anon, authenticated;
grant select on table public.as_rankings_cache to anon, authenticated;

revoke all on table public.worldcup_results_cache from anon, authenticated;
grant select on table public.worldcup_results_cache to anon, authenticated;

revoke all on table public.as_live_match_cache from anon, authenticated;
grant select on table public.as_live_match_cache to anon, authenticated;

revoke all on table public.prediction_overrides from anon, authenticated;
grant select on table public.prediction_overrides to anon, authenticated;
grant insert, update, delete on table public.prediction_overrides to authenticated;

drop policy if exists "Mini results are public" on public.mini_results;
create policy "Mini results are public"
  on public.mini_results
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated admins can insert mini results" on public.mini_results;
create policy "Authenticated admins can insert mini results"
  on public.mini_results
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated admins can update mini results" on public.mini_results;
create policy "Authenticated admins can update mini results"
  on public.mini_results
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated admins can delete mini results" on public.mini_results;
create policy "Authenticated admins can delete mini results"
  on public.mini_results
  for delete
  to authenticated
  using (true);

drop policy if exists "AS rankings cache is public" on public.as_rankings_cache;
create policy "AS rankings cache is public"
  on public.as_rankings_cache
  for select
  to anon, authenticated
  using (true);

drop policy if exists "World Cup results cache is public" on public.worldcup_results_cache;
create policy "World Cup results cache is public"
  on public.worldcup_results_cache
  for select
  to anon, authenticated
  using (true);

drop policy if exists "AS live match cache is public" on public.as_live_match_cache;
create policy "AS live match cache is public"
  on public.as_live_match_cache
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Prediction overrides are public" on public.prediction_overrides;
create policy "Prediction overrides are public"
  on public.prediction_overrides
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated admins can insert prediction overrides" on public.prediction_overrides;
create policy "Authenticated admins can insert prediction overrides"
  on public.prediction_overrides
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated admins can update prediction overrides" on public.prediction_overrides;
create policy "Authenticated admins can update prediction overrides"
  on public.prediction_overrides
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated admins can delete prediction overrides" on public.prediction_overrides;
create policy "Authenticated admins can delete prediction overrides"
  on public.prediction_overrides
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- Edición de la porra por el propio jugador (PIN + fecha límite).
-- Ejecuta también, en este orden, los scripts adicionales:
--   1. supabase/player-self-edit.sql  -> tablas player_access / app_config + RPCs
--   2. supabase/set-edit-deadline.sql -> fija la fecha límite de edición
--   3. (privado, no versionado) carga los PINs de cada jugador en player_access:
--        insert into public.player_access (player_id, pin) values ('roberto','XXXX')
--        on conflict (player_id) do update set pin = excluded.pin, updated_at = now();
-- Son aditivos: no modifican nada de lo anterior.
-- ============================================================================
