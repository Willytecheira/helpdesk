# WhatsApp con Evolution API

El helpdesk recibe tickets por WhatsApp y deja que tu agente IA los atienda, usando
[Evolution API](https://github.com/EvolutionAPI/evolution-api) como puente con WhatsApp.

Evolution API es un **servicio aparte**. Este directorio trae todo para levantarlo en tu
VPS coexistiendo con el resto de tus servicios.

## 1. Levantar Evolution API en el VPS

```bash
cd helpdesk/docker/evolution
cp .env.evolution.example .env
# editá .env: poné una EVOLUTION_API_KEY fuerte  ->  openssl rand -hex 32
docker compose -f docker-compose.evolution.yml up -d
```

Esto crea `evolution-api` (puerto 127.0.0.1:8080) + su Postgres + Redis dedicados.

## 2. Exponerlo con un subdominio (HTTPS)

```bash
sudo cp nginx-evolution.conf /etc/nginx/sites-available/evolution
sudo ln -s /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d evolution.linetechinformatica.com
```

(Apuntá antes el DNS `evolution.linetechinformatica.com` a la IP del VPS.)

## 3. Conectar desde el helpdesk

En el panel → **Configuración → WhatsApp**:

1. **URL**: `https://evolution.linetechinformatica.com`
2. **API key**: el valor de `EVOLUTION_API_KEY`
3. **Instancia**: `helpdesk` (o el nombre que prefieras)
4. Elegí el **agente** que responde y el **cliente por defecto**
5. Activá la **respuesta automática** si querés que el agente conteste solo
6. **Guardar** → **Conectar / ver QR** → escaneá con WhatsApp (Dispositivos vinculados)
7. **Registrar webhook en Evolution** (un clic)

Listo. Los mensajes entrantes crean o actualizan tickets (canal WhatsApp) y, si activaste la
respuesta automática, el agente IA contesta por WhatsApp. Cuando un humano responde el ticket
desde el panel, también le llega al cliente por WhatsApp.

## Cómo se mapean los números a clientes

1. Si el número coincide con el teléfono de un **contacto** → ese cliente.
2. Si coincide con el teléfono de un **cliente** → ese cliente.
3. Si no coincide → el **cliente por defecto** configurado (si no hay, se ignora y se loguea).

> Tip: cargá el teléfono en la ficha del cliente/contacto (con código de país) para que los
> tickets caigan en el cliente correcto automáticamente.
