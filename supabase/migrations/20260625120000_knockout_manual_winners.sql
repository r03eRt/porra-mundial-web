-- Ganadores manuales del cuadro real de cruces (app legacy del Mundial 2026).
-- Antes vivían solo en localStorage (state.knockoutManualWinners), por lo que cada
-- navegador veía un cuadro distinto. Esta tabla los persiste y los comparte entre
-- todos los dispositivos/usuarios. El cuadro real sigue siendo DERIVADO: se combina
-- esta corrección manual con los resultados de la API (worldcup_results_cache).
--
-- match_num: el `num` del fixture de openfootball que identifica cada cruce.
-- winner_team: nombre/clave de equipo que pasa de ronda (override de winnerFromApiMatch).

create table if not exists public.knockout_manual_winners (
  match_num text not null,
  winner_team text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (match_num)
);

alter table public.knockout_manual_winners enable row level security;

revoke all on table public.knockout_manual_winners from anon, authenticated;
grant select on table public.knockout_manual_winners to anon, authenticated;
grant insert, update, delete on table public.knockout_manual_winners to authenticated;

-- Lectura pública: todos ven el cuadro real corregido por el admin.
drop policy if exists "Knockout manual winners are public" on public.knockout_manual_winners;
create policy "Knockout manual winners are public"
  on public.knockout_manual_winners
  for select
  to anon, authenticated
  using (true);

-- Escritura para cuentas autenticadas (mismo patrón que prediction_overrides).
drop policy if exists "Authenticated can insert knockout manual winners" on public.knockout_manual_winners;
create policy "Authenticated can insert knockout manual winners"
  on public.knockout_manual_winners
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated can update knockout manual winners" on public.knockout_manual_winners;
create policy "Authenticated can update knockout manual winners"
  on public.knockout_manual_winners
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete knockout manual winners" on public.knockout_manual_winners;
create policy "Authenticated can delete knockout manual winners"
  on public.knockout_manual_winners
  for delete
  to authenticated
  using (true);
