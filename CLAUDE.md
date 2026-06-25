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
`prediction_overrides`, `app_config`, `player_access`, `knockout_manual_winners`

## App legacy — Cuadro real de cruces (2026-06-25)

La pestaña **Cruces** de la legacy (`src/app.js`) muestra dos cuadros:

1. **🏆 Cuadro real** (plegable con `<details>`): bracket visual con los equipos reales de cada ronda según clasificaciones de grupo y resultados de la API. Funciones clave:
   - `buildRealityBracket()` → construye el bracket desde `state.apiFixtures`, resolviendo seeds (`1A`, `2B`, `3A/B/C/D/F`, `W73`) a nombres locales de equipo con `resolveSeed()`.
   - **Orden de bracket FIFA 2026**: los cruces de R32 se reordenan siguiendo el árbol del torneo (Final→SF→QF→R16→R32 con `extractFeedNums`) para que los matches que se cruzan en la siguiente ronda estén adyacentes.
   - **Confirmación**: cada equipo muestra ✓ si está confirmado (`isSeedConfirmed`): grupo completo para seeds simples, todos los grupos completos para mejores terceros, o resultado del partido para tokens `W<num>`.
   - **Badge de grupo**: letra del grupo junto al nombre del equipo (`TEAM_GROUP_MAP`).
   - **Botón toggle**: el cuadro real aparece **colapsado por defecto**; un botón «▼ Mostrar cuadro real / ▲ Ocultar cuadro real» (`.btn-reality-toggle`, id `btnToggleRealityBracket`) controla `state.realityBracketOpen` y re-renderiza con `renderKnockout()`.
   - **Admin: entrada manual de ganadores** (fallback antes de que la API actualice): botones ⬆/⬇ por cruce para marcar quién pasa + ✕ para borrar + «🗑 Resetear ganadores manuales». **Persistido en Supabase** (tabla `knockout_manual_winners`, migración `20260625120000_knockout_manual_winners.sql`) para compartirse entre todos los dispositivos/usuarios; `localStorage` (`state.knockoutManualWinners`, clave `porra.knockoutManualWinners.v1`) queda solo como caché local. `setKnockoutManualWinner`/`clearKnockoutManualWinner`/`resetKnockoutManualWinners` escriben en BD (`upsert`/`delete`); `loadKnockoutManualWinnersFromSupabase()` los carga al arrancar (lectura pública por RLS, escritura `authenticated`). `winnerFromApiMatch()` comprueba el override manual antes del score de la API. Los ganadores manuales propagan a rondas siguientes vía tokens `W<num>`. El cuadro real sigue siendo **derivado**: combina estos overrides con los resultados de la API (`worldcup_results_cache`), no se guarda resuelto.
2. **Pronóstico del jugador**: selector debajo del cuadro real, puntos por ronda y bracket visual con los picks de cada participante (sin cambios respecto al original).

### App legacy — Mejores terceros

La pestaña **Mejores terceros** muestra por defecto solo los **8 clasificados** (`BEST_THIRDS_QUALIFY_COUNT`). `calculateAllThirds()` devuelve el tercero de cada grupo ordenado por pts/DG/GF/grupo; `calculateBestThirds()` = top-8 (lo usan `resolveSeed`/bracket). `renderBestThirds()` añade un botón **«▼ Mostrar todos (N) / ▲ Mostrar solo los clasificados»** (`#bestThirdsToggle`, `.btn-best-thirds-toggle` en `index.html`) que alterna `state.bestThirdsShowAll`; al expandir, los terceros que no clasifican aparecen sin la clase `qualified-third`.

## Tablas (plataforma multi-porra, prefijo `porra_`)

`porras`, `porra_teams`, `porra_groups`, `porra_matches`, `porra_players`,
`porra_predictions`, `porra_mini_questions`, `porra_mini_answers`,
`porra_mini_results`, `porra_knockout_picks`, `platform_admins`

## Plataforma multi-porra — estado actual

