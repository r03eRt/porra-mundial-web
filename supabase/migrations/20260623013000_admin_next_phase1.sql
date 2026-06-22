begin;

update public.porras
set status = 'playing'
where status = 'live';

alter table public.porras
  drop constraint if exists porras_status_check;

alter table public.porras
  add constraint porras_status_check
  check (status in ('draft', 'open', 'playing', 'closed'));

alter table public.porra_matches
  add column if not exists phase text,
  add column if not exists group_label text,
  add column if not exists team1_id text,
  add column if not exists team2_id text,
  add column if not exists status text,
  add column if not exists score_home integer,
  add column if not exists score_away integer;

update public.porra_matches
set
  phase = coalesce(
    phase,
    case
      when stage = 'group' then 'group'
      when upper(coalesce(round_key, '')) in ('R16', 'OCTAVOS') then 'r16'
      when upper(coalesce(round_key, '')) in ('QF', 'CUARTOS') then 'qf'
      when upper(coalesce(round_key, '')) in ('SF', 'SEMIFINALES') then 'sf'
      when upper(coalesce(round_key, '')) in ('FINAL') then 'final'
      else 'group'
    end
  ),
  group_label = coalesce(group_label, group_id),
  team1_id = coalesce(team1_id, team1),
  team2_id = coalesce(team2_id, team2),
  status = coalesce(
    status,
    case
      when result_home is not null and result_away is not null then 'finished'
      else 'scheduled'
    end
  ),
  score_home = coalesce(score_home, result_home),
  score_away = coalesce(score_away, result_away);

alter table public.porra_matches
  alter column phase set default 'group',
  alter column phase set not null,
  alter column status set default 'scheduled',
  alter column status set not null;

alter table public.porra_matches
  drop constraint if exists porra_matches_status_check;

alter table public.porra_matches
  add constraint porra_matches_status_check
  check (status in ('scheduled', 'finished'));

alter table public.porra_players
  add column if not exists display_name text,
  add column if not exists joined_at timestamptz default now();

update public.porra_players
set
  display_name = coalesce(display_name, nullif(name, ''), player_id),
  joined_at = coalesce(joined_at, now());

alter table public.porra_players
  alter column display_name set not null,
  alter column joined_at set default now(),
  alter column joined_at set not null;

create or replace function public.pp_add_player_by_email(p_porra_id uuid, p_email text)
returns public.porra_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
  v_player_id text;
  v_display_name text;
  v_row public.porra_players%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if not public.pp_owns(p_porra_id) then
    raise exception 'No puedes modificar esta porra.';
  end if;

  select *
  into v_user
  from auth.users
  where lower(email) = lower(trim(p_email))
    and deleted_at is null
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'No existe ningún usuario con ese email.';
  end if;

  if exists (
    select 1
    from public.porra_players
    where porra_id = p_porra_id
      and user_id = v_user.id
  ) then
    raise exception 'Ese usuario ya está añadido a esta porra.';
  end if;

  v_display_name := trim(coalesce(
    nullif(v_user.raw_user_meta_data->>'display_name', ''),
    nullif(v_user.raw_user_meta_data->>'full_name', ''),
    nullif(v_user.raw_user_meta_data->>'name', ''),
    nullif(v_user.raw_user_meta_data->>'player_name', ''),
    nullif(v_user.raw_user_meta_data->>'player_id', ''),
    split_part(v_user.email, '@', 1)
  ));

  v_player_id := trim(coalesce(
    nullif(v_user.raw_user_meta_data->>'player_id', ''),
    regexp_replace(split_part(v_user.email, '@', 1), '[^a-zA-Z0-9_-]+', '-', 'g')
  ));

  if v_player_id = '' then
    v_player_id := 'player-' || substr(replace(v_user.id::text, '-', ''), 1, 8);
  end if;

  if exists (
    select 1
    from public.porra_players
    where porra_id = p_porra_id
      and player_id = v_player_id
  ) then
    v_player_id := v_player_id || '-' || substr(replace(v_user.id::text, '-', ''), 1, 6);
  end if;

  insert into public.porra_players (
    porra_id,
    player_id,
    name,
    display_name,
    user_id
  )
  values (
    p_porra_id,
    v_player_id,
    v_display_name,
    v_display_name,
    v_user.id
  )
  returning *
  into v_row;

  return v_row;
end;
$$;

grant execute on function public.pp_add_player_by_email(uuid, text) to authenticated;

commit;
