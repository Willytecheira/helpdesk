# Deploy en VPS con Nginx existente

Esta guía despliega el Helpdesk **conviviendo** con otros servicios que ya
corren en tu VPS, sin tocar tu Nginx ni los puertos 80/443.

## Cómo convive (sin conflictos)

- El helpdesk **NO** levanta su propio reverse proxy.
- Se publica sólo en `127.0.0.1:3200` (puerto loopback libre).
- Tu Nginx del host proxea `helpdesk.tudominio.com` → `127.0.0.1:3200`.
- Su Postgres (`helpdesk_postgres`, con pgvector) corre en una red Docker
  aislada, sin publicar puertos al host. No choca con `automotive-postgres`
  ni `quantum-postgres`.
- Contenedores: `helpdesk_app`, `helpdesk_postgres`, `helpdesk_scheduler`,
  `helpdesk_backup`. Nombres únicos, sin colisión.

## 1. DNS

Creá un registro **A** apuntando al IP de tu VPS:

```
helpdesk.tudominio.com  →  <IP_DEL_VPS>
```

## 2. Clonar y configurar

```bash
git clone https://github.com/Willytecheira/helpdesk.git
cd helpdesk
cp .env.vps.example .env.vps
```

Editá `.env.vps`:

```bash
POSTGRES_PASSWORD=<password fuerte>
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_URL=https://helpdesk.tudominio.com
APP_PORT=3200            # cambialo sólo si 3200 ya está ocupado
CRON_SECRET=$(openssl rand -base64 24)
```

Tip para generar secrets directo:

```bash
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.vps
echo "CRON_SECRET=$(openssl rand -base64 24)" >> .env.vps
```

## 3. Levantar los contenedores

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
```

El entrypoint corre `prisma migrate deploy` automáticamente. Verificá:

```bash
docker compose -f docker-compose.vps.yml logs -f app
curl -s http://127.0.0.1:3200/api/health   # debe devolver {"status":"ok",...}
```

## 4. Crear el primer admin (endpoint de setup)

Poné un `SETUP_TOKEN` temporal en `.env.vps` (cualquier string secreto). Después:

```bash
# ¿Necesita setup?
curl -s http://127.0.0.1:3200/api/setup            # {"needsSetup":true}

# Crear el primer admin
curl -s -X POST http://127.0.0.1:3200/api/setup \
  -H "Authorization: Bearer EL-MISMO-SETUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@email.com","password":"tu-password-seguro","name":"Tu Nombre"}'
# → {"ok":true,"email":"tu@email.com"}
```

El endpoint **se autodeshabilita** apenas existe el primer usuario (devuelve 410).
Por seguridad, después borrá `SETUP_TOKEN` de `.env.vps` y reiniciá:
`docker compose --env-file .env.vps -f docker-compose.vps.yml up -d`.

## 5. Configurar Nginx

```bash
sudo cp docker/nginx-helpdesk.conf /etc/nginx/sites-available/helpdesk
sudo nano /etc/nginx/sites-available/helpdesk     # poné tu server_name
sudo ln -s /etc/nginx/sites-available/helpdesk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. HTTPS con Certbot

```bash
sudo certbot --nginx -d helpdesk.tudominio.com
```

Certbot agrega el bloque `listen 443 ssl` y renueva el certificado solo.

## 7. Activar las integraciones de IA/email

Entrá a `https://helpdesk.tudominio.com`, login con tu admin, y andá a
**Sistema → Integraciones**. Pegá las API keys de Anthropic / OpenAI / Resend
y probá la conexión. (No hace falta reiniciar nada.)

## Operación

```bash
# Logs
docker compose -f docker-compose.vps.yml logs -f app

# Actualizar a una versión nueva
git pull
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build

# Backups (corren solos a las 03:00). Ver/forzar:
docker compose -f docker-compose.vps.yml exec backup sh /usr/local/bin/backup.sh
docker compose -f docker-compose.vps.yml exec backup ls -lh /backups/db

# Reindexar RAG (si configuraste OpenAI después de cargar datos)
# (requiere tsx; correr desde local con túnel, o agregar a la imagen)
```

## Recursos

Vas a sumar ~4 contenedores (app + postgres + scheduler + backup). El Postgres
con pgvector consume algo más de RAM que uno común. Si el VPS va justo de
memoria, monitoreá con `docker stats`.
