# Planteamiento: plataforma multi-porra

Documento de diseño para poder **crear porras de cualquier evento** (Mundial,
Eurocopa, Nations League…) sin afectar a la porra actual del Mundial 2026.

> Estado: **Fase 1 en curso**. Al 2026-06-23 el dashboard `admin-next/` ya cubre
> login admin, crear/listar porras, detalle por porra, jugadores, grupos,
> equipos con bandera ligada, ordenados por grupo y editables, con arrastre
> dentro del mismo grupo, asistente guiado para crear grupos y equipos paso a
> paso, que se mantiene visible, plegable y editable tras guardar, y las secciones
> de jugadores, partidos y mini-porra también se pueden plegar, generación al final de
> los partidos de grupo con fecha opcional, reset de partidos de grupo por
> jornadas, mini-porra editable, orden manual de partidos con arrastre en fase
> de grupos, borrado de borradores, reaparición del asistente al reset,
> avance de estado y cruces por plantilla de evento. En Eurocopa el asistente
> guarda también la variante de reglas oficial: 8, 16 o 24 equipos según el
> ciclo, con el bracket y los terceros aplicables a cada formato. En Mundial el
> asistente guarda la variante de reglas: 32 equipos o 2026/48 equipos con
> mejores terceros. Nations League no se trata como un único bracket, sino como
> ligas + ascensos/descensos + play-offs + Final Four de Liga A.

## 1. Origen y objetivo

Esta app se construyó para una porra concreta (Mundial 2026). A raíz de eso,
queremos poder **generar las siguientes** sin reescribir todo. El objetivo es
una plataforma donde un admin crea una porra, la configura entera, invita a los
jugadores, y todos la ven con **las mismas features que la app actual**.

## 2. Principio rector

La app del Mundial 2026 **no se toca**. Sigue siendo código legacy con su
`window.PORRA_DATA` y sus tablas actuales. Todo lo nuevo vive en **tablas nuevas**
(scoped por `porra_id`) y en una **app nueva**. Riesgo cero para producción.

## 3. Decisiones tomadas

- **Resultados**: manuales (el admin los mete). Fuente automática, opcional y
  por evento, en una fase posterior.
- **Convivencia**: la porra actual queda intacta; el sistema nuevo va en paralelo.
- **Creación**: solo el admin crea porras y **invita** a los usuarios.
- **Configuración**: el admin configura todo **antes** de abrir la porra
  (asistente de creación).
- **Estructura de datos**: muy parecida a la actual.

## 4. Dónde vive (recomendación)

**App nueva y separada, en el mismo repo, compartiendo el mismo proyecto Supabase.**

Motivo: la app actual asume un único evento cargado en el bundle
(`window.PORRA_DATA`, ~97 usos de `DATA.`). El sistema nuevo necesita ser
dinámico (cargar la porra X desde Supabase). Mezclarlos en el `app.js` actual
(4.000+ líneas) entrelaza legacy y nuevo y arriesga lo que funciona. Las carpetas
`admin-next/` y `supabase-next/` (vacías) ya apuntaban a esto.

Supabase: **reusar el proyecto actual** y añadir tablas nuevas (no crear otro
proyecto). Menos operativa; las tablas nuevas no tocan las viejas.

**Reutilizable tal cual** (lógica pura, agnóstica de framework):
`src/lib/porra-core.js`, `knockout-bracket.js`, `team-stats.js`,
`probabilities.js`, `statistics-utils.js`. El cálculo de puntos, brackets,
clasificación por grupos y probabilidades NO se reescribe.

## 5. Las dos caras de la app nueva

- **Dashboard (con login, solo admin)**: asistente de creación + gestión en vivo
  (mini-porra editable, abrir/cerrar la porra, invitar jugadores y la parte
  operativa que vaya tocando en cada fase).
- **Vista pública (sin login)**: por URL `/p/<slug>`, con **todas las pestañas**
  de la app actual, leyendo los datos de esa porra.
- **Predicciones del jugador**: mismo patrón que el actual (login Supabase Auth +
  editar su propia porra con deadline), pero un usuario puede jugar **varias
  porras** (relación por `porra_players.user_id`).

## 6. Roles

- **Admin**: crea porras, las configura, invita jugadores, mete resultados. Es el
  dueño de las porras que crea (`porras.owner`).
- **Jugador**: invitado por el admin. Edita su propia porra hasta el deadline.
  Reusa Supabase Auth (cuenta con `player_id`/porra asociada).
- No hay autoservicio: los jugadores no crean porras.

## 7. Modelo de datos (nuevo, todo con `porra_id`)

```
porras                → nombre, tipo de evento, estado (borrador/abierta/en juego/
                        cerrada), slug público, dueño, fecha límite de predicciones,
                        config de puntuación (jsonb), config de cruces (jsonb),
                        flags de features activas (mejores terceros, goleadores,
                        estadísticas, directo…)
porra_teams           → equipos del evento (nombre, bandera/emoji, orden por grupo)
porra_groups          → grupos (A, B…) y qué equipos van en cada uno
porra_matches         → partidos: fase (grupo/cruce), grupo, equipo1, equipo2,
                        fecha, resultado_real (lo mete el admin), goleadores (opc.)
porra_players         → participantes; user_id para autoedición
porra_predictions     → predicción de cada jugador por partido (marcador/signo)
porra_mini_questions  → preguntas mini (texto, puntos, tipo de campo, opciones)
porra_mini_answers    → respuesta de cada jugador a cada mini-pregunta
porra_mini_results    → resultado oficial de cada mini-pregunta
porra_knockout_picks  → pronóstico de cruces por jugador (estructura configurable)
```

