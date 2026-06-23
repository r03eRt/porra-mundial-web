begin;

create or replace function public.pp_add_player_by_email(
  p_porra_id uuid,
  p_email text,
  p_display_name text default null
)
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
    nullif(p_display_name, ''),
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

grant execute on function public.pp_add_player_by_email(uuid, text, text) to authenticated;

commit;
