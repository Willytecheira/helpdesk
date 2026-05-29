#!/bin/sh
set -e

# NOTA: ya no se usa (el Dockerfile arranca server.js directo). Las migraciones
# corren en el servicio "migrate" del compose. Se conserva por compatibilidad.
echo "▶ Arrancando Next.js"
exec "$@"
