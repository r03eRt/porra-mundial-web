# Porrazo 2026

Proyecto web estático generado desde `PORRA MUNDIAL 2026 VILLAVERDE.xlsx`.

## Qué incluye

- `index.html`: aplicación principal.
- `src/app.js`: lógica de cálculo, API, localStorage e interfaz.
- `src/styles.css`: estilos responsive.
- `data/porra-data.js`: participantes, partidos y predicciones extraídas del Excel.

## Desarrollo local

Instala las dependencias la primera vez:

```bash
cd porra-mundial-web
npm install
```

Arranca el servidor de desarrollo:

```bash
npm run dev
```

Vite mostrará la URL local, normalmente:

```text
http://localhost:5173
```

Los cambios en HTML, CSS, JavaScript y datos recargan automáticamente el navegador.

Para comprobar la versión de producción:

```bash
npm run build
npm run preview
```

## Fuente de resultados

Por defecto usa:

```text
https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
```

OpenFootball no necesita API key, pero no es una fuente live oficial. Según el propio proyecto, los datos se actualizan como dataset comunitario/manual, no en tiempo real.

## Arquitectura actual de datos

La aplicación ya no consulta OpenFootball directamente desde cada móvil como flujo principal. Ahora el montaje bueno es este:

1. Supabase ejecuta funciones programadas con `pg_cron`.
2. Esas funciones refrescan tablas cache en Supabase.
3. El frontend lee primero esas tablas cache.
4. Solo si algo falla, el frontend hace fallback a la fuente externa o a datos locales según la sección.

La idea es:

- reducir peticiones repetidas desde cada usuario
- evitar problemas de caché agresiva en móvil, especialmente Safari/iPhone
- centralizar el refresco en un único punto
- mantener sensación de datos recientes cuando hay partidos cerca o en juego

## Qué guarda Supabase

- `mini_results`: respuestas editables de la mini-porra.
- `as_rankings_cache`: caché de estadísticas de jugadores y selecciones.
- `worldcup_results_cache`: caché central de resultados y partidos del Mundial 2026.
- `as_live_match_cache`: tarjeta del partido en directo de AS que aparece en portada.
- `prediction_overrides`: correcciones sobre fase de grupos, mini-porra y cruces. Las escribe tanto el admin (cualquier jugador) como cada jugador sobre su propia porra.
- `app_config`: configuración editable de la app. Hoy guarda `player_edit_deadline`, la fecha límite hasta la que cada jugador puede editar su porra.
- `player_access`: tabla del antiguo login por PIN. Sustituida por Supabase Auth (ver «Login y roles»); se mantiene por compatibilidad.

Además, en el mismo proyecto Supabase conviven las tablas `porra_*` y `platform_admins` de la **plataforma multi-porra** (crear porras de futuros eventos). Son independientes de las de arriba y no afectan a la porra del Mundial. Ver «Plataforma multi-porra».

## Fuente de verdad por pantalla

La app mezcla datos embebidos en el frontend con caches de Supabase. El reparto actual es este:

- `Resumen`, `Ranking`, `Historial`, `Comparador`, `Partidos`, `Equipos`, `Detalle de jugador` y `Cruces` leen de `worldcup_results_cache` para los resultados del Mundial.
- `Estadísticas` lee de `as_rankings_cache`.
- La tarjeta de directo de AS en portada lee de `as_live_match_cache`.
- La `mini-porra` lee y guarda en `mini_results`.
- El panel `Administrar` (admin) y la pestaña `Editar mi porra` (cada jugador sobre la suya) leen y guardan en `prediction_overrides`.
- La base de la porra sigue viniendo de `window.PORRA_DATA` dentro del bundle, con Supabase encima como cache y capa de overrides.

## Qué sigue siendo local

Aunque la app ya usa Supabase como capa principal de datos vivos, todavía hay piezas locales:

- `window.PORRA_DATA` contiene la porra base generada desde el Excel.
- `localStorage` guarda preferencias, sesión auxiliar, avisos y cache temporal del navegador.
- Los JSON `data/as-player-rankings.json` y `data/as-team-rankings.json` siguen como fallback si falla el cache de estadísticas.

## Cómo está montado el refresco

### 1. Clasificación principal y partidos

La parte más importante de la app depende de:

- Edge Function: `sync-worldcup-results`
- Tabla: `worldcup_results_cache`
- Fuente externa: OpenFootball

Flujo:

1. El cron de Supabase llama a `sync-worldcup-results`.
2. La función mira primero `worldcup_results_cache`.
3. Si el cache sigue siendo válido, no vuelve a pedir OpenFootball.
4. Si el cache ya está viejo, descarga el JSON de OpenFootball y actualiza la tabla.
5. El frontend lee esa tabla y pinta clasificación, partidos, cruces, comparador, probabilidades y demás vistas que dependen de resultados.

