-- ============================================================================
-- Fase 2 — Escritura del jugador sobre sus propias predicciones
-- ----------------------------------------------------------------------------
-- Hasta ahora las tablas porra_* eran "lectura pública, escritura solo del
-- dueño (admin)". El jugador necesita escribir SUS PROPIAS filas en:
--   porra_predictions, porra_mini_answers, porra_knockout_picks
-- vinculadas a su player_id a través de porra_players.user_id = auth.uid(),
-- y solo mientras la porra esté abierta y antes del deadline.
--
-- Ejecutar con: npx supabase db push  (o pegar en el SQL Editor).
-- No toca las políticas del dueño existentes; añade políticas de jugador.
-- ============================================================================

-- ¿auth.uid() es el jugador con este player_id en esta porra?
create or replace function public.pp_is_player(p_porra_id uuid, p_player_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.porra_players
    where porra_id = p_porra_id
      and player_id = p_player_id
      and user_id = auth.uid()
  );
$$;

-- ¿La porra admite ediciones de predicciones ahora mismo?
-- Abierta (status = 'open') y sin deadline pasado (deadline nulo = sin límite).
create or replace function public.pp_predictions_open(p_porra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.porras
    where id = p_porra_id
      and status = 'open'
      and (predictions_deadline is null or now() < predictions_deadline)
  );
$$;

grant execute on function public.pp_is_player(uuid, text) to authenticated;
grant execute on function public.pp_predictions_open(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Políticas de jugador (insert/update/delete de sus propias filas)
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  player_tables text[] := array[
    'porra_predictions', 'porra_mini_answers', 'porra_knockout_picks'
  ];
begin
  foreach t in array player_tables loop
    execute format('drop policy if exists "%s player write" on public.%I;', t, t);
    execute format($p$
      create policy "%s player write" on public.%I
      for all to authenticated
      using (
        public.pp_is_player(porra_id, player_id)
        and public.pp_predictions_open(porra_id)
      )
      with check (
        public.pp_is_player(porra_id, player_id)
        and public.pp_predictions_open(porra_id)
      );
    $p$, t, t);
  end loop;
end$$;
