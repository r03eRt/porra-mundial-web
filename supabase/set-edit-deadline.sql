-- Fecha límite de edición de la porra por los jugadores.
-- Mientras now() < esta fecha, los jugadores pueden editar grupos, cruces y mini.
-- Ajusta la fecha a la real (inicio del Mundial 2026 o cuando quieras cerrar).
update public.app_config
set value = to_jsonb('2026-07-19T23:59:00Z'::text), updated_at = now()
where key = 'player_edit_deadline';

-- Si la fila no existe todavía, créala:
insert into public.app_config (key, value)
values ('player_edit_deadline', to_jsonb('2026-07-19T23:59:00Z'::text))
on conflict (key) do update set value = excluded.value, updated_at = now();