### 2. Estadísticas

La sección `Estadísticas` depende de:

- Edge Function: `sync-as-rankings`
- Tabla: `as_rankings_cache`

Flujo:

1. El cron llama a `sync-as-rankings`.
2. La función actualiza el cache en Supabase.
3. El frontend lee `as_rankings_cache`.
4. Si algo falla, cae al JSON local incluido en el repo.

### 3. Mini-porra

La mini-porra no depende de cron. Sus datos se guardan directamente en:

- `mini_results`

Cuando un admin cambia un valor:

1. se guarda en Supabase
2. se actualiza la interfaz
3. se muestra confirmación visual

### 4. Tarjeta de directo de AS

La tarjeta del partido en directo se alimenta desde:

- Edge Function: `sync-as-live-match`
- Tabla: `as_live_match_cache`

Flujo:

1. El cron llama a `sync-as-live-match`.
2. La función lee la portada y la página del directo de AS.
3. Guarda el partido actual en `as_live_match_cache`.
4. El frontend lee esa tabla y pinta el bloque de directo.

La tarjeta solo intenta refrescar con frecuencia alta cuando hay un directo visible; si no, el intervalo baja para evitar peticiones innecesarias.

### 5. Correcciones manuales del admin

Las correcciones del admin se guardan en:

- `prediction_overrides`

Eso permite corregir sin tocar la porra base:

- resultados de fase de grupos
- respuestas de mini-porra
- selecciones de cruces

La app aplica esas correcciones encima de `window.PORRA_DATA` en tiempo de ejecución, así que una corrección afecta a toda la interfaz sin reescribir el dataset base.

## Tiempos de refresco y por qué están así

### Resultados del Mundial

Aquí hay dos ritmos distintos dentro de `sync-worldcup-results`:

- refresco normal: cada 15 minutos
- refresco intensivo: cada 2 minutos

La función decide cuál aplicar según la cercanía de los partidos, usando siempre la referencia horaria del propio partido y mostrando la hora en `Europe/Madrid`.

Ventana intensiva actual:

- empieza 2 horas antes del inicio del partido
- se mantiene hasta 2 horas después del inicio

Eso significa que, si hay un partido cercano o en juego, el cache se considera “viejo” mucho antes y se permite refrescar cada 2 minutos. Si no hay partidos cerca, el cache aguanta 15 minutos.

Objetivo:

- no castigar APIs ni Supabase durante horas muertas
- dar sensación de casi tiempo real cuando de verdad importa

### Cron de resultados

El cron actual dispara `sync-worldcup-results` cada 2 minutos.

Esto no significa que siempre vaya a consultar OpenFootball cada 2 minutos. La función lleva la lógica buena dentro:

- si el cache sigue siendo válido, responde `skipped: true`
- si toca refrescar, descarga y actualiza

Ese enfoque es mejor que poner un cron distinto para cada caso, porque:

- la inteligencia queda centralizada en una única función
- es más fácil cambiar ventanas e intervalos
- evita coordinar varios jobs

### Cron de estadísticas

El cron actual de `sync-as-rankings` va cada 5 horas.

Tiene sentido porque estas estadísticas no necesitan inmediatez y así se ahorran peticiones.

## Comportamiento del frontend

La web hace varias cosas para que los datos no se queden viejos en el navegador:

- al arrancar intenta cargar el cache de Supabase
- luego fuerza una sincronización silenciosa
- vuelve a refrescar cada 15 minutos
- intenta refrescar al volver a tener conexión
- intenta refrescar al volver a una pestaña restaurada o visible

Además, comprueba `version.json` cada 5 minutos para detectar si hay una build nueva publicada.

## PWA, caché del navegador y Safari

La PWA está desactivada a propósito:

- `PWA_ENABLED = false`
- el arranque limpia service workers anteriores y caches antiguas de la app

Esto se dejó así porque estaba generando comportamiento inconsistente de caché, sobre todo en iPhone/Safari. La prioridad ahora es fiabilidad de datos antes que instalación offline.

En resumen:

- no dependemos del service worker para los datos
- los datos vivos vienen de Supabase
- el navegador solo conserva estado local auxiliar, no la fuente de verdad de resultados

## Login y roles

El login es único: en la portada hay un formulario de email + contraseña visible para cualquiera, sin necesidad de parámetros en la URL. Todo el mundo (admin y jugadores) entra por ahí con Supabase Auth. El rol se decide solo según la cuenta:

