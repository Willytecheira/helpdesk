import { prisma } from "@/lib/prisma"
import { decryptString, encryptString } from "@/lib/crypto"

// Cache en memoria por proceso. Se invalida al actualizar.
const cache = new Map<string, string | null>()
let cacheLoaded = false

async function loadCache() {
  const rows = await prisma.integrationSetting.findMany()
  cache.clear()
  for (const r of rows) {
    if (!r.value) {
      cache.set(r.key, null)
      continue
    }
    try {
      cache.set(r.key, r.encrypted ? decryptString(r.value) : r.value)
    } catch {
      cache.set(r.key, null)
    }
  }
  cacheLoaded = true
}

export function invalidateIntegrationCache() {
  cacheLoaded = false
  cache.clear()
}

/**
 * Lee una integración: primero DB, después process.env.
 * envKey por convención: variable de entorno que se usa como fallback.
 */
export async function getIntegration(key: string, envKey?: string): Promise<string | null> {
  if (!cacheLoaded) await loadCache()
  const fromDb = cache.get(key)
  if (fromDb !== undefined && fromDb !== null && fromDb !== "") return fromDb
  if (envKey) {
    const fromEnv = process.env[envKey]
    if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  }
  return null
}

export async function setIntegration(
  key: string,
  value: string | null,
  opts: { encrypted?: boolean; updatedById?: string | null; description?: string } = {}
) {
  const encrypted = opts.encrypted ?? true
  const storedValue = value === null || value === "" ? null : encrypted ? encryptString(value) : value
  await prisma.integrationSetting.upsert({
    where: { key },
    update: {
      value: storedValue,
      encrypted,
      updatedById: opts.updatedById ?? null,
      description: opts.description ?? undefined,
    },
    create: {
      key,
      value: storedValue,
      encrypted,
      updatedById: opts.updatedById ?? null,
      description: opts.description ?? null,
    },
  })
  invalidateIntegrationCache()
}

export async function recordVerification(
  key: string,
  ok: boolean,
  error?: string | null
) {
  await prisma.integrationSetting.update({
    where: { key },
    data: {
      lastVerifiedAt: new Date(),
      lastVerifiedOk: ok,
      lastVerifyError: ok ? null : (error ?? "").slice(0, 1000),
    },
  })
  invalidateIntegrationCache()
}

// ---- claves canónicas y defaults ----

export const INTEGRATION_KEYS = {
  anthropicApiKey: "anthropic.apiKey",
  anthropicModel: "anthropic.model",
  openaiApiKey: "openai.apiKey",
  openaiEmbeddingModel: "openai.embeddingModel",
  googleApiKey: "google.apiKey",
  deepseekApiKey: "deepseek.apiKey",
  resendApiKey: "resend.apiKey",
  resendFrom: "resend.from",
  appBaseUrl: "app.baseUrl",
  // WhatsApp vía Evolution API
  evolutionApiUrl: "evolution.apiUrl",
  evolutionApiKey: "evolution.apiKey",
  evolutionInstance: "evolution.instance",
  evolutionAgentId: "evolution.agentId",
  evolutionDefaultCustomerId: "evolution.defaultCustomerId",
  evolutionAutoReply: "evolution.autoReply",
  evolutionWebhookToken: "evolution.webhookToken",
} as const

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
export const DEFAULT_FROM_ADDRESS = "Helpdesk <onboarding@resend.dev>"

export async function getAnthropicConfig() {
  const [apiKey, model] = await Promise.all([
    getIntegration(INTEGRATION_KEYS.anthropicApiKey, "ANTHROPIC_API_KEY"),
    getIntegration(INTEGRATION_KEYS.anthropicModel),
  ])
  return {
    apiKey,
    model: model || process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
  }
}

export async function getOpenAiConfig() {
  const [apiKey, embeddingModel] = await Promise.all([
    getIntegration(INTEGRATION_KEYS.openaiApiKey, "OPENAI_API_KEY"),
    getIntegration(INTEGRATION_KEYS.openaiEmbeddingModel),
  ])
  return {
    apiKey,
    embeddingModel: embeddingModel || DEFAULT_EMBEDDING_MODEL,
  }
}

export const DEFAULT_EVOLUTION_INSTANCE = "helpdesk"

export type EvolutionConfig = {
  apiUrl: string | null
  apiKey: string | null
  instance: string
  agentId: string | null
  defaultCustomerId: string | null
  autoReply: boolean
  webhookToken: string | null
  configured: boolean
}

export async function getEvolutionConfig(): Promise<EvolutionConfig> {
  const [apiUrl, apiKey, instance, agentId, defaultCustomerId, autoReply, webhookToken] =
    await Promise.all([
      getIntegration(INTEGRATION_KEYS.evolutionApiUrl, "EVOLUTION_API_URL"),
      getIntegration(INTEGRATION_KEYS.evolutionApiKey, "EVOLUTION_API_KEY"),
      getIntegration(INTEGRATION_KEYS.evolutionInstance, "EVOLUTION_INSTANCE"),
      getIntegration(INTEGRATION_KEYS.evolutionAgentId),
      getIntegration(INTEGRATION_KEYS.evolutionDefaultCustomerId),
      getIntegration(INTEGRATION_KEYS.evolutionAutoReply),
      getIntegration(INTEGRATION_KEYS.evolutionWebhookToken),
    ])
  return {
    apiUrl: apiUrl ? apiUrl.replace(/\/+$/, "") : null,
    apiKey,
    instance: instance || DEFAULT_EVOLUTION_INSTANCE,
    agentId: agentId || null,
    defaultCustomerId: defaultCustomerId || null,
    autoReply: autoReply === "true",
    webhookToken: webhookToken || null,
    configured: !!(apiUrl && apiKey),
  }
}

export async function getResendConfig() {
  const [apiKey, from, baseUrl] = await Promise.all([
    getIntegration(INTEGRATION_KEYS.resendApiKey, "RESEND_API_KEY"),
    getIntegration(INTEGRATION_KEYS.resendFrom, "RESEND_FROM"),
    getIntegration(INTEGRATION_KEYS.appBaseUrl, "AUTH_URL"),
  ])
  return {
    apiKey,
    from: from || DEFAULT_FROM_ADDRESS,
    baseUrl: baseUrl || process.env.AUTH_URL || "http://localhost:3000",
  }
}
