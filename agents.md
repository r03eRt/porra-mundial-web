# agents.md — Handoff para agentes de código (Codex, Claude, etc.)

> Este documento es la fuente de verdad para cualquier agente que continúe el trabajo en este repo.
> Léelo antes de tocar cualquier archivo. Está sincronizado con `CLAUDE.md`.

## Contexto del proyecto

**Porrazo 2026** — porra del Mundial de Fútbol 2026 para un grupo privado (22 jugadores).
El repo tiene DOS apps en paralelo:

1. **App legacy** (`/`): la porra ya montada del Mundial 2026. **No se toca** salvo bug crítico.
2. **Dashboard nuevo** (`admin-next/`): plataforma para crear porras de futuros eventos. Aquí está el trabajo activo.

## Stack

- **Frontend**: Vite 8 + JavaScript vanilla (sin framework). No TypeScript.
- **Backend**: Supabase (Auth, RLS, Edge Functions con Deno, pg_cron, migraciones CLI).
- **Deploy legacy**: GitHub Pages automático desde `main`.
- **Dashboard**: corre local en dev; deploy pendiente.

## Supabase

| Variable | Valor |
|----------|-------|
| Project ref | `tsbjhbpdvewqysgmrhci` |
| URL | `https://tsbjhbpdvewqysgmrhci.supabase.co` |
| Publishable key (pública) | `sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw` |
| service_role key | **secreta** — nunca al repo ni al frontend |

Aplicar SQL: `npx supabase db push` (CLI ya está linkeado), solo cuando el usuario lo pida explícitamente.

## Roles y Auth

### Legacy app
- **Admin**: autenticado, `user_metadata.player_id` ausente. Email: `morgadoluengo@gmail.com`.
- **Jugadores** (22): autenticados, `user_metadata.player_id` presente. Email: `<id>@porrazo.local`.
- `isAdmin()` y `isPlayerSession()` en `src/app.js` leen eso del JWT.
- Escrituras seguras vía RPC SECURITY DEFINER: `set_my_override(scope, entity_id, value)` y `clear_my_override(scope, entity_id)` — el `player_id` lo sacan del JWT, nunca de parámetro.

### Plataforma multi-porra
- Tabla `platform_admins` con `morgadoluengo@gmail.com`.
- Función `pp_is_admin()` (SECURITY DEFINER) — devuelve bool.
- Función `pp_owns(porra_id uuid)` — devuelve bool si el usuario autenticado es owner de esa porra.

## Estado actual de la Fase 1 (trabajo activo)

El dashboard en `admin-next/` tiene:
- ✅ Login con Supabase Auth + comprobación `pp_is_admin()`
- ✅ Crear porra (nombre, slug auto, tipo de evento, deadline, features)
- ✅ Listar porras del admin
- ✅ Borrar porras en estado borrador desde la lista o el detalle
- ✅ Vista de detalle por porra: asistente de fase de grupos, partidos y mini-porra
- ✅ Vista de detalle por porra: asistente de fase de grupos, jugadores, partidos y mini-porra plegables
- ✅ Gestión de jugadores: añadir por nombre y email, listar y eliminar; si el email no existe en Auth, el panel crea la cuenta y la enlaza
- ✅ Equipos con bandera ligada desde catálogo, con opción de equipo personalizado
- ✅ Tabla de equipos ordenada por grupo, con edición inline y arrastre dentro del mismo grupo
- ✅ Bloqueo de equipos duplicados en toda la porra, incluido el asistente guiado
- ✅ Generación automática de partidos de fase de grupos por jornadas desde grupos + equipos
- ✅ Asistente guiado para crear grupos y equipos por pasos, con selector de equipos con bandera, que se queda visible, plegable y editable tras guardar
- ✅ Si se resetea la fase de grupos, el asistente reaparece para regenerar los mismos partidos a partir de la estructura guardada
- ✅ Reset de fase de grupos para regenerar esa estructura si algo sale mal
- ✅ Organización manual de partidos con botones subir/bajar usando `porra_matches.position`
- ✅ Edición inline de la fecha de cada partido desde la sección de partidos
- ✅ Reordenación por arrastre de las filas de fase de grupos
- ✅ Estructura de partidos: jornadas, orden manual y fechas
- ✅ Sección de partidos plegable desde la cabecera, igual que el asistente de grupos
- ✅ Mini-porra editable desde el detalle de la porra: preguntas, puntos, tipo y opciones
- ✅ Ciclo de estado de porra: `draft → open → playing → closed`

**Pendiente en Fase 1:**
- Ajustes finales de usabilidad del dashboard según pruebas reales

**Fase 2 (no empezada):**
- Vista pública `/p/<slug>` con todas las pestañas
- Predicciones de jugadores + clasificación automática
- Mini-porra configurable, cruces configurables

## Archivos clave

### Dashboard (admin-next/)

