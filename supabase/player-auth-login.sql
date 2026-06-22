-- ============================================================================
-- Login de jugador con Supabase Auth (email + contraseña), sin PIN.
-- ----------------------------------------------------------------------------
-- ADITIVO: añade RPCs nuevas. Las antiguas (set_player_override por PIN) se
-- pueden dejar o eliminar; aquí solo añadimos las basadas en el usuario
-- autenticado.
--
-- Idea: el jugador inicia sesión con su cuenta de Supabase Auth. Su player_id
-- viaja dentro del JWT en user_metadata.player_id. Estas funciones lo leen del
-- token (auth.jwt()), NUNCA de un parámetro, así un jugador solo puede editar
-- SU propia porra. El admin no tiene player_id y no usa estas funciones.
-- ============================================================================

-- Helper: player_id del usuario autenticado (de user_metadata), o null.
create or replace function public.current_player_id()
returns text
language sql
stable
as $$
  select nullif(
    coalesce(
      auth.jwt() -> 'user_metadata' ->> 'player_id',
      ''
    ),
    ''
  );
$$;

grant execute on function public.current_player_id() to anon, authenticated;

-- Guardar una corrección del propio jugador autenticado.
create or replace function public.set_my_override(
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
  v_player_id text := public.current_player_id();
begin
  if v_player_id is null then
    raise exception 'No hay jugador autenticado.';
  end if;

  if p_scope not in ('group_match', 'knockout', 'mini') then
    raise exception 'scope no permitido';
  end if;

  if not public.player_edit_open() then
    raise exception 'La edición está cerrada (fecha límite alcanzada).';
  end if;

  insert into public.prediction_overrides (player_id, scope, entity_id, value, updated_at)
  values (v_player_id, p_scope, p_entity_id, p_value, now())
  on conflict (player_id, scope, entity_id)
  do update set value = excluded.value, updated_at = now();
end;
$$;

grant execute on function public.set_my_override(text, text, jsonb) to authenticated;

-- Quitar una corrección del propio jugador autenticado.
create or replace function public.clear_my_override(
  p_scope text,
  p_entity_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id text := public.current_player_id();
begin
  if v_player_id is null then
    raise exception 'No hay jugador autenticado.';
  end if;

  if not public.player_edit_open() then
    raise exception 'La edición está cerrada (fecha límite alcanzada).';
  end if;

  delete from public.prediction_overrides
  where player_id = v_player_id and scope = p_scope and entity_id = p_entity_id;
end;
$$;

grant execute on function public.clear_my_override(text, text) to authenticated;
