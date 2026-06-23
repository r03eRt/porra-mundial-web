# Porrazo 2026 — instrucciones para Claude Code

## Qué es este proyecto

App web de porra deportiva (Mundial 2026) + plataforma para crear porras de futuros eventos.
Dos apps en el mismo repo, compartiendo el mismo proyecto Supabase.

## Reglas de trabajo

- No hagas commit, git push ni `supabase db push` hasta que el usuario lo pida explícitamente. Cuando se confirme commit, hazlo a **`main`** directamente, sin ramas de feature.
- **Tras cualquier cambio funcional en el código, actualiza siempre `AGENTS.md`, `CLAUDE.md`, `README.md` y el doc relevante de `docs/` en la misma sesión, antes de dar la tarea por terminada.** No esperes a que el usuario lo pida.
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
| 1 | 🚧 | `admin-next/`: login admin, crear/listar porras, gestionar jugadores/grupos/equipos con bandera ligada, ordenados por grupo y editables/partidos/mini-porra, generar y resetear fase de grupos por jornadas, ordenar partidos con subir/bajar y arrastre en fase de grupos, **introducir el resultado real de cada partido inline** (columna «Resultado» en la tabla de partidos; entrada manual = fallback de la fuente automática), y cambiar estado. La tabla de partidos agrupa por jornada plegable (solo fase de grupos; los cruces ya no salen ahí). **Sección «Cruces» con cuadro visual** (columnas Octavos→Cuartos→Semis→Final→🏆 Campeón): genera el bracket cuyo tamaño deriva del nº de grupos (top-2 → 16→8→4→2→1, etc.), la primera ronda lleva semillas (`A1`,`B2`) y las siguientes tokens de ganador (`W:<match_id>`) que se resuelven con los resultados; al guardar un resultado de cruce el ganador propaga a la ronda siguiente sin perder otras casillas a medio editar, con guardado individual o «Guardar todos los cruces». Sigue ofreciendo el generador por plantilla de evento (ahora dentro de Cruces); Eurocopa permite elegir entre reglas 8, 16 y 24 equipos según el ciclo oficial, Mundial entre 32 equipos y 2026/48 equipos, y Nations League se guarda aparte como ligas + ascensos/descensos + play-offs + Final Four de Liga A. |
| 2 | 🚧 | `public-next/`: vista pública por slug `/p/<slug>`, login de jugador (Supabase Auth), "Mi porra" para editar marcadores en `porra_predictions` con toast de guardado/borrado por fila y guardado masivo, mini-porra pública con tabla final de pronósticos + edición de respuestas del jugador cuando la porra está abierta, y cruces estilo legacy con puntuación por ronda + edición manual de los cruces propios mientras la porra esté abierta. La vista resuelve las semillas de cruces a partir de la clasificación de grupos del propio jugador para renderizar brackets de eventos tipo Eurocopa y Mundial; la primera ronda se genera automáticamente y la edición arranca en el siguiente tramo, donde el editor usa banderas y limita cada selector al seed oficial del cruce y a las opciones coherentes con la ronda anterior. **Puntuación de cruces corregida**: la «realidad» de cada ronda resuelve las semillas/tokens de ganador del cuadro del admin a **nombre** de equipo real (`teamName`/`resolveKnockoutSeed` con resultados oficiales) y los pronósticos del jugador se leen del cuadro derivado (`buildPlayerKnockoutBracket`, primera ronda incluida), así que los aciertos por ronda + Campeón ya suman. RLS de escritura del jugador **aplicada** (migración `20260623040000_player_write_predictions.sql`: funciones `pp_is_player`/`pp_predictions_open` + políticas `… player write`). **Mejores terceros** (`renderBestThirds`/`calculateBestThirds`): tabla con los terceros clasificados de cada grupo ordenados por pts/DG/GF, marcando con acento los que pasan según el `thirdPlaceQualifiers` de la plantilla del evento. **Probabilidades** (`renderProbabilities`/`runProbabilitiesSimulation`): Monte Carlo de 2000 iteraciones — simula el resto de los partidos de grupo muestreando las predicciones de los jugadores, y los cruces ponderando por los picks de cada participante; muestra probabilidad de ganar + media de puntos + puntos actuales para cada jugador (porra principal y mini-porra si existe) y probabilidad de que cada selección alcance cada ronda del cuadro. Caché invalidada por número de resultados conocidos/predicciones. **Histórico** (`renderHistory`/`buildHistoricalSnapshots`/`renderHistoryChart`): snapshots acumulativos uno por partido jugado (ordenados por `position`), selector + slider de punto de corte, gráfico SVG de evolución de posiciones con líneas por jugador en paleta de 16 colores (puerto del SVG del legacy), 4 tarjetas resumen (líder, total jugadores, partidos jugados, último resultado), tabla de clasificación con columnas #/Mov/Participante/Total/1ª fase/Exactos/Aciertos/[Cruces]/Jugados; scoring histórico via `calcRankingFromResults`/`buildKnockoutRealityFromMap`. |
| 3+ | ⬜ | Mini/cruces totalmente configurables, fuente automática de resultados por API por evento, vistas en vivo |

### public-next — cómo arrancarlo

```bash
cd public-next && npm run dev   # → http://localhost:5175
```

