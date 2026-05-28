#!/bin/sh
# Backup diario de Postgres + uploads. Rota archivos viejos.
#
# Variables:
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE
#   BACKUP_RETENTION_DAYS (default 14)

set -e

RETENTION="${BACKUP_RETENTION_DAYS:-14}"
TS=$(date +%Y%m%d-%H%M%S)
DEST=/backups

mkdir -p "$DEST/db" "$DEST/uploads"

echo "[$(date -u +%FT%TZ)] Backup start"

# 1. Postgres dump (custom format + gzip)
DB_FILE="$DEST/db/helpdesk-${TS}.dump.gz"
pg_dump --format=custom --no-owner --no-privileges "$PGDATABASE" | gzip > "$DB_FILE"
echo "  ✓ DB dump → $(du -h "$DB_FILE" | cut -f1) $DB_FILE"

# 2. Uploads tar.gz
if [ -d /app/uploads ]; then
  UP_FILE="$DEST/uploads/uploads-${TS}.tar.gz"
  tar -C /app -czf "$UP_FILE" uploads 2>/dev/null || true
  if [ -f "$UP_FILE" ]; then
    echo "  ✓ Uploads → $(du -h "$UP_FILE" | cut -f1) $UP_FILE"
  fi
fi

# 3. Rotación: borrar archivos más viejos que N días
find "$DEST/db" -name "*.dump.gz" -type f -mtime +"$RETENTION" -delete
find "$DEST/uploads" -name "*.tar.gz" -type f -mtime +"$RETENTION" -delete
echo "  ✓ Rotación: archivos >${RETENTION} días borrados"

echo "[$(date -u +%FT%TZ)] Backup done"
