-- ============================================================================
-- Edición de la porra por el propio jugador (PIN + deadline)
-- ----------------------------------------------------------------------------
-- ADITIVO: este script solo AÑADE objetos nuevos. No modifica ni borra nada
-- de setup.sql. La parte de admin (Supabase Auth + prediction_overrides) sigue
-- funcionando exactamente igual.
--
-- Diseño:
--  * player_access  -> guarda el PIN de cada jugador (anon NO puede leerlo).
--  * app_config     -> guarda la fecha límite global de edición (editable).
--  * set_player_override() / clear_player_override() -> funciones SECURITY
--    DEFINER que validan PIN + deadline y escriben en prediction_overrides.
--    El jugador (anon) llama a estas funciones por RPC; nunca escribe la tabla
--    directamente, así el RLS existente de prediction_overrides queda intacto.
-- ============================================================================

-- 1. PINs por jugador -------------------------------------------------------
create table if not exists public.player_access (
  player_id text primary key,
  pin text not null,
  updated_at timestamptz not null default now()
);

alter table public.player_access enable row level security;

-- anon/authenticated NO pueden leer ni escribir esta tabla directamente.
-- El PIN solo se valida dentro de las funciones SECURITY DEFINER.
revoke all on table public.player_access from anon, authenticated;
-- (sin políticas de select para anon -> los PINs no son legibles desde el cliente)

-- El admin (authenticated) sí puede gestionar PINs desde el panel si quieres.
grant select, insert, update, delete on table public.player_access to authenticated;

drop policy if exists "Admins manage player access" on public.player_access;
create policy "Admins manage player access"
  on public.player_access
  for all
  to authenticated
  using (true)
  with check (true);

-- 2. Configuración de la app (deadline editable) ----------------------------
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

revoke all on table public.app_config from anon, authenticated;
grant select on table public.app_config to anon, authenticated;
grant insert, update, delete on table public.app_config to authenticated;

drop policy if exists "App config is public" on public.app_config;
create policy "App config is public"
  on public.app_config
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage app config" on public.app_config;
create policy "Admins manage app config"
  on public.app_config
  for all
  to authenticated
  using (true)
  with check (true);

-- Fecha límite por defecto (ajústala desde el panel admin o aquí).
-- Formato ISO 8601. Mientras now() < deadline, el jugador puede editar.
insert into public.app_config (key, value)
values ('player_edit_deadline', to_jsonb('2026-06-11T00:00:00Z'::text))
on conflict (key) do nothing;

-- 3. Helper: ¿sigue abierta la edición? -------------------------------------
create or replace function public.player_edit_open()
returns boolean
language sql
stable
as $$
  select coalesce(
    now() < (
      select (value #>> '{}')::timestamptz
      from public.app_config
      where key = 'player_edit_deadline'
    ),
    true
  );
$$;

grant execute on function public.player_edit_open() to anon, authenticated;

-- 4. Guardar una corrección del propio jugador ------------------------------
-- Valida PIN + deadline y hace upsert en prediction_overrides como definer.
create or replace function public.set_player_override(
  p_player_id text,
  p_pin text,
  p_scope text,
  p_entity_id text,
  p_value jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if p_scope not in ('group_match', 'knockout', 'mini') then
    raise exception 'scope no permitido';
  end if;

  if not public.player_edit_open() then
    raise exception 'La edición está cerrada (fecha límite alcanzada).';
  end if;

  select exists(
    select 1 from public.player_access
    where player_id = p_player_id and pin = p_pin
  ) into v_ok;

  if not v_ok then
    raise exception 'PIN incorrecto.';
  end if;

  insert into public.prediction_overrides (player_id, scope, entity_id, value, updated_at)
  values (p_player_id, p_scope, p_entity_id, p_value, now())
  on conflict (player_id, scope, entity_id)
  do update set value = excluded.value, updated_at = now();
end;
$$;

grant execute on function public.set_player_override(text, text, text, text, jsonb) to anon, authenticated;

-- 5. Quitar una corrección del propio jugador -------------------------------
create or replace function public.clear_player_override(
  p_player_id text,
  p_pin text,
  p_scope text,
  p_entity_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if not public.player_edit_open() then
    raise exception 'La edición está cerrada (fecha límite alcanzada).';
  end if;

  select exists(
    select 1 from public.player_access
    where player_id = p_player_id and pin = p_pin
  ) into v_ok;

  if not v_ok then
    raise exception 'PIN incorrecto.';
  end if;

  delete from public.prediction_overrides
  where player_id = p_player_id and scope = p_scope and entity_id = p_entity_id;
end;
$$;

grant execute on function public.clear_player_override(text, text, text, text) to anon, authenticated;

-- 6. Validar PIN sin escribir (para el login del jugador) -------------------
create or replace function public.verify_player_pin(p_player_id text, p_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.player_access
    where player_id = p_player_id and pin = p_pin
  );
$$;

grant execute on function public.verify_player_pin(text, text) to anon, authenticated;

-- ============================================================================
-- Carga inicial de PINs (EJEMPLO). Sustituye por los reales o gestiónalos
-- desde un panel. Un jugador sin fila aquí simplemente no podrá entrar.
-- ----------------------------------------------------------------------------
-- insert into public.player_access (player_id, pin) values
--   ('roberto', '1234'),
--   ('morgado', '5678')
-- on conflict (player_id) do update set pin = excluded.pin, updated_at = now();
-- ============================================================================