**El formato es configuración, no código:**
- **Puntuación** (exacto, signo, puntos por ronda de cruces) → jsonb en `porras`.
- **Estructura de cruces** → jsonb con las rondas
  `[{clave, etiqueta, equipos, puntos}]`. Mundial 32→16→8→4→2→1; Mundial 2026
  48→32→16→8→4→2→1; Eurocopa 8→4→2→1, 16→8→4→2→1 y 24→16→8→4→2→1; Nations
  League se guarda aparte como estructura de ligas, ascensos/descensos,
  play-offs y Final Four. El dashboard puede además persistir una plantilla
  concreta de cruces por evento en `scoring.knockout.templateId`, para que la
  UI del admin genere la secuencia oficial de emparejamientos.
- **¿Hay grupos? ¿cruces? ¿mini?** → flags de la porra.

## 8. Paridad de features

La vista pública tendrá **todas las pestañas** de la app actual. Desglose por
cómo se alimenta cada una:

**Automáticas (con los datos propios de la porra):**
Clasificación, Editar mi porra, Histórico, Mini-porra, Partidos, Cruces,
Clasificación de grupos, Detalle de jugador, Equipos, Probabilidades, Comparador.

**Según formato (flag al crear la porra):**
- Mejores terceros → solo si el torneo clasifica mejores terceros.

**Dependen de datos extra o fuente externa (pestaña activable por porra):**
- Máximos goleadores → requiere que el admin introduzca goleadores por partido
  (o fuente automática).
- Estadísticas (rankings jugadores/equipos) → específica de AS; por evento.
- Tarjeta de directo → específica de AS; por evento.

Regla: si una pestaña no tiene con qué alimentarse, no se muestra en esa porra.

## 9. Resultados (mixto)

- **Fase 1 — manual**: el admin mete marcadores en el dashboard; el cálculo de
  puntos es automático. Funciona para cualquier evento desde el día uno.
- **Fase 2 (opcional) — auto**: cada porra puede declarar una fuente; si existe
  integración para ese evento se conecta, si no se queda manual.

## 10. Fases de implementación

| Fase | Qué | Resultado |
|---|---|---|
| 0 ✅ | Modelo de datos en Supabase (tablas nuevas + RLS), sin UI | Hecho: `supabase/platform-schema.sql` (migración `20260623000000`) |
| 1 🚧 | Dashboard MVP: crear porra, configurar y operar manualmente | En curso: app `admin-next/` (Vite + supabase-js). Hecho: login admin, crear/listar porras, borrar borradores, detalle por porra, asistente guiado para crear grupos/equipos por pasos y generar los partidos al final con fecha opcional, mini-porra editable, generación y reset automático de partidos de grupo por jornadas con fecha inicial opcional y días entre jornadas, asistente que permanece visible/plegable/editable tras guardar, secciones de jugadores/partidos/mini-porra plegables, edición inline de la fecha/hora de cada partido, **entrada manual del resultado real por partido**, tabla de partidos agrupada por jornada plegable (solo fase de grupos), **sección «Cruces» con cuadro visual** (Octavos→Cuartos→Semis→Final→🏆 Campeón) que genera el bracket según el nº de grupos (top-2 → `16→8→4→2→1`…) o por plantilla oficial, siembra la 1ª ronda con cruces estándar y enlaza las siguientes con tokens de ganador resueltos por resultado, propagando ganadores al guardar sin perder casillas a medio editar, la porra puede volver a borrador desde cualquier estado, contraseña temporal visible en la tabla de jugadores cuando se crea una cuenta nueva, reaparición del asistente al reset para regenerar la misma fase de grupos, orden manual de partidos con botones y arrastre en fase de grupos, y ciclo `draft → open → playing → closed` |
| 2 🚧 | Predicciones de jugadores + clasificación pública | En curso: app `public-next/` (Vite + supabase-js, puerto 5175). Hecho: vista pública por slug `/p/<slug>` con pestañas Clasificación, Partidos, Mini-porra y Cruces; login de jugador (Supabase Auth email/password vinculado por `porra_players.user_id`), "Mi porra" para editar marcadores de grupo en `porra_predictions` mientras la porra está `open` y antes del deadline, con guardado/borrado por fila y toast de confirmación/error, mini-porra pública con tabla final de pronósticos + edición de respuestas propias, y cuadro de cruces estilo legacy con puntuación por ronda y edición manual de los cruces propios. **Puntuación de cruces corregida**: la realidad de cada ronda resuelve las semillas/tokens de ganador del cuadro del admin a nombre de equipo real con los resultados oficiales (`teamName`/`resolveKnockoutSeed`) y los pronósticos del jugador se leen del cuadro derivado (`buildPlayerKnockoutBracket`, 1ª ronda incluida); antes no sumaba porque realidad iba por `team_id` y los picks por nombre. Prerrequisito SQL: `supabase/platform-player-write.sql` (políticas RLS de escritura del jugador), **pendiente de aplicar**. Falta: clasificación de grupos calculada |
| 3 | Mini-porras + cruces configurables | Porra completa |
| 4 | Entrada de resultados + cálculo automático + vistas en vivo | Operativa de torneo |
| 5 | (Opc.) goleadores/estadísticas/fuentes automáticas | Paridad total + comodidad |

Cada fase es desplegable y no toca la app del Mundial.

## 11. Riesgos y aislamiento

- **Romper lo actual**: imposible por diseño (tablas, app y deploy nuevos).
- **Sobre-ingeniería**: se empieza por manual + MVP; formato-como-configuración
  evita rehacer código por cada evento.
- **Doble mantenimiento**: asumible; la app nueva nace limpia y la vieja se queda
  congelada. Si algún día se quiere, la del Mundial se recrea como "la primera
  porra" del sistema nuevo.
