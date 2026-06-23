# Porrazo 2026 — instrucciones para Claude Code

## Qué es este proyecto

App web de porra deportiva (Mundial 2026) + plataforma para crear porras de futuros eventos.
Dos apps en el mismo repo, compartiendo el mismo proyecto Supabase.

## Reglas de trabajo

- No hagas commit, git push ni `supabase db push` hasta que el usuario lo pida explícitamente. Cuando se confirme commit, hazlo a **`main`** directamente, sin ramas de feature.
- Cuando cambie el estado, flujo o convenciones del proyecto, actualiza también `AGENTS.md` y `CLAUDE.md`.
- Cuando hagas cambios funcionales, actualiza también `README.md` y el doc relevante de `docs/`.
- Prepara y verifica queries SQL y deploys cuando haga falta, pero ejecútalos solo con confirmación explícita del usuario.
- No toques nada de la app legacy (`src/app.js`, `index.html`, tablas sin prefijo `porra_`) salvo que se pida explícitamente.

## Estructura del repo

```
/                      → App legacy del Mundial 2026 (Vite, JS vanilla)
  src/app.js           → Lógica principal (4 000+ líneas)
  index.html           → Entrada de la app legacy
  data/porra-data.js   → window.PORRA_DATA estático (22 jugadores, 72 partidos)
  supabase/            → SQL, migrations, Edge Functions, scripts de utilidad
  docs/                → Documentación técnica detallada
  admin-next/          → Dashboard nuevo (Vite + supabase-js, JS vanilla)
    src/main.js        → Toda la lógica del dashboard (sin framework)
    src/styles.css     → Tema oscuro
```

## Supabase

- **Project ref**: `tsbjhbpdvewqysgmrhci`
- **URL**: `https://tsbjhbpdvewqysgmrhci.supabase.co`
- **Publishable key** (pública, segura en frontend): `sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw`
- La `service_role` key es secreta; no va al repo ni al frontend nunca.
- Aplicar migrations: `npx supabase db push` (CLI tiene credenciales cacheadas), solo cuando el usuario lo pida explícitamente.

## Auth y roles

- **Admin legacy**: cuenta Supabase Auth sin `player_id` en `user_metadata`. Email: `morgadoluengo@gmail.com`.
- **Jugadores legacy**: cuentas con `player_id` en `user_metadata`. Email patrón: `<id>@porrazo.local`.
- `isAdmin()` = autenticado sin `player_id`; `isPlayerSession()` = autenticado con `player_id`.
- RPCs seguras: `set_my_override` / `clear_my_override` toman `player_id` del JWT, nunca de parámetro.
- **Admin plataforma**: tabla `platform_admins`. Función: `pp_is_admin()`. Solo `morgadoluengo@gmail.com`.

## Tablas (legacy)

`mini_results`, `as_rankings_cache`, `worldcup_results_cache`, `as_live_match_cache`,
`prediction_overrides`, `app_config`, `player_access`

## Tablas (plataforma multi-porra, prefijo `porra_`)

`porras`, `porra_teams`, `porra_groups`, `porra_matches`, `porra_players`,
`porra_predictions`, `porra_mini_questions`, `porra_mini_answers`,
`porra_mini_results`, `porra_knockout_picks`, `platform_admins`

## Plataforma multi-porra — estado actual

| Fase | Estado | Qué hay |
|------|--------|---------|
| 0 | ✅ | Esquema DB aplicado (`supabase/platform-schema.sql`) |
| 1 | 🚧 | `admin-next/`: login admin, crear/listar porras, gestionar jugadores/grupos/equipos con bandera ligada, ordenados por grupo y editables/partidos/mini-porra, generar y resetear fase de grupos por jornadas, ordenar partidos con subir/bajar y arrastre en fase de grupos, y cambiar estado |
| 2+ | ⬜ | Predicciones de jugadores, clasificación pública, mini, cruces, resultados |

### admin-next — cómo arrancarlo

```bash
cd admin-next && npm run dev   # → http://localhost:5174 (5173 ya lo usa la app legacy)
```

Login con `morgadoluengo@gmail.com`. El formulario de crear porra y el listado aparecen directamente.
Haz clic en **→ Gestionar** en una porra para entrar a añadir jugadores, partidos y mini-porra. Al invitar jugadores se pide nombre visible y email; si la cuenta Auth todavía no existe, el panel la crea y la enlaza automáticamente. Los equipos y grupos iniciales se crean desde el asistente guiado de fase de grupos, que obliga a definir cuántos grupos hay, cuántos equipos va a tener cada uno, elegir cada equipo desde un selector con bandera y, al final, crear también los partidos de fase de grupos con fecha opcional. Los equipos repetidos quedan bloqueados en toda la porra. El asistente, la sección de jugadores, la sección de partidos y la mini-porra se mantienen visibles, plegables y editables tras guardar, y al re-guardar actualizan la estructura/regeneran los partidos de grupo. Si se resetea la fase de grupos, el asistente reaparece con la estructura guardada para regenerar exactamente los mismos partidos. Si la porra está en borrador, también se puede borrar desde la lista o desde el detalle. La mini-porra se gestiona como listado editable de preguntas con puntos, tipo de campo y opciones.

### admin-next — flujo de estado (main.js)

```
state.currentPorra === null  →  renderPorraList()   (crear + listar)
state.currentPorra !== null  →  renderDetail()      (grupos + equipos + partidos)
```

Toda la UI se regenera con `render()`. No hay framework; es JS vanilla con event delegation en `document`.

## Archivos sensibles (gitignoreados)

- `supabase/seed-player-pins.sql` — PINs en claro
- `supabase/backup/` — dumps de BD con datos de usuarios
- `supabase/player-auth-credentials.txt` — credenciales de los 22 jugadores
- `admin-next/node_modules/`, `admin-next/dist/`

## Edge Functions activas

`sync-worldcup-results`, `sync-as-rankings`, `sync-as-live-match`, `sync-football-live`
(todas con `verify_jwt = false` para que las llame `pg_cron`)

## Deadline de edición de jugadores

Tabla `app_config`, clave `player_edit_deadline`. Valor actual: `2026-07-19T23:59:00Z`.
Para cambiarla: ejecutar `supabase/set-edit-deadline.sql` o actualizar directo en SQL Editor.

## Backup

```bash
bash supabase/backup.sh   # → supabase/backup/<timestamp>/
```
