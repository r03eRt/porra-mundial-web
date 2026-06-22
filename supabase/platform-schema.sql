-- ============================================================================
-- Plataforma multi-porra — Fase 0: modelo de datos
-- ----------------------------------------------------------------------------
-- ADITIVO y AISLADO: crea tablas nuevas (prefijo porra_*) y NO toca ninguna
-- tabla de la porra actual del Mundial 2026. La app legacy sigue igual.
--
-- Resumen del modelo:
--   platform_admins        quién puede crear porras (allowlist explícita)
--   porras                 la porra: config, estado, dueño, slug público
--   porra_teams            equipos del evento (con grupo opcional)
--   porra_groups           grupos (A, B…)
--   porra_matches          partidos (grupo o cruce) + resultado real
--   porra_players          participantes (opcionalmente ligados a un user de Auth)
--   porra_predictions      pronóstico de cada jugador por partido
--   porra_mini_questions   preguntas de mini-porra
--   porra_mini_answers     respuesta de cada jugador a cada mini-pregunta
--   porra_mini_results     resultado oficial de cada mini-pregunta
--   porra_knockout_picks   pronóstico de cruces por jugador
--
-- Seguridad (Fase 0):
--   * Lectura pública (anon) de todo -> la vista pública no necesita login.
--   * Escritura: solo el DUEÑO (admin) de la porra. La autoedición del jugador
--     con deadline se hará en una fase posterior vía RPC SECURITY DEFINER
--     (igual que set_my_override en la app actual).
--   * Crear porras: solo usuarios en platform_admins.
-- ============================================================================

-- 0. Helpers de autorización -------------------------------------------------

-- ¿El usuario autenticado es admin de plataforma (puede crear porras)?
create or replace function public.pp_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

-- ¿El usuario autenticado es dueño de esta porra?
create or replace function public.pp_owns(p_porra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.porras where id = p_porra_id and owner = auth.uid()
  );
$$;

-- 1. Allowlist de admins -----------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from anon, authenticated;
-- Nadie lo lee directamente; se consulta vía pp_is_admin() (security definer).

grant execute on function public.pp_is_admin() to anon, authenticated;
grant execute on function public.pp_owns(uuid) to anon, authenticated;

