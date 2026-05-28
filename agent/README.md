# Helpdesk Agent

Agente ligero que reporta el estado de un servidor + sus contenedores Docker al backend.

## Instalación

En el servidor a monitorear:

```bash
sudo mkdir -p /opt/helpdesk-agent
sudo curl -fsSL https://TU-HELPDESK/agent/heartbeat.sh -o /opt/helpdesk-agent/heartbeat.sh
sudo chmod +x /opt/helpdesk-agent/heartbeat.sh

# o subiendo el archivo manualmente
```

Dependencias: `bash`, `curl`, `jq`, opcionalmente `docker`.

```bash
apt-get install -y curl jq
```

## Configuración

Obtené el token del servidor desde Helpdesk → Infraestructura → servidor → tab "Agente".

Crear `/etc/helpdesk-agent.env`:

```bash
HELPDESK_URL=https://helpdesk.tudominio.com
AGENT_TOKEN=hex_token_de_24_bytes
```

## Ejecución

### Cron (cada minuto)

```cron
* * * * * . /etc/helpdesk-agent.env && /opt/helpdesk-agent/heartbeat.sh >>/var/log/helpdesk-agent.log 2>&1
```

### systemd timer

`/etc/systemd/system/helpdesk-agent.service`:

```ini
[Unit]
Description=Helpdesk agent heartbeat
After=docker.service

[Service]
Type=oneshot
EnvironmentFile=/etc/helpdesk-agent.env
ExecStart=/opt/helpdesk-agent/heartbeat.sh
```

`/etc/systemd/system/helpdesk-agent.timer`:

```ini
[Unit]
Description=Run helpdesk-agent every minute

[Timer]
OnBootSec=30s
OnUnitActiveSec=60s
Unit=helpdesk-agent.service

[Install]
WantedBy=timers.target
```

```bash
systemctl daemon-reload
systemctl enable --now helpdesk-agent.timer
```

## Datos que reporta

- Métricas del host: CPU%, RAM%, disco% (root), load avg (1/5/15m), uptime
- Hostname, sistema operativo
- Versión de Docker
- Por cada contenedor: nombre, imagen, tag, estado, CPU%, RAM en MB

## Endpoint

`POST {HELPDESK_URL}/api/agent/heartbeat`

```http
Authorization: Bearer {AGENT_TOKEN}
Content-Type: application/json
```
