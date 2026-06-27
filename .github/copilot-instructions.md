# Copilot Instructions — Porrazo 2026

> Este fichero es leído automáticamente por GitHub Copilot.
> La fuente canónica es `AGENTS.md`. Ambos se mantienen sincronizados.

## Reglas esenciales

1. **No hacer commit, push, ni `supabase db push`** hasta que el usuario lo pida. Cuando se confirme, a `main` directamente.
2. **No tocar la app legacy** (`src/app.js`, `index.html`, tablas sin prefijo `porra_`) salvo bug explícito.
3. **Tras cualquier cambio funcional**, actualizar `AGENTS.md`, `CLAUDE.md`, `README.md` y docs relevantes.
4. **Vanilla JS sin framework ni TypeScript**. Patrón: `state` plano → `render()` → event delegation en `document`.
5. **Escapar siempre con `esc()`** antes de `innerHTML`.
6. **Después de un cambio, `render()`** para refrescar la UI.

## Estructura

- `/` — App legacy (NO TOCAR)
- `admin-next/` — Dashboard de administración (trabajo activo)
- `public-next/` — Vista pública `/p/<slug>` (trabajo activo)
- `supabase/` — Migraciones, Edge Functions, SQL

## Stack

Vite + JS vanilla + Supabase (Auth, RLS, Edge Functions Deno)

Para contexto completo, leer `AGENTS.md`.
