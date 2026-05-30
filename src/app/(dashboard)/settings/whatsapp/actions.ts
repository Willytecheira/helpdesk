"use server"

import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import {
  INTEGRATION_KEYS,
  DEFAULT_EVOLUTION_INSTANCE,
  getEvolutionConfig,
  getIntegration,
  setIntegration,
  recordVerification,
} from "@/lib/integrations"
import { logActivity } from "@/lib/audit"
import {
  fetchConnectionState,
  connectInstance,
  setWebhook,
  logoutInstance,
  type EvolutionClientConfig,
} from "@/lib/evolution"

const configSchema = z.object({
  apiUrl: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  apiKey: z.string().trim().min(4).optional().or(z.literal("")),
  instance: z.string().trim().min(1).max(60).optional().or(z.literal("")),
  agentId: z.string().trim().optional().or(z.literal("")),
  defaultCustomerId: z.string().trim().optional().or(z.literal("")),
  autoReply: z.coerce.boolean().optional(),
})

async function loadClient(): Promise<EvolutionClientConfig | null> {
  const cfg = await getEvolutionConfig()
  if (!cfg.apiUrl || !cfg.apiKey) return null
  return { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, instance: cfg.instance }
}

async function getBaseUrl(): Promise<string> {
  const fromDb = await getIntegration(INTEGRATION_KEYS.appBaseUrl, "AUTH_URL")
  return (fromDb || process.env.AUTH_URL || "").replace(/\/+$/, "")
}

export async function buildWebhookUrl(): Promise<string | null> {
  const [baseUrl, token] = await Promise.all([
    getBaseUrl(),
    getIntegration(INTEGRATION_KEYS.evolutionWebhookToken),
  ])
  if (!baseUrl || !token) return null
  return `${baseUrl}/api/whatsapp/webhook?token=${token}`
}

export async function saveWhatsappConfig(
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  const user = await requireAdmin()
  const parsed = configSchema.safeParse({
    apiUrl: fd.get("apiUrl") || "",
    apiKey: fd.get("apiKey") || "",
    instance: fd.get("instance") || "",
    agentId: fd.get("agentId") || "",
    defaultCustomerId: fd.get("defaultCustomerId") || "",
    autoReply: fd.get("autoReply") === "on",
  })
  if (!parsed.success) {
    const errs: Record<string, string> = {}
    for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message
    return actionError("Revisá los campos", errs)
  }
  const d = parsed.data

  if (d.apiUrl) {
    await setIntegration(INTEGRATION_KEYS.evolutionApiUrl, d.apiUrl, {
      encrypted: false,
      updatedById: user.id,
      description: "URL de Evolution API",
    })
  }

  // apiKey: si vino enmascarada (contiene …) no la tocamos
  const shouldUpdateKey = d.apiKey && !d.apiKey.includes("…")
  if (shouldUpdateKey) {
    await setIntegration(INTEGRATION_KEYS.evolutionApiKey, d.apiKey!, {
      updatedById: user.id,
      description: "API key global de Evolution",
    })
  }

  await setIntegration(
    INTEGRATION_KEYS.evolutionInstance,
    (d.instance || DEFAULT_EVOLUTION_INSTANCE).trim(),
    { encrypted: false, updatedById: user.id, description: "Nombre de la instancia" }
  )
  await setIntegration(INTEGRATION_KEYS.evolutionAgentId, d.agentId || "", {
    encrypted: false,
    updatedById: user.id,
    description: "Agente IA que responde por WhatsApp",
  })
  await setIntegration(
    INTEGRATION_KEYS.evolutionDefaultCustomerId,
    d.defaultCustomerId || "",
    {
      encrypted: false,
      updatedById: user.id,
      description: "Cliente por defecto para números no reconocidos",
    }
  )
  await setIntegration(
    INTEGRATION_KEYS.evolutionAutoReply,
    d.autoReply ? "true" : "false",
    { encrypted: false, updatedById: user.id, description: "Respuesta automática del agente" }
  )

  // Generar el token del webhook la primera vez
  const existingToken = await getIntegration(INTEGRATION_KEYS.evolutionWebhookToken)
  if (!existingToken) {
    await setIntegration(
      INTEGRATION_KEYS.evolutionWebhookToken,
      randomBytes(24).toString("hex"),
      { updatedById: user.id, description: "Token de validación del webhook entrante" }
    )
  }

  logActivity({
    userId: user.id,
    entityType: "integration",
    entityId: "evolution",
    action: "integration_update",
    diff: { keyUpdated: shouldUpdateKey, autoReply: d.autoReply, instance: d.instance },
  })

  revalidatePath("/settings/whatsapp")
  return actionOk()
}

export async function testWhatsappConnection(): Promise<ActionResult<{ state: string }>> {
  await requireAdmin()
  const client = await loadClient()
  if (!client) return actionError("Configurá la URL y la API key primero")
  try {
    const { state } = await fetchConnectionState(client)
    await recordVerification(INTEGRATION_KEYS.evolutionApiKey, true).catch(() => {})
    revalidatePath("/settings/whatsapp")
    return actionOk({ state })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    await recordVerification(INTEGRATION_KEYS.evolutionApiKey, false, msg).catch(() => {})
    revalidatePath("/settings/whatsapp")
    return actionError(msg)
  }
}

export async function getWhatsappStatus(): Promise<ActionResult<{ state: string }>> {
  await requireAdmin()
  const client = await loadClient()
  if (!client) return actionError("No configurado")
  const { state } = await fetchConnectionState(client)
  return actionOk({ state })
}

export async function connectWhatsapp(): Promise<
  ActionResult<{ state: string; qrBase64: string | null; pairingCode: string | null }>
> {
  await requireAdmin()
  const client = await loadClient()
  if (!client) return actionError("Configurá la URL y la API key primero")
  try {
    const res = await connectInstance(client)
    return actionOk(res)
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "No se pudo conectar")
  }
}

export async function registerWhatsappWebhook(): Promise<ActionResult<{ url: string }>> {
  await requireAdmin()
  const client = await loadClient()
  if (!client) return actionError("Configurá la URL y la API key primero")
  const url = await buildWebhookUrl()
  if (!url) {
    return actionError(
      "Falta la URL pública de la app (AUTH_URL) o el token. Guardá la config primero."
    )
  }
  try {
    await setWebhook(client, url)
    return actionOk({ url })
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "No se pudo registrar el webhook")
  }
}

export async function disconnectWhatsapp(): Promise<ActionResult> {
  const user = await requireAdmin()
  const client = await loadClient()
  if (!client) return actionError("No configurado")
  await logoutInstance(client)
  logActivity({
    userId: user.id,
    entityType: "integration",
    entityId: "evolution",
    action: "integration_update",
    diff: { action: "logout" },
  })
  revalidatePath("/settings/whatsapp")
  return actionOk()
}

export async function clearWhatsapp(): Promise<ActionResult> {
  await requireAdmin()
  await prisma.integrationSetting.deleteMany({
    where: {
      key: {
        in: [
          INTEGRATION_KEYS.evolutionApiUrl,
          INTEGRATION_KEYS.evolutionApiKey,
          INTEGRATION_KEYS.evolutionInstance,
          INTEGRATION_KEYS.evolutionAgentId,
          INTEGRATION_KEYS.evolutionDefaultCustomerId,
          INTEGRATION_KEYS.evolutionAutoReply,
          INTEGRATION_KEYS.evolutionWebhookToken,
        ],
      },
    },
  })
  revalidatePath("/settings/whatsapp")
  return actionOk()
}