- **Jugador**: su cuenta tiene `player_id` en `user_metadata`. Al entrar va a la pestaña «✏️ Editar mi porra», donde corrige su fase de grupos, cruces y mini-porra.
- **Administrador**: su cuenta NO tiene `player_id`. Al entrar va al panel «Administrar» y el menú se simplifica a Clasificación, Mini-porra, Administrar y Datos/API.

Esa distinción está en `src/app.js`: `isAdmin()` = autenticado sin `player_id`; `isPlayerSession()` = autenticado con `player_id`.

### Edición de la porra por el jugador

Cada jugador solo puede editar su propia porra. El guardado pasa por funciones `SECURITY DEFINER` (`set_my_override` / `clear_my_override`) que toman el `player_id` del propio token (`auth.jwt()`), nunca de un parámetro, así nadie puede tocar la porra de otro. La edición está abierta mientras `now()` sea anterior a `player_edit_deadline` (en `app_config`); pasada esa fecha los campos se deshabilitan y el servidor rechaza escrituras.

Detalle completo de la migración del PIN a Supabase Auth en [docs/login-y-roles.md](./docs/login-y-roles.md).

### Configuración de Supabase

1. Abre el SQL Editor de Supabase y ejecuta `supabase/setup.sql`.
2. Ejecuta también `supabase/player-self-edit.sql` (tablas `player_access`/`app_config` y helper de deadline), `supabase/set-edit-deadline.sql` (fija la fecha límite real) y `supabase/player-auth-login.sql` (RPCs de edición por jugador autenticado).
3. En Authentication, desactiva el registro público de nuevos usuarios (registro limitado: las altas las hace el admin).
4. Crea el usuario administrador en Authentication > Users (email y contraseña, sin `player_id`).
5. Crea las cuentas de los jugadores con `supabase/create-player-users.mjs` (ver «Cuentas de jugadores»).

La clave `sb_publishable_...` es pública y puede incluirse en el frontend. La seguridad depende de Supabase Auth y de las políticas RLS, no de ocultar esta clave.

### Cuentas de jugadores

`supabase/create-player-users.mjs` crea una cuenta de Supabase Auth por jugador (email `<id>@porrazo.local`, contraseña aleatoria, `player_id` en `user_metadata`). Es idempotente: salta las que ya existan, así no toca al admin. Uso:

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key (secreta, panel API)>"
node supabase/create-player-users.mjs
```

Las credenciales generadas quedan en `supabase/player-auth-credentials.txt` (ignorado por git). La `service_role` key no debe ir nunca al frontend ni al repo.

## Copias de seguridad

`supabase/backup.sh` hace un backup completo (base de datos + código). Crea `supabase/backup/<fecha>/` con:

- `schema.sql`, `data.sql`, `roles.sql`: estructura, datos y permisos de la BD.
- `auth.sql`: usuarios de Supabase Auth.
- `functions/`: las Edge Functions.
- `code.zip`: copia íntegra del proyecto.
- `ENV-VARIABLES.md` + `secrets-names.txt`: qué variables/secrets necesita el proyecto (nombres, sin valores).

```bash
bash supabase/backup.sh
```

Pide la contraseña de la base de datos. La carpeta `supabase/backup/` está en `.gitignore`: contiene datos sensibles (contraseñas hasheadas, datos de usuarios) y no se sube al repo. Los valores de los secrets no son exportables; las variables necesarias están documentadas en [supabase/ENV-VARIABLES.md](./supabase/ENV-VARIABLES.md).

### Actualización automática de estadísticas

La sección `Estadísticas` lee desde la tabla `as_rankings_cache` y, si no hay cache disponible, cae al JSON local.

Este es el flujo que he usado para dejarlo automático en Supabase:

1. Abrir el proyecto en Supabase y ejecutar `supabase/setup.sql`.
   - Crea `mini_results`.
   - Crea `as_rankings_cache`.
   - Activa las políticas para que el frontend pueda leer el cache.
2. Desplegar la Edge Function `sync-as-rankings`.
   - Archivo: `supabase/functions/sync-as-rankings/index.ts`.
   - Comando típico:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase functions deploy sync-as-rankings
   ```

3. Desactivar la verificación JWT para esa función.
   - Archivo: `supabase/config.toml`.
   - Debe incluir:

   ```toml
   [functions.sync-as-rankings]
   verify_jwt = false
   ```

   - Esto evita el `401` cuando la llama `pg_cron` con `apikey`.
4. Activar `pg_cron` y `pg_net`.
   - En Supabase, ve a `Integrations -> Cron`.
   - Activa `pg_cron`.
   - Si hace falta, activa `pg_net` en `Database -> Extensions`.
   - Si `cron.schedule(...)` falla con `schema "cron" does not exist`, `pg_cron` aún no está activo.
