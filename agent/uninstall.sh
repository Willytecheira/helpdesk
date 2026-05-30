#!/usr/bin/env bash
# Desinstala el Helpdesk Agent de este servidor.
#   curl -fsSL https://raw.githubusercontent.com/Willytecheira/helpdesk/main/agent/uninstall.sh | sudo bash
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutá como root (sudo)." >&2
  exit 1
fi

echo "▶ Desinstalando Helpdesk Agent…"

if command -v systemctl >/dev/null 2>&1; then
  systemctl disable --now helpdesk-agent.timer 2>/dev/null || true
  rm -f /etc/systemd/system/helpdesk-agent.timer /etc/systemd/system/helpdesk-agent.service
  systemctl daemon-reload 2>/dev/null || true
fi

# Quitar de cron si estuviera
crontab -l 2>/dev/null | grep -v "/opt/helpdesk-agent/heartbeat.sh" | crontab - 2>/dev/null || true

rm -rf /opt/helpdesk-agent
rm -f /etc/helpdesk-agent.env

echo "✅ Agente desinstalado."
