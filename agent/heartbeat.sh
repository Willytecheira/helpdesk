#!/usr/bin/env bash
#
# Helpdesk agent — heartbeat reporter
#
# Recopila métricas del host + lista de contenedores Docker y los envía
# al endpoint /api/agent/heartbeat del Helpdesk.
#
# Variables requeridas:
#   HELPDESK_URL    - URL base del helpdesk (ej: https://helpdesk.tudominio.com)
#   AGENT_TOKEN     - token del servidor (Infraestructura → servidor → Agente)
#
# Dependencias: bash, curl, jq, docker (opcional), awk
#
# Uso:
#   HELPDESK_URL=https://... AGENT_TOKEN=... ./heartbeat.sh
#
# Para ejecutar cada 1 minuto vía cron:
#   * * * * * HELPDESK_URL=... AGENT_TOKEN=... /opt/helpdesk-agent/heartbeat.sh

# Sin `set -e`/`pipefail` a propósito: es un colector de métricas y no debe
# abortar si una métrica individual falla (p. ej. `top` sin TTY bajo systemd).
set -u

# Asegura que docker/jq/curl se encuentren aunque systemd use un PATH reducido.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

: "${HELPDESK_URL:?HELPDESK_URL no está definido}"
: "${AGENT_TOKEN:?AGENT_TOKEN no está definido}"

command -v curl >/dev/null || { echo "curl no instalado" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq no instalado" >&2; exit 1; }

# -------- métricas del host --------

cpu_percent() {
  # uso de CPU como 100 - %idle (a partir del 2do sample)
  if command -v top >/dev/null 2>&1; then
    if top -bn2 -d 0.5 >/dev/null 2>&1; then
      top -bn2 -d 0.5 | grep -i "cpu" | tail -n 1 | \
        awk -F'[, ]+' '{
          for (i=1; i<=NF; i++) {
            if ($i ~ /id/) { print 100 - $(i-1); exit }
          }
        }'
      return
    fi
  fi
  echo ""
}

memory_percent() {
  awk '/^MemTotal:/ {total=$2}
       /^MemAvailable:/ {avail=$2}
       END { if (total > 0) printf "%.2f", (total-avail)/total*100 }' /proc/meminfo 2>/dev/null || echo ""
}

disk_percent() {
  df -P / 2>/dev/null | awk 'NR==2 { gsub("%","",$5); print $5 }'
}

load_avgs() {
  awk '{ print $1, $2, $3 }' /proc/loadavg 2>/dev/null
}

uptime_seconds() {
  awk '{ printf "%d", $1 }' /proc/uptime 2>/dev/null
}

docker_version() {
  if command -v docker >/dev/null 2>&1; then
    docker --version 2>/dev/null | awk '{ print $3 }' | tr -d ','
  fi
}

# -------- capacidad del host --------

cpu_cores() {
  nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo 2>/dev/null || echo ""
}

memory_total_gb() {
  awk '/^MemTotal:/ { printf "%.2f", $2/1024/1024 }' /proc/meminfo 2>/dev/null || echo ""
}

disk_total_gb() {
  df -P / 2>/dev/null | awk 'NR==2 { printf "%.1f", $2/1024/1024 }'
}

primary_ip() {
  # IP de la interfaz por defecto (evita loopback/docker)
  ip route get 1.1.1.1 2>/dev/null \
    | awk '{ for (i=1;i<=NF;i++) if ($i=="src") { print $(i+1); exit } }' \
    || hostname -I 2>/dev/null | awk '{ print $1 }'
}

# -------- contenedores docker --------

