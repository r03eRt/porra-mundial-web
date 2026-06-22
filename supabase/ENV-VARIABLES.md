# Variables de entorno / secrets del proyecto

Referencia de las variables que necesitan las Edge Functions para funcionar.
NO contiene valores secretos (no se pueden exportar desde Supabase). Sirve para
saber qué hay que configurar si recreas o restauras el proyecto.

Para ver qué secrets hay configurados (nombres + hash, sin valores):

```bash
npx supabase secrets list
```

Para fijar un secret nuevo:

```bash
npx supabase secrets set NOMBRE=valor
```

## Las inyecta Supabase automáticamente (NO configurar a mano)

Disponibles dentro de cualquier Edge Function sin hacer nada:

- `SUPABASE_URL` — URL del proyecto.
- `SUPABASE_ANON_KEY` — clave anónima (pública).
- `SUPABASE_SERVICE_ROLE_KEY` — clave de servicio (admin). La usan todas las
  funciones de sync para escribir en las tablas cache saltándose el RLS.
- `SUPABASE_DB_URL` — cadena de conexión a la base de datos.

Si rotas las API keys legacy, comprueba que estas siguen resolviéndose en las
funciones (normalmente Supabase las mantiene actualizadas solo).

## Las configuras TÚ (secrets propios)

- `FOOTBALL_DATA_TOKEN` — token de football-data.org. Lo usa la Edge Function
  `sync-football-live`. Sin él, esa función no puede pedir datos a la API.
  Configúralo con:

  ```bash
  npx supabase secrets set FOOTBALL_DATA_TOKEN=tu_token
  ```

  El valor real lo tienes en tu cuenta de football-data.org. Guárdalo en un
  gestor de contraseñas; no se puede leer desde Supabase una vez fijado.

## Claves del frontend (en el código, no son secrets)

- `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` están en `src/app.js`. La
  publishable key es pública por diseño (la seguridad depende del RLS), así que
  puede ir en el bundle del frontend.