5. Crear el cron cada 5 horas.
   - Schedule: `0 */5 * * *`
   - URL correcta:

   ```text
   https://<project-ref>.supabase.co/functions/v1/sync-as-rankings
   ```

   - Si no usas Vault, puedes pasar la `publishable_key` en el header `apikey`.
   - Ejemplo:

   ```sql
   select cron.schedule(
     'sync-as-rankings-every-5h',
     '0 */5 * * *',
     $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/sync-as-rankings',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'apikey', '<publishable_key>'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

6. Verificar que ya está funcionando.
   - En `Table Editor`, abre `as_rankings_cache`.
   - Debes ver dos filas:
     - `players`
     - `teams`
   - También puedes comprobar:

   ```sql
   select kind, updated_at
   from as_rankings_cache
   order by kind;
   ```

7. La web usa el cache de Supabase y cae al JSON local si falla.
   - Eso permite que GitHub Pages siga funcionando aunque el cron falle un día.

## Cache de resultados del Mundial en Supabase

La clasificación, los partidos y el resto de secciones que dependen de resultados leen desde Supabase en vez de lanzar consultas directas a OpenFootball desde cada dispositivo.

Pasos:

1. Ejecuta `supabase/setup.sql`.
   - Añade la tabla `worldcup_results_cache`.
   - Deja lectura pública para el frontend.

2. Despliega la Edge Function:

   ```bash
   npx supabase functions deploy sync-worldcup-results
   ```

3. Verifica que `supabase/config.toml` incluye:

   ```toml
   [functions.sync-worldcup-results]
   verify_jwt = false
   ```

4. Crea el cron apuntando a:

   ```text
   https://<project-ref>.supabase.co/functions/v1/sync-worldcup-results
   ```

5. El cron recomendado es cada 2 minutos:

   ```text
   */2 * * * *
   ```

6. La propia función decide si realmente debe ir a OpenFootball:
   - si no hay partidos cerca, reutiliza cache hasta 15 minutos
   - si hay partido en ventana activa, permite refresco cada 2 minutos

7. La web intenta:
   - leer `worldcup_results_cache`
   - pedir sincronización silenciosa a `sync-worldcup-results`
   - y solo si falla, usar fallback al JSON directo de OpenFootball

### Importante sobre los tiempos

No hay que confundir estas dos capas:

- frecuencia del cron: cada 2 minutos
- antigüedad máxima aceptada del cache: 15 minutos o 2 minutos según contexto de partido

El cron despierta a la función a menudo, pero la función no castiga la fuente externa si no hace falta.

La guía reusable completa está en [docs/supabase-statistics-refresh.md](./docs/supabase-statistics-refresh.md), por si quieres copiar el mismo flujo a otro proyecto sin perder detalles.

## Deployment rápido

### Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. Importa el repo en Vercel.
3. Framework: `Other` / proyecto estático.
4. Build command: vacío.
5. Output directory: `.`.

### Netlify

1. Arrastra esta carpeta comprimida al panel de Netlify Drop.
2. No necesita build.

### GitHub Pages

Cada cambio enviado a `main` despliega automáticamente la web en:

```text
https://r03ert.github.io/porra-mundial-web/
```

## Plataforma multi-porra

Sistema nuevo (en construcción) para que el admin pueda crear porras de futuros eventos (Mundial, Eurocopa, Nations League…) sin tocar la porra actual del Mundial 2026.

- **Fase 0 (hecha)**: modelo de datos en Supabase. Tablas `porra_*` (porras, equipos, grupos, partidos, jugadores, predicciones, mini-porra y cruces) más `platform_admins`, todas con `porra_id` y aisladas del legacy. Esquema base en `supabase/platform-schema.sql` (migración `20260623000000`).
- **Fase 1 (en marcha)**: dashboard en `admin-next/` con login admin, crear/listar porras, detalle por porra, gestión de grupos/equipos/partidos, invitación y borrado de jugadores, carga manual de resultados y avance de estado `draft → open → playing → closed`.
- **Migración de soporte actual**: `supabase/migrations/20260623013000_admin_next_phase1.sql` añade la RPC `pp_add_player_by_email(...)`, columnas de resultados/estado para partidos y normaliza `playing` como estado de la porra.

Planteamiento completo y fases en [docs/plataforma-multi-porra.md](./docs/plataforma-multi-porra.md).

## Reglas implementadas

- Marcador exacto en fase de grupos: 3 puntos.
- Quiniela acertada: 2 puntos.
- Sin resultado: 0 puntos.
- La mini-porra mantiene clasificación y resultados propios, separados de la porra principal.

Pendiente de ampliar si quieres:

- puntuación automática de cruces,
- login/admin real,
- emails por jornada,
- backend/proxy para APIs con token privado.
