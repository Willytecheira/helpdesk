#!/bin/sh
set -e

echo "▶ Aplicando migraciones Prisma..."
node node_modules/prisma/build/index.js migrate deploy || {
  echo "❌ migrate deploy falló"
  exit 1
}

echo "▶ Arrancando Next.js"
exec "$@"
