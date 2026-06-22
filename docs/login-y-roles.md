# Login y roles (Supabase Auth)

Cómo funciona el acceso a Porrazo 2026 tras migrar del login por PIN a Supabase
Auth con email y contraseña.

## Resumen

- Login único en la portada (email + contraseña), sin parámetros en la URL.
- Admin y jugadores usan el mismo formulario y el mismo Supabase Auth.
- El rol se deriva de la cuenta:
  - **Jugador**: tiene `player_id` en `user_metadata`.
  - **Admin**: no tiene `player_id`.
- Tras entrar, la app redirige según el rol: jugador → «Editar mi porra»,
  admin → «Administrar».

## Frontend (`src/app.js`)

- `authPlayerId()` lee `state.adminUser.user_metadata.player_id`.
- `isAdmin()` = hay usuario autenticado y NO tiene `player_id`.
- `isPlayerSession()` = hay usuario autenticado y SÍ tiene `player_id`.
- El formulario único vive en el contenedor `playerAccess`; al hacer submit
  llama a `supabase.auth.signInWithPassword` y, según el `player_id` de la
  cuenta, activa el panel `myPorra` o `adminDashboard`.
- No hay sesión de jugador en `localStorage`: todo cuelga de la sesión de
  Supabase Auth.

## Backend (SQL)

Las correcciones del jugador se guardan en `prediction_overrides` mediante
funciones `SECURITY DEFINER` definidas en `supabase/player-auth-login.sql`:

- `current_player_id()`: devuelve el `player_id` del token (`auth.jwt() ->
  'user_metadata' ->> 'player_id'`), o `null`.
- `set_my_override(p_scope, p_entity_id, p_value)`: valida que hay jugador
  autenticado, que el scope es válido y que la edición sigue abierta
  (`player_edit_open()`), y hace el upsert con el `player_id` del token.
- `clear_my_override(p_scope, p_entity_id)`: borra la corrección del jugador
  autenticado.

Como el `player_id` sale del token y no de un parámetro, un jugador solo puede
editar su propia porra. El admin sigue usando `set_player_override` /
`prediction_overrides` para corregir la porra de cualquier jugador.

## Fecha límite de edición

`app_config.player_edit_deadline` (jsonb con fecha ISO) marca hasta cuándo
pueden editar los jugadores. Mientras `now()` sea anterior, la edición está
abierta. El frontend deshabilita los campos pasada la fecha y las RPC la
rechazan en el servidor. Se ajusta con `supabase/set-edit-deadline.sql`.

## Cuentas de jugadores

Se crean con `supabase/create-player-users.mjs` (ver el README, sección
«Cuentas de jugadores»). Email `<id>@porrazo.local`, contraseña aleatoria,
`player_id` y `role: 'player'` en `user_metadata`.

## Registro

El registro público debe estar desactivado en Authentication. Las altas las
hace el admin (con el script anterior), de modo que el acceso queda limitado a
gente concreta.

## Historia: login por PIN (obsoleto)

Antes de Supabase Auth, los jugadores entraban con un PIN guardado en
`player_access` y validado por RPCs (`verify_player_pin`, `set_player_override`
con PIN). Ese flujo quedó sustituido por el login con email/contraseña. Los
objetos SQL del PIN (`supabase/player-self-edit.sql`) siguen en el repo por
compatibilidad, pero la app ya no los usa para el login.
