/**
 * Cliente mínimo para Evolution API (WhatsApp).
 *
 * Evolution API es un servicio aparte (self-hosted, contenedor Docker) que
 * envuelve WhatsApp. Este módulo sólo habla con su API REST:
 *   - autenticación con el header `apikey` (la API key global de Evolution)
 *   - una "instancia" = una conexión de WhatsApp (un número)
 *
 * Probado contra Evolution API v2. Las llamadas son tolerantes a fallos:
 * devuelven el JSON crudo y lanzan Error con el status/mensaje si !ok.
 */
import { getEvolutionConfig } from "@/lib/integrations"
import { agentLogger } from "@/lib/logger"

export type EvolutionClientConfig = {
  apiUrl: string
  apiKey: string
  instance: string
}

const TIMEOUT_MS = 20_000

/** Convierte un remoteJid de WhatsApp ("549...@s.whatsapp.net" / "...:12@...") a su número. */
export function jidToNumber(jid: string): string {
  return String(jid || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/[^\d]/g, "")
}

/** ¿El JID corresponde a un grupo? (no creamos tickets de grupos) */
export function isGroupJid(jid: string): boolean {
  return String(jid || "").endsWith("@g.us")
}

async function call<T = unknown>(
  cfg: EvolutionClientConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${cfg.apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.apiKey,
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network_error"
    throw new Error(`No se pudo contactar Evolution API: ${msg}`)
  }

  const raw = await res.text()
  let json: unknown = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    json = raw
  }

  if (!res.ok) {
    let detail = raw
    if (json && typeof json === "object" && "message" in json) {
      const m = (json as { message: unknown }).message
      detail = typeof m === "string" ? m : JSON.stringify(m)
    }
    throw new Error(`Evolution API ${res.status}: ${String(detail).slice(0, 300)}`)
  }
  return json as T
}

/** Estado de la conexión: "open" (conectado), "connecting", "close". */
export async function fetchConnectionState(
  cfg: EvolutionClientConfig
): Promise<{ state: string; raw: unknown }> {
  try {
    const data = await call<{ instance?: { state?: string }; state?: string }>(
      cfg,
      `/instance/connectionState/${encodeURIComponent(cfg.instance)}`
    )
    const state = data?.instance?.state ?? data?.state ?? "unknown"
    return { state: String(state), raw: data }
  } catch (e) {
    // Instancia inexistente → la tratamos como "close"
    agentLogger.debug({ err: String(e) }, "evolution_state_error")
    return { state: "close", raw: null }
  }
}

/** Crea la instancia si no existe. Idempotente: ignora "ya existe". */
export async function ensureInstance(cfg: EvolutionClientConfig): Promise<void> {
  try {
    await call(cfg, `/instance/create`, {
      method: "POST",
      body: JSON.stringify({
        instanceName: cfg.instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    // 403/409 "already in use" / "already exists" → ok
    if (/already|exist|in use|403|409/i.test(msg)) return
    throw e
  }
}

/**
 * Inicia la conexión y devuelve el QR (data URI base64) y/o pairing code.
 * Crea la instancia si hace falta.
 */
export async function connectInstance(cfg: EvolutionClientConfig): Promise<{
  state: string
  qrBase64: string | null
  pairingCode: string | null
}> {
  await ensureInstance(cfg)

  // Si ya está conectada, connect devuelve estado sin QR.
  const current = await fetchConnectionState(cfg)
  if (current.state === "open") {
    return { state: "open", qrBase64: null, pairingCode: null }
  }

  const data = await call<{
    base64?: string
    code?: string
    pairingCode?: string
    qrcode?: { base64?: string; code?: string; pairingCode?: string }
  }>(cfg, `/instance/connect/${encodeURIComponent(cfg.instance)}`)

  const qrBase64 = data?.base64 ?? data?.qrcode?.base64 ?? null
  const pairingCode = data?.pairingCode ?? data?.qrcode?.pairingCode ?? null
  return { state: "connecting", qrBase64, pairingCode }
}

/** Cierra la sesión de WhatsApp (logout) sin borrar la instancia. */
export async function logoutInstance(cfg: EvolutionClientConfig): Promise<void> {
  await call(cfg, `/instance/logout/${encodeURIComponent(cfg.instance)}`, {
    method: "DELETE",
  }).catch(() => {})
}

/** Registra el webhook entrante en Evolution para recibir mensajes. */
export async function setWebhook(
  cfg: EvolutionClientConfig,
  url: string
): Promise<void> {
  const events = ["MESSAGES_UPSERT"]
  // Formato v2 (anidado en `webhook`)
  try {
    await call(cfg, `/webhook/set/${encodeURIComponent(cfg.instance)}`, {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url,
          byEvents: false,
          base64: false,
          events,
        },
      }),
    })
    return
  } catch (e) {
    agentLogger.debug({ err: String(e) }, "evolution_webhook_v2_failed")
  }
  // Fallback formato v1 (plano)
  await call(cfg, `/webhook/set/${encodeURIComponent(cfg.instance)}`, {
    method: "POST",
    body: JSON.stringify({
      url,
      enabled: true,
      webhook_by_events: false,
      events,
    }),
  })
}

/** Envía un mensaje de texto a un número (sin `+`, con código de país). */
export async function sendText(
  cfg: EvolutionClientConfig,
  number: string,
  text: string
): Promise<void> {
  const clean = number.replace(/[^\d]/g, "")
  await call(cfg, `/message/sendText/${encodeURIComponent(cfg.instance)}`, {
    method: "POST",
    body: JSON.stringify({ number: clean, text }),
  })
}

/** Carga la config desde la DB y devuelve un cliente, o null si no está configurado. */
export async function getEvolutionClient(): Promise<EvolutionClientConfig | null> {
  const cfg = await getEvolutionConfig()
  if (!cfg.configured || !cfg.apiUrl || !cfg.apiKey) return null
  return { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, instance: cfg.instance }
}

/** Conveniencia: envía un texto cargando la config desde la DB. No lanza. */
export async function sendWhatsappText(number: string, text: string): Promise<boolean> {
  const client = await getEvolutionClient()
  if (!client) return false
  try {
    await sendText(client, number, text)
    return true
  } catch (e) {
    agentLogger.warn({ err: String(e), number: number.slice(-4) }, "whatsapp_send_failed")
    return false
  }
}
