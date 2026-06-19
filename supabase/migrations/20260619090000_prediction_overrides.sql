create table if not exists public.prediction_overrides (
  player_id text not null,
  scope text not null,
  entity_id text not null,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (player_id, scope, entity_id)
);

alter table public.prediction_overrides enable row level security;

revoke all on table public.prediction_overrides from anon, authenticated;
grant select on table public.prediction_overrides to anon, authenticated;
grant insert, update, delete on table public.prediction_overrides to authenticated;

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
