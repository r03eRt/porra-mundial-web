create table if not exists public.mini_results (
  question_id text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.mini_results enable row level security;

revoke all on table public.mini_results from anon, authenticated;
grant select on table public.mini_results to anon, authenticated;
grant insert, update, delete on table public.mini_results to authenticated;

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