| Fase | Estado | Qué hay |
|------|--------|---------|
| 0 | ✅ | Esquema DB aplicado (`supabase/platform-schema.sql`) |
| 1 | 🚧 | `admin-next/`: login admin, crear/listar porras, gestionar jugadores/grupos/equipos con bandera ligada, ordenados por grupo y editables/partidos/mini-porra, generar y resetear fase de grupos por jornadas, ordenar partidos con subir/bajar y arrastre en fase de grupos, **introducir el resultado real de cada partido inline** (columna «Resultado» en la tabla de partidos; entrada manual = fallback de la fuente automática), y cambiar estado. La tabla de partidos agrupa por jornada plegable (solo fase de grupos; los cruces ya no salen ahí). **Sección «Cruces» con cuadro visual** (columnas Octavos→Cuartos→Semis→Final→🏆 Campeón): genera el bracket cuyo tamaño deriva del nº de grupos (top-2 → 16→8→4→2→1, etc.), la primera ronda lleva semillas (`A1`,`B2`) y las siguientes tokens de ganador (`W:<match_id>`) que se resuelven con los resultados; al guardar un resultado de cruce el ganador propaga a la ronda siguiente sin perder otras casillas a medio editar, con guardado individual o «Guardar todos los cruces». Sigue ofreciendo el generador por plantilla de evento (ahora dentro de Cruces); Eurocopa permite elegir entre reglas 8, 16 y 24 equipos según el ciclo oficial, Mundial entre 32 equipos y 2026/48 equipos, y Nations League se guarda aparte como ligas + ascensos/descensos + play-offs + Final Four de Liga A. |
| 2 | 🚧 | `public-next/`: vista pública por slug `/p/<slug>`, login de jugador (Supabase Auth), "Mi porra" para editar marcadores en `porra_predictions` con toast de guardado/borrado por fila y guardado masivo, mini-porra pública con tabla final de pronósticos + edición de respuestas del jugador cuando la porra está abierta, y cruces estilo legacy con puntuación por ronda + edición manual de los cruces propios mientras la porra esté abierta. La vista resuelve las semillas de cruces a partir de la clasificación de grupos del propio jugador para renderizar brackets de eventos tipo Eurocopa y Mundial; la primera ronda se genera automáticamente y la edición arranca en el siguiente tramo, donde el editor usa banderas y limita cada selector al seed oficial del cruce y a las opciones coherentes con la ronda anterior. **Puntuación de cruces corregida**: la «realidad» de cada ronda resuelve las semillas/tokens de ganador del cuadro del admin a **nombre** de equipo real (`teamName`/`resolveKnockoutSeed` con resultados oficiales) y los pronósticos del jugador se leen del cuadro derivado (`buildPlayerKnockoutBracket`, primera ronda incluida), así que los aciertos por ronda + Campeón ya suman. **Cuadro de cruces corregido** (2026-06-24): `parseGroupSeed()` soporta semillas `A2` y `2A`; `team.group_id` se normaliza UUID→letra en `loadPorra()`; picks explícitos de primera ronda se usan directamente; validación `allowed` eliminada en r16+; **paginación `fetchAllRows()` en `porra_knockout_picks`, `porra_predictions` y `porra_mini_answers`** (en `loadPorra()` y en los `refresh*FromState()`) para superar el límite de 1000 filas de PostgREST (`db-max-rows` server-side: ignora `.limit(5000)`; hay que pedir en bloques de 1000 con `.range()` hasta agotar). Sin esto, en porras grandes (22 jugadores × 63 picks = 1.386 filas) los jugadores más allá del corte de 1000 cargaban **sin pronósticos** y su cuadro de cruces se renderizaba derivado de las semillas en vez de sus picks (corregido 2026-06-24). RLS de escritura del jugador **aplicada** (migración `20260623040000_player_write_predictions.sql`: funciones `pp_is_player`/`pp_predictions_open` + políticas `… player write`). **Mejores terceros** (`renderBestThirds`/`calculateBestThirds`): tabla con los terceros clasificados de cada grupo ordenados por pts/DG/GF, marcando con acento los que pasan según el `thirdPlaceQualifiers` de la plantilla del evento. **Probabilidades** (`renderProbabilities`/`runProbabilitiesSimulation`): Monte Carlo de 2000 iteraciones — simula el resto de los partidos de grupo muestreando las predicciones de los jugadores, y los cruces ponderando por los picks de cada participante; muestra probabilidad de ganar + media de puntos + puntos actuales para cada jugador (porra principal y mini-porra si existe) y probabilidad de que cada selección alcance cada ronda del cuadro. Caché invalidada por número de resultados conocidos/predicciones. **Histórico** (`renderHistory`/`buildHistoricalSnapshots`/`renderHistoryChart`): snapshots acumulativos uno por partido jugado (ordenados por `position`), selector + slider de punto de corte, gráfico SVG de evolución de posiciones con líneas por jugador en paleta de 16 colores (puerto del SVG del legacy), 4 tarjetas resumen (líder, total jugadores, partidos jugados, último resultado), tabla de clasificación con columnas #/Mov/Participante/Total/1ª fase/Exactos/Aciertos/[Cruces]/Jugados; scoring histórico via `calcRankingFromResults`/`buildKnockoutRealityFromMap`. |
| 3+ | ⬜ | Mini/cruces totalmente configurables, fuente automática de resultados por API por evento, vistas en vivo |

