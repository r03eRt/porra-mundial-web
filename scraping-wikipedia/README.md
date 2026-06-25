# Scraping de Wikipedia → caché de resultados (app nueva)

Fuente de datos automática para la **plataforma multi-porra** (`admin-next`/`public-next`).
Equivale al cron `sync-worldcup-results` de la legacy, pero con **mejor fuente**: Wikipedia ES
trae goleadores con minuto, sedes, árbitros y asistencia, y se actualiza casi en tiempo real.

> **No pisa la entrada manual.** El caché es una fuente de *fallback automático*. Cuando se
> implemente el sync a `porra_matches`, la regla es: **el resultado manual del admin gana
> siempre**; el sync solo rellena partidos con `result_home`/`result_away` vacíos.

## Por qué Wikipedia es buena fuente

La REST API de Wikipedia (`/api/rest_v1/page/html/...`) expone cada partido como la plantilla
`{{Partido}}` con un atributo `data-mw` que contiene **JSON estructurado** (equipos, código FIFA,
resultado, fecha, hora, estadio, ciudad, goleadores con minuto, penalti/autogol, reporte FIFA).
No hay que parsear HTML frágil. Se parsearon **104/104 partidos sin fallos**.

## Flujo (3 pasos)

```bash
cd scraping-wikipedia

# 1) Descargar el HTML renderizado (regenerable; gitignoreado por tamaño)
curl -sL "https://es.wikipedia.org/api/rest_v1/page/html/Copa_Mundial_de_F%C3%BAtbol_de_2026" \
  -o wc2026.html

# 2) Parsear partidos crudos → wc2026-data.json
node scrape.js

# 3) Construir el payload completo → wc2026-payload.json
node build-payload.js

# 4) Generar el seed SQL para la tabla caché → supabase/seed-event-results-cache-worldcup-2026.sql
node gen-seed.js
```

## Archivos

| Archivo | Qué es |
|---------|--------|
| `scrape.js` | Parsea el `data-mw` de cada `{{Partido}}` del HTML → `wc2026-data.json` (104 partidos crudos) |
| `build-payload.js` | Normaliza y agrega: partidos, máximos goleadores, clasificaciones por grupo, cruces → `wc2026-payload.json` |
| `gen-seed.js` | Convierte el payload en un `INSERT … ON CONFLICT` para `event_results_cache` |
| `wc2026-data.json` | Partidos crudos parseados (commit, para inspección) |
| `wc2026-payload.json` | Payload estructurado final (commit, para inspección) |
| `wc2026.html` | HTML crudo de Wikipedia (gitignoreado, 2.8 MB) |

## Estructura del payload

Ver el comentario de cabecera de `supabase/migrations/20260625160000_event_results_cache.sql`.
Secciones: `meta`, `teams` (catálogo con código FIFA), `matches` (con `goals.home/away`),
`topScorers` (ranking agregado sin autogoles), `standings` (clasificación por grupo derivada de
los partidos jugados), `knockout` (cruces por ronda).

El formato de cada gol (`{name, minutes, penalty, owngoal}`) encaja con `goalBreakdown()` de
`public-next` y con el jsonb `porra_matches.scorers`.

> **Ojo con los minutos**: la plantilla usa doble pipe como separador —
> `{{gol|17||60||76}}` son 3 goles, no 1. El split de `parseGoals` incluye `|` además de
> coma/espacio (`/[|,\s]+/`); sin eso, los hat-tricks/dobletes contaban como un solo gol.

## Automatización (Edge Function + cron)

El parser de estos scripts está portado a Deno/TS en
`supabase/functions/sync-wikipedia-results/index.ts`. Esa Edge Function hace fetch a la
REST API de Wikipedia, construye el mismo payload y lo hace `upsert` en
`event_results_cache` (no toca `porra_matches`). Es genérica por evento
(`?event=worldcup-2026`, default; `?force=1` para forzar) y tiene caché propia
(15 min normal / 2 min en ventana de partido).

```bash
# Desplegar la función
npx supabase functions deploy sync-wikipedia-results

# Probar a mano (forzar scrape)
curl -s "https://tsbjhbpdvewqysgmrhci.supabase.co/functions/v1/sync-wikipedia-results?force=1" \
  -H "apikey: sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw"
```

Cron cada 4 h (la app aún no lo consume): `supabase/cron-sync-wikipedia-results.sql` (requiere `pg_cron` + `pg_net`
habilitados en el dashboard).

## Pendiente

- Proceso de sync `event_results_cache` → `porra_matches` (mapeo de equipos por código/alias,
  respetando la regla de **fallback manual**: el resultado del admin gana siempre, el sync
  solo rellena partidos vacíos).