| Archivo | Qué hace |
|---------|----------|
| `admin-next/src/main.js` | Toda la lógica: auth, renders, handlers, event delegation, catálogo de equipos, generación y ordenación de partidos |
| `admin-next/src/styles.css` | Tema oscuro, tablas, formularios inline |
| `admin-next/index.html` | Esqueleto: `<header class="topbar">`, `<main id="app">`, `<div id="session">` |
| `admin-next/vite.config.js` | `base: './'` |

### App legacy (src/)

| Archivo | Qué hace |
|---------|----------|
| `src/app.js` | 4 000+ líneas. Auth, UI, cálculos, API calls, overrides |
| `data/porra-data.js` | `window.PORRA_DATA` — 22 jugadores, 72 partidos, predicciones |
| `index.html` | Entrada legacy |

### Supabase

| Archivo | Qué hace |
|---------|----------|
| `supabase/platform-schema.sql` | Esquema completo de tablas `porra_*` (Fase 0, ya aplicado) |
| `supabase/migrations/20260623000000_platform_schema.sql` | Migración aplicada |
| `supabase/player-auth-login.sql` | RPCs `set_my_override` / `clear_my_override` |
| `supabase/create-player-users.mjs` | Crea 22 cuentas Auth para jugadores |
| `supabase/backup.sh` | Backup completo (DB + código) |
| `supabase/set-edit-deadline.sql` | Actualiza `player_edit_deadline` |

## Convenciones de admin-next/src/main.js

```js
// Estado global (objeto plano, sin reactividad)
const state = { user, isAdmin, loading, porras, currentPorra, teams, groups, matches, ... }

// Render único — regenera todo el DOM de #app
function render() { ... }

// Vista activa según state.currentPorra
state.currentPorra === null  →  renderPorraList()   // lista + crear
state.currentPorra !== null  →  renderDetail()      // grupos + equipos + partidos

// Event delegation global
document.addEventListener('submit', e => { /* por id de form */ })
document.addEventListener('click', e => { /* por id o clase */ })

// Escapado HTML obligatorio para todo output dinámico
function esc(value) { ... }   // XSS safe
```

## Tablas de la plataforma (todas con porra_id)

```
porras              → nombre, slug, event_type, status, owner (uuid), predictions_deadline,
                      scoring (jsonb), features (jsonb)
porra_teams         → porra_id, name, flag, group_id, position
porra_groups        → porra_id, name, position
porra_matches       → porra_id, team1_id, team2_id, phase, group_label, kickoff, status,
                      score_home, score_away, slot (jornada), position (orden)
porra_players       → porra_id, user_id, display_name, joined_at
porra_predictions   → porra_id, player_id, match_id, score_home, score_away
porra_mini_questions → porra_id, text, points, field_type, options (jsonb)
porra_mini_answers  → porra_id, player_id, question_id, value
porra_mini_results  → porra_id, question_id, value
porra_knockout_picks → porra_id, player_id, round, team_id
platform_admins     → email
```

## RLS en tablas de la plataforma

- Lectura: pública en todas.
- Insertar en `porras`: solo `pp_is_admin()`.
- Modificar/borrar en `porras` y subtablas: solo `pp_owns(porra_id)`.
- Insertar en `platform_admins`: bloqueado (solo desde service_role).

## Reglas de trabajo para el agente

1. **No hacer commit, git push ni `supabase db push` hasta que el usuario lo pida explícitamente.** Cuando se confirme commit, hacerlo a `main` directamente, sin ramas de feature.
2. **No modificar la app legacy** (`src/`, `index.html`, tablas sin prefijo `porra_`) salvo bug explícito.
3. Al añadir features en `admin-next/`, seguir el patrón existente: estado en `state`, render con `render()`, delegation en `document`.
4. Escapar siempre con `esc()` antes de insertar en innerHTML.
5. Actualizar `AGENTS.md` y `CLAUDE.md` cuando cambie el estado, flujo o convenciones del proyecto.
6. Actualizar `README.md` y el doc de `docs/` cuando cambie algo funcional.
7. Preparar y verificar queries/deploys cuando haga falta, pero ejecutarlos solo con confirmación explícita del usuario.

## Cómo arrancar en local

```bash
# App legacy
npm run dev          # → http://localhost:5173

# Dashboard admin
cd admin-next
npm install
npm run dev          # → http://localhost:5174 (5173 ya ocupado)
```

## Próximos pasos concretos (Fase 1, en orden)

1. **Pulir Fase 1 con pruebas reales**:
   - Revisar ergonomía de creación de porra completa.
   - Ajustar edición de fechas si hace falta más granularidad por partido o por jornada.
   - Decidir en qué pantalla irá la carga de resultados reales del torneo.

2. **Vista pública** (`/p/<slug>`) — Fase 2, app separada en `supabase-next/` o carpeta nueva.
