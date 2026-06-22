#!/usr/bin/env bash
#
# Backup completo del proyecto Porrazo 2026: base de datos Supabase + código.
#
# Qué guarda (en supabase/backup/<fecha>/):
#   - schema.sql   -> estructura: tablas, RLS, funciones, triggers
#   - data.sql     -> datos de TODAS las tablas (mini_results, prediction_overrides,
#                     player_access [PINs en claro], app_config, caches...)
#   - roles.sql    -> roles/permisos
#   - auth.sql     -> usuarios de Supabase Auth (schema auth)
#   - functions/   -> copia de las Edge Functions (ya están en git, se copian por comodidad)
#   - code.zip     -> snapshot del código tracked en git
#
# Requisitos:
#   - Supabase CLI (ya instalado) y el proyecto enlazado (ya lo está).
#   - El CLI pedirá la contraseña de la base de datos la primera vez.
#
# Uso:
#   bash supabase/backup.sh
#
# IMPORTANTE: la carpeta supabase/backup/ está en .gitignore. NO la subas al repo:
# contiene los PINs en claro y datos de usuarios.

set -euo pipefail

# Raíz del proyecto = carpeta padre de este script.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="supabase/backup/$STAMP"
mkdir -p "$OUT/functions"

echo "==> Backup en: $OUT"

echo "==> 1/6 Schema (estructura)..."
npx supabase db dump -f "$OUT/schema.sql"

echo "==> 2/6 Datos (todas las tablas)..."
npx supabase db dump --data-only -f "$OUT/data.sql"

echo "==> 3/6 Roles y permisos..."
npx supabase db dump --role-only -f "$OUT/roles.sql" || echo "   (roles: omitido si no aplica)"

echo "==> 4/6 Usuarios de Auth (schema auth)..."
# El schema auth no se incluye por defecto; lo pedimos explícitamente.
npx supabase db dump --data-only --schema auth -f "$OUT/auth.sql" \
  || echo "   (auth: si falla, expórtalo desde el panel Authentication > Users)"

echo "==> 5/6 Edge Functions (copia local)..."
cp -R supabase/functions/. "$OUT/functions/" 2>/dev/null || true

echo "==> 6/6 Código (snapshot de git)..."
git archive --format=zip -o "$OUT/code.zip" HEAD

cat > "$OUT/README.txt" <<EOF
Backup Porrazo 2026 — $STAMP

Contenido:
  schema.sql    estructura de la base de datos
  data.sql      datos de todas las tablas (incluye PINs en claro)
  roles.sql     roles/permisos
  auth.sql      usuarios de Supabase Auth
  functions/    Edge Functions
  code.zip      código del proyecto (rama main)

NO incluido automáticamente:
  - Archivos de Supabase Storage (si usas buckets, descárgalos desde el panel
    Storage o con: npx supabase storage cp -r ss:///<bucket> ./storage-backup).

Restaurar la base de datos en un proyecto nuevo:
  1. npx supabase link --project-ref <nuevo-ref>
  2. psql "<connection-string>" -f schema.sql
  3. psql "<connection-string>" -f data.sql
  (o pega cada .sql en el SQL Editor de Supabase)

Mantén esta carpeta PRIVADA: contiene secretos.
EOF

echo "==> Listo. Backup completo en: $OUT"
ls -la "$OUT"
