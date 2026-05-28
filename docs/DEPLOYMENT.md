# Despliegue en producción

Guía paso a paso para correr Helpdesk en un VPS con HTTPS automático, backups y reverse proxy.

## Pre-requisitos

- VPS Linux con Docker y Docker Compose v2
- Dominio apuntando al VPS (registro A o AAAA)
- Puertos 80 y 443 abiertos al público

## Setup inicial

```bash
# 1. Clonar el repo en el VPS
git clone <repo> /opt/helpdesk
cd /opt/helpdesk

# 2. Configurar .env.production
cp .env.production.example .env.production
nano .env.production
# - POSTGRES_PASSWORD: generá una fuerte
# - AUTH_SECRET: openssl rand -base64 32
# - AUTH_URL: https://helpdesk.tudominio.com
# - APP_DOMAIN: helpdesk.tudominio.com
# - CADDY_EMAIL: tu email para Let's Encrypt

# 3. Build y arrancar
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# 4. Ver logs (Caddy tarda ~30s en obtener el certificado)
docker compose -f docker-compose.prod.yml logs -f caddy app
```

La primera vez Caddy negocia el certificado TLS con Let's Encrypt automáticamente. A los pocos minutos `https://tu-dominio` debería responder.

## Crear el primer admin

El seed de desarrollo crea cuentas demo. En producción tenés dos opciones:

**Opción A — Correr el seed (incluye cuentas demo):**

```bash
docker compose -f docker-compose.prod.yml exec app sh -c "node prisma/seed.js"
```

**Opción B — Crear el admin a mano:**

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U helpdesk -d helpdesk
```

```sql
INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@tuempresa.com',
  'Admin',
  '$2b$10$...', -- hash de bcrypt; genera uno con `npx -y bcryptjs-cli hash 'TuPassword'`
  'ADMIN',
  NOW(), NOW()
);
```

Después configurás todo desde la UI: clientes, productos, integraciones de IA, etc.

## Configurar IA y emails

Login como admin → **Sistema → Integraciones**. Pegá las API keys de:

- **Anthropic** (`sk-ant-...`) — habilita el chat IA
- **OpenAI** (`sk-...`) — habilita RAG sobre KB y tickets
- **Resend** (`re_...`) — habilita notificaciones por email

Click "Probar" en cada una para validar que funcionan.

## Operación diaria

### Ver logs

```bash
# Todo
docker compose -f docker-compose.prod.yml logs -f

# Sólo la app (JSON estructurado)
docker compose -f docker-compose.prod.yml logs -f app

# Sólo backups
docker compose -f docker-compose.prod.yml logs -f backup
```

### Health check

```bash
curl https://helpdesk.tudominio.com/api/health
# {"status":"ok","timestamp":"...","checks":{"database":{"ok":true}}}
```

### Restart después de actualizar el código

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

El entrypoint corre `prisma migrate deploy` automáticamente, así que las migraciones nuevas se aplican sin intervención manual.

## Backups

Los backups corren automáticamente todos los días a las 03:00 UTC (configurable en el `crontab` dentro del compose).

- DB → `backups_data:/backups/db/helpdesk-{TIMESTAMP}.dump.gz`
- Uploads → `backups_data:/backups/uploads/uploads-{TIMESTAMP}.tar.gz`
- Retención: 14 días por defecto (`BACKUP_RETENTION_DAYS` en `.env.production`)

### Forzar backup manual

```bash
docker compose -f docker-compose.prod.yml exec backup sh /usr/local/bin/backup.sh
```

### Copiar backups al host

```bash
docker run --rm -v helpdesk_backups_data:/backups -v $(pwd):/dest alpine \
  sh -c "cp -r /backups /dest/backups-$(date +%F)"
```

### Restaurar DB de un dump

```bash
gunzip -c backup.dump.gz | docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore --clean --if-exists -U helpdesk -d helpdesk
```

### Sincronizar backups a S3 / B2 / off-site

Recomendado: añadir un cron en el host que copia `backups_data` a almacenamiento externo. Ejemplo con `rclone`:

```cron
30 3 * * * /usr/bin/rclone copy /var/lib/docker/volumes/helpdesk_backups_data/_data s3:tu-bucket/helpdesk/
```

## Rate limiting

| Endpoint | Límite |
|---|---|
| Login | 5 intentos / minuto por IP · 10 / hora por email |
| `/api/agent/heartbeat` | 60 / minuto por IP |
| `/api/ai/chat` | 30 / minuto por usuario |

El store es **en memoria** (no Redis). Funciona bien para una instancia. Si escalás a múltiples replicas, reemplazar `src/lib/rate-limit.ts` por un store compartido.

## Audit log

Las acciones críticas (crear/borrar tickets, cambiar estados, login fallido, modificar integraciones) se registran en la tabla `ActivityLog`. Consultable vía SQL hasta que F4 agregue la vista `/settings/audit`.

```sql
SELECT * FROM "ActivityLog" ORDER BY "createdAt" DESC LIMIT 50;
```

## Troubleshooting

### Caddy no consigue certificado

- Verificá que tu dominio resuelve al IP del VPS: `dig +short helpdesk.tudominio.com`
- Que los puertos 80/443 estén abiertos en el firewall
- `docker compose -f docker-compose.prod.yml logs caddy`

### Login redirige a `/login` en loop

Suele ser por `AUTH_URL` mal configurada (debe matchear el dominio público) o `AUTH_TRUST_HOST` ausente.

### IA no responde

Login como admin → `/settings/integrations` → click **Probar** en Anthropic. El error de respuesta da el detalle (key inválida, modelo no existe, rate limit, etc.).

### "Failed to apply migration"

Si una migración falla al arrancar (entrypoint), entrá al contenedor y aplicá manual:

```bash
docker compose -f docker-compose.prod.yml exec app sh
node node_modules/prisma/build/index.js migrate status
node node_modules/prisma/build/index.js migrate deploy
```
