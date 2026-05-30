#!/usr/bin/env bash
#
# Helpdesk Agent — instalador
#
# Descarga el agente, lo instala como servicio y lo deja reportando cada minuto
# el estado del servidor (CPU/RAM/disco) + contenedores Docker al Helpdesk.
#
# Uso (one-liner):
#   curl -fsSL https://raw.githubusercontent.com/Willytecheira/helpdesk/main/agent/install.sh \
#     | sudo bash -s -- --url https://helpdesk.tudominio.com --token TU_TOKEN
#
# Opciones:
#   --url     URL base del helpdesk (requerido)
#   --token   Token del servidor — Infraestructura → servidor → tab Agente (requerido)
#   --interval Segundos entre reportes (default 60)
#   --repo    Repo raw base (default repo oficial)

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/Willytecheira/helpdesk/main/agent"
INSTALL_DIR="/opt/helpdesk-agent"
ENV_FILE="/etc/helpdesk-agent.env"
INTERVAL=60
HELPDESK_URL=""
AGENT_TOKEN=""

# -------- parse args --------
while [ $# -gt 0 ]; do
  case "$1" in
    --url) HELPDESK_URL="$2"; shift 2 ;;
    --token) AGENT_TOKEN="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --repo) REPO_RAW="$2"; shift 2 ;;
    *) echo "Opción desconocida: $1" >&2; exit 1 ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "❌ Ejecutá como root (usá sudo)." >&2
  exit 1
fi
if [ -z "$HELPDESK_URL" ] || [ -z "$AGENT_TOKEN" ]; then
  echo "❌ Faltan --url y/o --token." >&2
  echo "   Ejemplo: sudo bash install.sh --url https://helpdesk.tudominio.com --token abc123" >&2
  exit 1
fi

echo "▶ Instalando Helpdesk Agent…"

# -------- dependencias --------
install_pkg() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq "$@"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q "$@"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q "$@"
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache "$@"
  else
    echo "⚠ No pude detectar el gestor de paquetes. Instalá manualmente: $*" >&2
  fi
}

for dep in curl jq; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    echo "  · Instalando dependencia: $dep"
    install_pkg "$dep"
  fi
done

if ! command -v docker >/dev/null 2>&1; then
  echo "  ⚠ Docker no está instalado en este host. El agente reportará métricas"
  echo "    del servidor igual, pero la lista de contenedores irá vacía."
fi

# -------- descargar el agente --------
mkdir -p "$INSTALL_DIR"
echo "  · Descargando heartbeat.sh"
curl -fsSL "$REPO_RAW/heartbeat.sh" -o "$INSTALL_DIR/heartbeat.sh"
chmod +x "$INSTALL_DIR/heartbeat.sh"

# -------- archivo de configuración --------
echo "  · Escribiendo configuración en $ENV_FILE"
cat > "$ENV_FILE" <<EOF
HELPDESK_URL=$HELPDESK_URL
AGENT_TOKEN=$AGENT_TOKEN
EOF
chmod 600 "$ENV_FILE"

# -------- prueba inmediata --------
echo "  · Probando conexión…"
if ( set -a; . "$ENV_FILE"; set +a; "$INSTALL_DIR/heartbeat.sh" ) >/tmp/helpdesk-agent-test.log 2>&1; then
  echo "  ✓ Primer reporte enviado correctamente."
else
  echo "  ❌ El reporte de prueba falló. Detalle:" >&2
  cat /tmp/helpdesk-agent-test.log >&2
  echo "  Revisá la URL y el token. Igual continúo con la instalación del servicio." >&2
fi

# -------- programar ejecución periódica --------
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  echo "  · Instalando servicio systemd (cada ${INTERVAL}s)"
  cat > /etc/systemd/system/helpdesk-agent.service <<EOF
[Unit]
Description=Helpdesk agent heartbeat
After=docker.service network-online.target

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=$INSTALL_DIR/heartbeat.sh
EOF

  cat > /etc/systemd/system/helpdesk-agent.timer <<EOF
[Unit]
Description=Run helpdesk-agent every ${INTERVAL}s

[Timer]
OnBootSec=30s
OnUnitActiveSec=${INTERVAL}s
Unit=helpdesk-agent.service

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now helpdesk-agent.timer >/dev/null 2>&1
  echo "  ✓ Servicio activo. Estado: systemctl status helpdesk-agent.timer"
else
  echo "  · systemd no disponible, usando cron (cada minuto)"
  CRON_LINE="* * * * * . $ENV_FILE && $INSTALL_DIR/heartbeat.sh >/var/log/helpdesk-agent.log 2>&1"
  ( crontab -l 2>/dev/null | grep -v "$INSTALL_DIR/heartbeat.sh" ; echo "$CRON_LINE" ) | crontab -
  echo "  ✓ Cron instalado."
fi

echo ""
echo "✅ Helpdesk Agent instalado. El servidor empezará a reportar en menos de 1 minuto."
echo "   Vas a verlo en: $HELPDESK_URL  →  Infraestructura → tu servidor"
