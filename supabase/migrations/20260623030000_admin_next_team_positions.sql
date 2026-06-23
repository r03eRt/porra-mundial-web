-- Añade orden estable a los equipos por porra y grupo para poder reordenarlos
-- desde el dashboard admin-next sin perder el orden al recargar.

alter table public.porra_teams
  add column if not exists position int not null default 0;

with ranked as (
  select
    porra_id,
    team_id,
    row_number() over (
      partition by porra_id, coalesce(group_id, '')
      order by name, team_id
    ) as next_position
  from public.porra_teams
)
update public.porra_teams t
set position = ranked.next_position
from ranked
where ranked.porra_id = t.porra_id
  and ranked.team_id = t.team_id;