### public-next — cómo arrancarlo

```bash
cd public-next && npm run dev   # → http://localhost:5175
```

Abrir una porra por slug: `http://localhost:5175/p/<slug>` (o `?slug=<slug>`). El menú replica el de la app legacy (array `TABS` en `main.js`). **Todas las pestañas están portadas** (ya no queda ninguna como placeholder): Clasificación porra, Editar mi porra (solo con jugador logueado), Partidos, Cruces, Clasificación grupos, Equipos, Detalle jugador, Mini-porra, Mejores terceros, **Máximos goleadores**, Probabilidades, **Estadísticas**, **Histórico** y **Comparador**. **Comparador** (`renderCompare`/`compareMatchLabel`/`comparePlayerCard`, estado `state.compareMatchId`/`state.comparePlayers`): puerto de la legacy; un `<select>` elige el partido (grupos + cruces, etiquetados por grupo o ronda con `KNOCKOUT_STAGE_META`) y se añaden jugadores uno a uno desde otro selector; cada tarjeta muestra el pronóstico, la quiniela (`signFromScore`), el estado (Exacto/Quiniela/Fallado/Pendiente vía `compareStatus`) y los puntos del jugador en ese partido (reusa `scorePrediction`/`matchResult`/`scoringConfig`), con botón «Quitar» por tarjeta; clases `.compare-*` portadas a `styles.css`. **Máximos goleadores** (`renderTopScorers`/`calculateTopScorers`): agrega los goleadores de `porra_matches.scorers` (el mismo jsonb que alimenta el desplegable "Ver goleadores" de cada partido, parseado con `goalBreakdown`) en una clasificación global de hasta 15, ignorando goles en propia puerta, igual que la legacy; muestra Pos./Jugador/Selección (con bandera)/Goles. Encima del menú se muestran tarjetas de accesos rápidos (`#summary`). Las tarjetas de **último partido** y **siguiente partido** son pulsables (`summary-match-card`, `role=button` + Enter/Espacio) y abren un modal (`openMatchPredictions` sobre un `<dialog>` creado bajo demanda) con el pronóstico, la quiniela (1/X/2) y los puntos de cada jugador para ese partido, ordenados por puntos; cabecera con marcador y goleadores si el partido ya se jugó (puerto del `openMatchPredictions` de la legacy). Con **Entrar para jugar** (email/password de la cuenta Auth del jugador, enlazada por `porra_players.user_id`) se desbloquea **Editar mi porra**; solo guarda si la porra está `open` y antes del `predictions_deadline`, y muestra toast de confirmación/error al guardar o borrar por fila. La mini-porra muestra la tabla final de pronósticos con puntos y deja editar/borrar las respuestas propias mientras la porra siga abierta; si la porra **no está abierta** (o pasó el deadline), el panel «Resultados de la mini-porra» **oculta el editor y sus botones** (Guardar/Limpiar) y muestra un aviso de cerrada en vez de mostrarlos deshabilitados (`renderMini` condiciona el editor a `miniEditOpen()`). La pestaña **Cruces** pinta el cuadro estilo legacy, calcula puntos por ronda desde `porra_matches`/`porra_knockout_picks`, genera automáticamente la primera ronda desde la clasificación de grupos del propio jugador y habilita la edición manual del resto mientras la porra esté abierta, con selector por tramo, banderas y seeds oficiales por cruce. La puntuación compara los pronósticos del jugador (del cuadro derivado `buildPlayerKnockoutBracket`, primera ronda incluida) contra la «realidad» de cada ronda (`buildKnockoutReality`), que resuelve las semillas/tokens `W:` del cuadro del admin a **nombre** de equipo real con los resultados oficiales (`teamName`/`resolveKnockoutSeed`); el campeón se compara con el ganador de la final. **La realidad solo cuenta un equipo en una ronda cuando está realmente decidido** (`knockoutRealityTeamName`): una semilla de grupo (A1/B2) exige que TODOS los partidos de ese grupo tengan resultado (`groupIsComplete`), y un token de ganador `W:matchId` exige que ese partido tenga resultado; mientras la fase de grupos siga en juego (p.ej. jornada 3 sin resultados), los cruces dan **0 puntos** en vez de puntuar contra clasificaciones de grupo provisionales (corregido 2026-06-24). El **Histórico** usa la variante consciente del snapshot `knockoutRealityTeamNameFromMap`/`groupIsCompleteInMap` para no adelantar cruces con resultados que aún no había en ese punto de corte. **Cuadro vacío para jugadores sin pronósticos** (corregido 2026-06-24): `buildPlayerKnockoutBracket` devuelve un cuadro vacío si el jugador no tiene **ningún** dato propio (`playerHasKnockoutInput`: ni picks de cruces ni predicciones de grupo); así un jugador recién añadido a la porra ve los cruces **en blanco** en vez de un cuadro derivado de las semillas/posiciones por defecto. La primera ronda solo se deriva de la clasificación de grupos del jugador cuando este ya ha pronosticado algún partido de grupo. JS vanilla con event delegation, mismo patrón que `admin-next/`.

