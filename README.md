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

## Resultados

Los resultados se obtienen automáticamente desde la API configurada al abrir la aplicación y cada 60 minutos. No se pueden editar manualmente desde la aplicación.

## PWA

La aplicación se puede instalar desde el navegador en móvil y escritorio. La interfaz principal queda disponible sin conexión; los resultados y los datos de Supabase requieren conexión para actualizarse.

## Modo administrador

Añade `?admin=1` a la URL para mostrar el acceso de administrador. Tras iniciar sesión con Supabase Auth se pueden editar los resultados de la mini-porra, acceder a Datos/API e importar o exportar el estado.

### Configuración de Supabase

1. Abre el SQL Editor de Supabase y ejecuta `supabase/setup.sql`.
2. En Authentication, desactiva el registro público de nuevos usuarios.
3. En Authentication > Users, crea manualmente el usuario administrador con email y contraseña.

La clave `sb_publishable_...` es pública y puede incluirse en el frontend. La seguridad depende de Supabase Auth y de las políticas RLS, no de ocultar esta clave.

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