containers_json() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "[]"
    return
  fi

  if ! docker ps -a --format '{{json .}}' >/dev/null 2>&1; then
    echo "[]"
    return
  fi

  # ps + stats (sin --no-stream se queda colgado; usamos no-stream)
  local stats_tmp ps_tmp
  stats_tmp=$(mktemp)
  ps_tmp=$(mktemp)

  docker stats --no-stream --format '{{json .}}' >"$stats_tmp" 2>/dev/null || true
  docker ps -a --format '{{json .}}' >"$ps_tmp" 2>/dev/null || true

  # --slurpfile mantiene CADA archivo como su propio array (a diferencia de
  # `jq -s` con varios archivos, que los aplana todos en uno solo → bug).
  jq -n --slurpfile stats "$stats_tmp" --slurpfile ps "$ps_tmp" '
    ($stats | map(select(type=="object"))) as $st
    | ($ps | map(select(type=="object")))
    | map(
        . as $c
        | ((first($st[] | select(.Name == ($c.Names // "")))) // null) as $s
        | {
            containerId: ($c.ID // null),
            name: ($c.Names // ""),
            image: (($c.Image // "") | split(":")[0]),
            imageTag: (($c.Image // "") | split(":")[1] // null),
            status: (
              (($c.State // "") | ascii_downcase) as $state
              | if   ($state | test("running"))    then "RUNNING"
                elif ($state | test("paused"))     then "PAUSED"
                elif ($state | test("restarting")) then "RESTARTING"
                elif ($state | test("created"))    then "CREATED"
                elif ($state | test("exited"))     then "EXITED"
                elif ($state | test("dead"))       then "DEAD"
                else "UNKNOWN" end
            ),
            cpuPercent: (
              if $s then (($s.CPUPerc // "") | gsub("%";"") | (tonumber? // null)) else null end
            ),
            memoryMb: (
              if $s then
                (($s.MemUsage // "") | split(" / ")[0]) as $m
                | if   ($m | test("GiB$")) then (($m | gsub("GiB$";"") | (tonumber? // 0)) * 1024)
                  elif ($m | test("MiB$")) then ($m | gsub("MiB$";"") | (tonumber? // null))
                  elif ($m | test("KiB$")) then (($m | gsub("KiB$";"") | (tonumber? // 0)) / 1024)
                  else null end
              else null end
            )
          }
      )
  '

  rm -f "$stats_tmp" "$ps_tmp"
}

# -------- payload --------

CPU=$(cpu_percent)
MEM=$(memory_percent)
DISK=$(disk_percent)
read -r LOAD1 LOAD5 LOAD15 <<< "$(load_avgs || echo '0 0 0')"
UPTIME=$(uptime_seconds)
DOCKER_VER=$(docker_version || true)
HOSTNAME_VAL=$(hostname 2>/dev/null || echo "")
OS_VAL=$( ( . /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-}" ) || uname -s )
CPU_CORES=$(cpu_cores)
MEM_GB=$(memory_total_gb)
DISK_GB=$(disk_total_gb)
IP_ADDR=$(primary_ip 2>/dev/null || echo "")
CONTAINERS=$(containers_json 2>/dev/null || echo "[]")
[ -z "$CONTAINERS" ] && CONTAINERS="[]"

payload=$(jq -n \
  --arg hostname "$HOSTNAME_VAL" \
  --arg os "$OS_VAL" \
  --arg dockerVersion "${DOCKER_VER:-}" \
  --arg ipAddress "${IP_ADDR:-}" \
  --argjson cpuPercent "${CPU:-null}" \
  --argjson memoryPercent "${MEM:-null}" \
  --argjson diskPercent "${DISK:-null}" \
  --argjson loadAvg1 "${LOAD1:-null}" \
  --argjson loadAvg5 "${LOAD5:-null}" \
  --argjson loadAvg15 "${LOAD15:-null}" \
  --argjson uptimeSeconds "${UPTIME:-null}" \
  --argjson cpuCores "${CPU_CORES:-null}" \
  --argjson memoryGb "${MEM_GB:-null}" \
  --argjson diskGb "${DISK_GB:-null}" \
  --argjson containers "${CONTAINERS}" \
  '{
    hostname: (if $hostname == "" then null else $hostname end),
    os: (if $os == "" then null else $os end),
    dockerVersion: (if $dockerVersion == "" then null else $dockerVersion end),
    ipAddress: (if $ipAddress == "" then null else $ipAddress end),
    cpuPercent: $cpuPercent,
    memoryPercent: $memoryPercent,
    diskPercent: $diskPercent,
    loadAvg1: $loadAvg1,
    loadAvg5: $loadAvg5,
    loadAvg15: $loadAvg15,
    uptimeSeconds: $uptimeSeconds,
    cpuCores: $cpuCores,
    memoryGb: $memoryGb,
    diskGb: $diskGb,
    containers: $containers
  } | with_entries(select(.value != null))')

response=$(curl -fsS -X POST "${HELPDESK_URL%/}/api/agent/heartbeat" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$payload") || {
  echo "Falló el envío del heartbeat" >&2
  exit 1
}

echo "$response"