**Aspecto idéntico a la legacy**: `public-next/src/styles.css` reusa la paleta (acento verde `#53e0b4`) y las clases de la app del Mundial (`.hero`, `.tabs`, `.panel`, `.table-wrap`, `.rank-1/2/3`, `.points`, `.matchdays`/`.match-card`/`.match-goals`, `.group-standings-grid`, `.teams-layout`/`.team-chart-card`). **Partidos** se agrupan por jornada (`porra_matches.slot`) → grupo, con `match-card`, marcador grande y "Ver/Ocultar goleadores" (lee `porra_matches.scorers`). **Equipos** usa el layout de dos columnas (lista con buscador + detalle con tarjetas y barras de progreso) reutilizando `src/lib/team-stats.js`. La clasificación y los puntos reusan `src/lib/porra-core.js` (`scorePrediction`) sobre los `result_home`/`result_away` que meta el admin.

### admin-next — cómo arrancarlo

```bash
cd admin-next && npm run dev   # → http://localhost:5174 (5173 ya lo usa la app legacy)
```

Login con `morgadoluengo@gmail.com`. El formulario de crear porra y el listado aparecen directamente.
En la cabecera del detalle, junto al nombre, se muestra el **enlace a la página pública** de la porra (`/p/<slug>`, abre en pestaña nueva) y un botón **«Copiar enlace»** (`PUBLIC_SITE_BASE` define la base de public-next, hoy `http://localhost:5175`; cambiar al desplegar). Al **cambiar el nombre** de la porra (botón ✎) se **regenera también el slug** a partir del nombre (`slugify`); si el nuevo slug choca con otra porra se le añade un sufijo corto del id. Ojo: cambiar el slug cambia la URL pública. Haz clic en **→ Gestionar** en una porra para entrar a añadir jugadores, partidos y mini-porra. Al invitar jugadores se pide nombre visible y email; si la cuenta Auth todavía no existe, el panel la crea y la enlaza automáticamente y muestra la contraseña temporal cuando la genera. Los equipos y grupos iniciales se crean desde el asistente guiado de fase de grupos, que obliga a definir cuántos grupos hay, cuántos equipos va a tener cada uno, elegir cada equipo desde un selector con bandera y, al final, crear también los partidos de fase de grupos con fecha opcional. Los equipos repetidos quedan bloqueados en toda la porra. El asistente, la sección de jugadores, la sección de partidos y la mini-porra se mantienen visibles, plegables y editables tras guardar, y al re-guardar actualizan la estructura/regeneran los partidos de grupo. Al añadir jugadores, encima del formulario aparece un selector **«Reutilizar jugador ya existente»** (`reusePlayerSelect` + botón «Añadir seleccionado») con los jugadores distintos de otras porras (`loadKnownPlayers`/`state.knownPlayers`, **dedup por `user_id`** con email como respaldo, excluye los ya añadidos a esta porra). Al pulsar «Añadir seleccionado» (`addReusePlayer`) la Edge Function `admin-next-add-player` enlaza la cuenta existente **por `user_id`** (o por email si no hay cuenta) sin crear una nueva, conservando login y contraseña entre porras. El dedup va por `user_id` porque la mayoría de jugadores tienen cuenta de Auth enlazada pero el email puede no estar copiado en `porra_players.email`. Cada jugador de la tabla tiene un botón 🔑 para **cambiar su contraseña** inline: abre un campo de contraseña **ofuscado** (`type="password"` con toggle 👁 para mostrar/ocultar); si se deja vacío se genera una al azar. Lo persiste la Edge Function `admin-next-set-player-password` (verifica `pp_owns` + busca el `user_id` del jugador + `auth.admin.updateUserById`), y la contraseña resultante se muestra en la columna «Contraseña temporal» (`handleSetPlayerPassword`/`state.editingPlayerPasswordId`). El **email** de cada jugador también se edita inline con un botón ✎ en su celda: lo persiste la Edge Function `admin-next-set-player-email`, que actualiza el email de Auth (`updateUserById` con `email_confirm`) si el jugador tiene cuenta enlazada y el campo `porra_players.email` (`handleSetPlayerEmail`/`state.editingPlayerEmailId`); devuelve 409 si el email ya lo usa otra cuenta de Auth. Desde la tabla de partidos también se puede editar inline la fecha/hora de cada partido y **el resultado real** (columna «Resultado»: marcador local-visitante con ✓ guardar y ✕ borrar; `handleSetResult`/`clearMatchResult` escriben `result_home`/`result_away` y `score_home`/`score_away`). Es la entrada manual de resultados, que sirve de fallback de la fuente automática por API (esta última solo existe hoy para el Mundial 2026 legacy y se portará por evento más adelante). La tabla de partidos solo muestra fase de grupos, agrupada por jornada en cabeceras plegables, y el contador del encabezado «Partidos (N)» cuenta solo partidos de grupo (`groupMatchCount`), no los cruces (que tienen su propio contador en la sección «Cruces»). La porra también se puede devolver a borrador desde cualquier estado. Si se resetea la fase de grupos, el asistente reaparece con la estructura guardada para regenerar exactamente los mismos partidos. Si la porra está en borrador, también se puede borrar desde la lista o desde el detalle. La mini-porra se gestiona como listado editable de preguntas con puntos, tipo de campo y opciones.