Abrir una porra por slug: `http://localhost:5175/p/<slug>` (o `?slug=<slug>`). El menú replica el de la app legacy (array `TABS` en `main.js`). Pestañas ya funcionales: Clasificación porra, Editar mi porra (solo con jugador logueado), Partidos, Cruces, Clasificación grupos, Equipos, Detalle jugador, Mini-porra, Mejores terceros, Probabilidades, **Estadísticas** e **Histórico**. Las demás (Máximos goleadores, Comparador) aparecen como placeholder "próximamente" (`ready: false` en `TABS`). Encima del menú se muestran tarjetas de accesos rápidos (`#summary`). Con **Entrar para jugar** (email/password de la cuenta Auth del jugador, enlazada por `porra_players.user_id`) se desbloquea **Editar mi porra**; solo guarda si la porra está `open` y antes del `predictions_deadline`, y muestra toast de confirmación/error al guardar o borrar por fila. La mini-porra muestra la tabla final de pronósticos con puntos y deja editar/borrar las respuestas propias mientras la porra siga abierta. La pestaña **Cruces** pinta el cuadro estilo legacy, calcula puntos por ronda desde `porra_matches`/`porra_knockout_picks`, genera automáticamente la primera ronda desde la clasificación de grupos del propio jugador y habilita la edición manual del resto mientras la porra esté abierta, con selector por tramo, banderas y seeds oficiales por cruce. La puntuación compara los pronósticos del jugador (del cuadro derivado `buildPlayerKnockoutBracket`, primera ronda incluida) contra la «realidad» de cada ronda (`buildKnockoutReality`), que resuelve las semillas/tokens `W:` del cuadro del admin a **nombre** de equipo real con los resultados oficiales (`teamName`/`resolveKnockoutSeed`); el campeón se compara con el ganador de la final. JS vanilla con event delegation, mismo patrón que `admin-next/`.

**Aspecto idéntico a la legacy**: `public-next/src/styles.css` reusa la paleta (acento verde `#53e0b4`) y las clases de la app del Mundial (`.hero`, `.tabs`, `.panel`, `.table-wrap`, `.rank-1/2/3`, `.points`, `.matchdays`/`.match-card`/`.match-goals`, `.group-standings-grid`, `.teams-layout`/`.team-chart-card`). **Partidos** se agrupan por jornada (`porra_matches.slot`) → grupo, con `match-card`, marcador grande y "Ver/Ocultar goleadores" (lee `porra_matches.scorers`). **Equipos** usa el layout de dos columnas (lista con buscador + detalle con tarjetas y barras de progreso) reutilizando `src/lib/team-stats.js`. La clasificación y los puntos reusan `src/lib/porra-core.js` (`scorePrediction`) sobre los `result_home`/`result_away` que meta el admin.

### admin-next — cómo arrancarlo

```bash
cd admin-next && npm run dev   # → http://localhost:5174 (5173 ya lo usa la app legacy)
```

Login con `morgadoluengo@gmail.com`. El formulario de crear porra y el listado aparecen directamente.
Haz clic en **→ Gestionar** en una porra para entrar a añadir jugadores, partidos y mini-porra. Al invitar jugadores se pide nombre visible y email; si la cuenta Auth todavía no existe, el panel la crea y la enlaza automáticamente y muestra la contraseña temporal cuando la genera. Los equipos y grupos iniciales se crean desde el asistente guiado de fase de grupos, que obliga a definir cuántos grupos hay, cuántos equipos va a tener cada uno, elegir cada equipo desde un selector con bandera y, al final, crear también los partidos de fase de grupos con fecha opcional. Los equipos repetidos quedan bloqueados en toda la porra. El asistente, la sección de jugadores, la sección de partidos y la mini-porra se mantienen visibles, plegables y editables tras guardar, y al re-guardar actualizan la estructura/regeneran los partidos de grupo. Desde la tabla de partidos también se puede editar inline la fecha/hora de cada partido y **el resultado real** (columna «Resultado»: marcador local-visitante con ✓ guardar y ✕ borrar; `handleSetResult`/`clearMatchResult` escriben `result_home`/`result_away` y `score_home`/`score_away`). Es la entrada manual de resultados, que sirve de fallback de la fuente automática por API (esta última solo existe hoy para el Mundial 2026 legacy y se portará por evento más adelante). La tabla de partidos solo muestra fase de grupos, agrupada por jornada en cabeceras plegables. La porra también se puede devolver a borrador desde cualquier estado. Si se resetea la fase de grupos, el asistente reaparece con la estructura guardada para regenerar exactamente los mismos partidos. Si la porra está en borrador, también se puede borrar desde la lista o desde el detalle. La mini-porra se gestiona como listado editable de preguntas con puntos, tipo de campo y opciones.

La **sección «Cruces»** (toda la gestión de cuadro vive aquí, ya no en Partidos) pinta un cuadro visual por columnas (Octavos→Cuartos→Semifinales→Final→🏆 Campeón). Los controles de generación están siempre presentes: botón **Generar/Regenerar cruces (N equipos: 16→8→4→2→1)** cuyo tamaño se deriva del nº de grupos × 2 clasificados (`knockoutTeamCountFromGroups`/`bracketRoundsForTeamCount`), generador por plantilla oficial de evento (`generateKnockoutMatchesForm` → `handleGenerateKnockoutMatches`) cuando el evento la tiene, **Resetear todos los cruces** y un alta manual por ronda (selector limitado a las rondas de la plantilla). `generateEmptyBracket` crea la primera ronda con semillas de cruce estándar (1A-2B, 1C-2D…) y las rondas siguientes con tokens `W:<match_id>`; `matchTeamLabel`/`resolveKnockoutSeed` resuelven semillas (desde `computeAdminGroupStandings`) y ganadores (desde el resultado del partido alimentador) para mostrar equipo real o etiqueta («1º Grupo A», «Ganador Octavos 1»). Al guardar/limpiar un resultado de cruce se re-renderiza el cuadro conservando los marcadores a medio escribir (`renderPreservingKnockoutInputs`) para propagar ganadores; hay guardado individual (✓/✕) y «Guardar todos los cruces» (`saveAllKnockoutResults`).

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
