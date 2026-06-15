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

## Modo administrador

Añade `?admin=1` a la URL para mostrar el acceso de administrador. Tras iniciar sesión con Supabase Auth se pueden editar los resultados de la mini-porra, acceder a Datos/API e importar o exportar el estado.

### Configuración de Supabase

1. Abre el SQL Editor de Supabase y ejecuta `supabase/setup.sql`.
2. En Authentication, desactiva el registro público de nuevos usuarios.
3. En Authentication > Users, crea manualmente el usuario administrador con email y contraseña.

La clave `sb_publishable_...` es pública y puede incluirse en el frontend. La seguridad depende de Supabase Auth y de las políticas RLS, no de ocultar esta clave.

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