La **sección «Cruces»** (toda la gestión de cuadro vive aquí, ya no en Partidos) pinta un cuadro visual por columnas (Octavos→Cuartos→Semifinales→Final→🏆 Campeón). Los controles de generación están siempre presentes: botón **Generar/Regenerar cruces (N equipos: 16→8→4→2→1)** cuyo tamaño se deriva del nº de grupos × 2 clasificados (`knockoutTeamCountFromGroups`/`bracketRoundsForTeamCount`), generador por plantilla oficial de evento (`generateKnockoutMatchesForm` → `handleGenerateKnockoutMatches`) cuando el evento la tiene, **Resetear todos los cruces** y un alta manual por ronda (selector limitado a las rondas de la plantilla). `generateEmptyBracket` crea la primera ronda con semillas de cruce estándar (1A-2B, 1C-2D…) y las rondas siguientes con tokens `W:<match_id>`; `matchTeamLabel`/`resolveKnockoutSeed` resuelven semillas (desde `computeAdminGroupStandings`) y ganadores (desde el resultado del partido alimentador) para mostrar equipo real o etiqueta («1º Grupo A», «Ganador Octavos 1»). Al guardar/limpiar un resultado de cruce se re-renderiza el cuadro conservando los marcadores a medio escribir (`renderPreservingKnockoutInputs`) para propagar ganadores; hay guardado individual (✓/✕) y «Guardar todos los cruces» (`saveAllKnockoutResults`). **Selección manual de equipos por casilla**: cada cruce tiene un botón ✎ que abre dos selectores (local/visitante) con todos los equipos de la porra para **fijar a mano** los equipos de esa ronda en vez de depender de la semilla automática (`state.knockoutEditTeams` marca el cruce en edición; `knockoutTeamSelectOptions` ofrece la opción «Auto · <semilla>» para volver a la resolución automática además del catálogo de equipos; `handleSetKnockoutTeams` escribe `team1`/`team2`/`team1_id`/`team2_id`). El equipo fijado se propaga como ganador a la ronda siguiente cuando el cruce tiene resultado. **Penaltis en cruce con empate**: si el marcador de un cruce es empate, aparecen dos botones «pasa por penaltis» (local/visitante) que guardan `porra_matches.pen_winner` (`'team1'`/`'team2'`/null); el marcador real del empate se conserva en `result_home`/`result_away` por si más adelante se puntúa con él. La resolución del ganador centraliza en `knockoutWinnerToken(match)` (admin y `public-next`): victoria por marcador o, en empate, por `pen_winner`; `resolveKnockoutSeed`, la columna Campeón, `winnerFromMatch`/`buildKnockoutReality` y la simulación Monte Carlo la usan. `matchTeamLabel` etiqueta el token **ya resuelto** (`knockoutSeedLabel(resolved)`), de modo que un `W:R32-1` que en empate+penaltis propaga a la semilla `2B` se muestra como «2º Grupo B» (no «Ganador Dieciseisavos»); pasará a nombre real de equipo cuando el grupo correspondiente quede decidido. Borrar el marcador o pasar a un resultado decisivo limpia `pen_winner`. Requiere la migración `20260624120000_knockout_pen_winner.sql`.

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

Funciones de admin-next (con `verify_jwt` por defecto = true; el frontend pasa el header de Authorization y verifican `pp_owns`): `admin-next-add-player` (crea/enlaza la cuenta Auth del jugador), `admin-next-set-player-password` (cambia la contraseña de un jugador vía `auth.admin.updateUserById`), `admin-next-set-player-email` (cambia el email de Auth + `porra_players.email`). Usan `SUPABASE_SERVICE_ROLE_KEY`, por eso van en Edge Function y no en el frontend. Deploy: `npx supabase functions deploy <nombre>`.

## Deadline de edición de jugadores

Tabla `app_config`, clave `player_edit_deadline`. Valor actual: `2026-07-19T23:59:00Z`.
Para cambiarla: ejecutar `supabase/set-edit-deadline.sql` o actualizar directo en SQL Editor.

## Backup

```bash
bash supabase/backup.sh   # → supabase/backup/<timestamp>/
```
