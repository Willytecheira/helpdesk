# Helpdesk Agent

Agente liviano que reporta el estado de un servidor (CPU, RAM, disco, uptime) y
sus contenedores Docker al Helpdesk, cada minuto.

## Instalación rápida (recomendada)

En el sistema, andá a **Infraestructura → tu servidor → tab Agente** y copiá el
comando que ya trae la URL y el token. Se ve así:

```bash
curl -fsSL https://raw.githubusercontent.com/Willytecheira/helpdesk/main/agent/install.sh | sudo bash -s -- \
  --url https://helpdesk.tudominio.com \
  --token EL_TOKEN_DEL_SERVIDOR
```

Eso:
- Instala dependencias (`curl`, `jq`) si faltan
- Descarga el agente a `/opt/helpdesk-agent/`
- Guarda la config en `/etc/helpdesk-agent.env`
- Crea un servicio + timer de systemd (o cron) que reporta cada 60s
- Hace un primer reporte de prueba

En menos de 1 minuto el servidor aparece con sus métricas y contenedores en el panel.

### Opciones

```
--url       URL del helpdesk (requerido)
--token     token del servidor (requerido)
--interval  segundos entre reportes (default 60)
```

## Desinstalar

```bash
curl -fsSL https://raw.githubusercontent.com/Willytecheira/helpdesk/main/agent/uninstall.sh | sudo bash
```

## Operación

```bash
# Estado del timer
systemctl status helpdesk-agent.timer

# Forzar un reporte ahora
systemctl start helpdesk-agent.service

# Ver logs
journalctl -u helpdesk-agent.service -n 30
```

## Qué reporta

- Métricas del host: CPU%, RAM%, disco% (root), load avg (1/5/15m), uptime
- Hostname, sistema operativo, versión de Docker
- Por cada contenedor: nombre, imagen, tag, estado, CPU%, RAM en MB

## Notas

- El agente corre como root para poder leer el socket de Docker.
- Si el host no tiene Docker, igual reporta las métricas del servidor (lista de
  contenedores vacía).
- El token identifica al servidor. Vive en `/etc/helpdesk-agent.env` con permisos 600.