-- 2. Porras ------------------------------------------------------------------
create table if not exists public.porras (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  event_type text not null default 'custom',          -- worldcup/euro/nations/custom
  status text not null default 'draft'
    check (status in ('draft', 'open', 'live', 'closed')),
  owner uuid not null references auth.users(id) on delete restrict,
  predictions_deadline timestamptz,
  scoring jsonb not null default '{}'::jsonb,           -- {groupExact, groupSign, knockout:{stage:points}}
  knockout_structure jsonb not null default '[]'::jsonb,-- [{key,label,teams,points}]
  features jsonb not null default '{}'::jsonb,          -- {groups,knockout,mini,bestThirds,topScorers,statistics,liveCard}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.porras enable row level security;
revoke all on table public.porras from anon, authenticated;
grant select on table public.porras to anon, authenticated;
grant insert, update, delete on table public.porras to authenticated;

-- 3. Equipos -----------------------------------------------------------------
create table if not exists public.porra_teams (
  porra_id uuid not null references public.porras(id) on delete cascade,
  team_id text not null,
  name text not null,
  flag text default '',
  group_id text,                                        -- grupo al que pertenece (opcional)
  primary key (porra_id, team_id)
);
alter table public.porra_teams enable row level security;

-- 4. Grupos ------------------------------------------------------------------
create table if not exists public.porra_groups (
  porra_id uuid not null references public.porras(id) on delete cascade,
  group_id text not null,
  name text not null,
  position int not null default 0,
  primary key (porra_id, group_id)
);
alter table public.porra_groups enable row level security;

-- 5. Partidos ----------------------------------------------------------------
create table if not exists public.porra_matches (
  porra_id uuid not null references public.porras(id) on delete cascade,
  match_id text not null,
  stage text not null default 'group'                   -- 'group' | 'knockout'
    check (stage in ('group', 'knockout')),
  group_id text,
  round_key text,                                       -- p.ej. OCTAVOS (si es cruce)
  slot int,
  team1 text,
  team2 text,
  kickoff timestamptz,
  result_home int,
  result_away int,
  scorers jsonb default '[]'::jsonb,                    -- goleadores opcionales
  position int not null default 0,
  primary key (porra_id, match_id)
);
alter table public.porra_matches enable row level security;

-- 6. Jugadores ---------------------------------------------------------------
create table if not exists public.porra_players (
  porra_id uuid not null references public.porras(id) on delete cascade,
  player_id text not null,
  name text not null,
  user_id uuid references auth.users(id) on delete set null,
  position int not null default 0,
  primary key (porra_id, player_id),
  unique (porra_id, user_id)
);
alter table public.porra_players enable row level security;

-- 7. Pronósticos de partidos -------------------------------------------------
create table if not exists public.porra_predictions (
  porra_id uuid not null,
  player_id text not null,
  match_id text not null,
  score text default '',
  sign text default '',
  updated_at timestamptz not null default now(),
  primary key (porra_id, player_id, match_id),
  foreign key (porra_id, player_id) references public.porra_players(porra_id, player_id) on delete cascade,
  foreign key (porra_id, match_id) references public.porra_matches(porra_id, match_id) on delete cascade
);
alter table public.porra_predictions enable row level security;

-- 8. Mini-porra: preguntas ---------------------------------------------------
create table if not exists public.porra_mini_questions (
  porra_id uuid not null references public.porras(id) on delete cascade,
  question_id text not null,
  position int not null default 0,
  question text not null,
  points int not null default 0,
  field_type text not null default 'text',              -- text/number/team/player/goals-range
  options jsonb default '[]'::jsonb,
  primary key (porra_id, question_id)
);
alter table public.porra_mini_questions enable row level security;

-- 9. Mini-porra: respuestas de jugadores -------------------------------------
create table if not exists public.porra_mini_answers (
  porra_id uuid not null,
  player_id text not null,
  question_id text not null,
  value text default '',
  updated_at timestamptz not null default now(),
  primary key (porra_id, player_id, question_id),
  foreign key (porra_id, player_id) references public.porra_players(porra_id, player_id) on delete cascade,
  foreign key (porra_id, question_id) references public.porra_mini_questions(porra_id, question_id) on delete cascade
);
alter table public.porra_mini_answers enable row level security;

-- 10. Mini-porra: resultados oficiales ---------------------------------------
create table if not exists public.porra_mini_results (
  porra_id uuid not null,
  question_id text not null,
  value text default '',
  updated_at timestamptz not null default now(),
  primary key (porra_id, question_id),
  foreign key (porra_id, question_id) references public.porra_mini_questions(porra_id, question_id) on delete cascade
);
alter table public.porra_mini_results enable row level security;

-- 11. Cruces: pronóstico por jugador -----------------------------------------
create table if not exists public.porra_knockout_picks (
  porra_id uuid not null,
  player_id text not null,
  stage text not null,
  slot int not null,
  team text default '',
  updated_at timestamptz not null default now(),
  primary key (porra_id, player_id, stage, slot),
  foreign key (porra_id, player_id) references public.porra_players(porra_id, player_id) on delete cascade
);
alter table public.porra_knockout_picks enable row level security;

-- ============================================================================
-- Grants + políticas RLS
-- ----------------------------------------------------------------------------
-- Patrón común para las tablas de contenido: lectura pública, escritura solo
-- del dueño de la porra.
-- ============================================================================

do $$
declare
  t text;
  content_tables text[] := array[
    'porra_teams','porra_groups','porra_matches','porra_players',
    'porra_predictions','porra_mini_questions','porra_mini_answers',
    'porra_mini_results','porra_knockout_picks'
  ];
begin
  foreach t in array content_tables loop
    execute format('revoke all on table public.%I from anon, authenticated;', t);
    execute format('grant select on table public.%I to anon, authenticated;', t);
    execute format('grant insert, update, delete on table public.%I to authenticated;', t);

    execute format('drop policy if exists "%s public read" on public.%I;', t, t);
    execute format($p$create policy "%s public read" on public.%I for select to anon, authenticated using (true);$p$, t, t);

    execute format('drop policy if exists "%s owner write" on public.%I;', t, t);
    execute format($p$create policy "%s owner write" on public.%I for all to authenticated using (public.pp_owns(porra_id)) with check (public.pp_owns(porra_id));$p$, t, t);
  end loop;
end$$;

-- Políticas específicas de porras (la tabla raíz) ----------------------------
drop policy if exists "porras public read" on public.porras;
create policy "porras public read"
  on public.porras for select to anon, authenticated using (true);

drop policy if exists "porras admin insert" on public.porras;
create policy "porras admin insert"
  on public.porras for insert to authenticated
  with check (public.pp_is_admin() and owner = auth.uid());

drop policy if exists "porras owner update" on public.porras;
create policy "porras owner update"
  on public.porras for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "porras owner delete" on public.porras;
create policy "porras owner delete"
  on public.porras for delete to authenticated
  using (owner = auth.uid());

-- Política de platform_admins: solo lectura propia (para que el cliente pueda
-- saber si es admin sin exponer la lista completa).
drop policy if exists "platform_admins self read" on public.platform_admins;
create policy "platform_admins self read"
  on public.platform_admins for select to authenticated
  using (user_id = auth.uid());
grant select on table public.platform_admins to authenticated;

-- ============================================================================
-- Alta del admin (EDITA el email si hace falta).
-- Sin esto, nadie podrá crear porras.
-- ----------------------------------------------------------------------------
insert into public.platform_admins (user_id)
select id from auth.users where email = 'morgadoluengo@gmail.com'
on conflict (user_id) do nothing;
-- ============================================================================
