"use server"

import { revalidatePath } from "next/cache"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { Resend } from "resend"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import {
  INTEGRATION_KEYS,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_FROM_ADDRESS,
  setIntegration,
  recordVerification,
} from "@/lib/integrations"
import { decryptString } from "@/lib/crypto"
import { logActivity } from "@/lib/audit"

const apiKeyPattern = /^[A-Za-z0-9\-_.~+/=]+$/

const anthropicSchema = z.object({
  apiKey: z.string().min(8).regex(apiKeyPattern).optional().or(z.literal("")),
  model: z.string().trim().min(1).optional().or(z.literal("")),
})

const openaiSchema = z.object({
  apiKey: z.string().min(8).regex(apiKeyPattern).optional().or(z.literal("")),
  embeddingModel: z.string().trim().min(1).optional().or(z.literal("")),
})

function fieldErrors<T>(p: z.ZodSafeParseError<T>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

export async function saveAnthropic(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireAdmin()
  const parsed = anthropicSchema.safeParse({
    apiKey: fd.get("apiKey") || "",
    model: fd.get("model") || "",
  })
  if (!parsed.success) return actionError("Revisá los campos", fieldErrors(parsed))

  const { apiKey, model } = parsed.data

  // Si el apiKey vino como masked placeholder, lo dejamos como estaba
  const shouldUpdateKey = apiKey && !apiKey.includes("…")

  if (shouldUpdateKey) {
    await setIntegration(INTEGRATION_KEYS.anthropicApiKey, apiKey!, {
      updatedById: user.id,
      description: "Clave de Anthropic Claude",
    })
  }
  await setIntegration(
    INTEGRATION_KEYS.anthropicModel,
    (model || DEFAULT_ANTHROPIC_MODEL).trim(),
    { encrypted: false, updatedById: user.id, description: "Modelo de Claude" }
  )

  logActivity({
    userId: user.id,
    entityType: "integration",
    entityId: "anthropic",
    action: "integration_update",
    diff: { keyUpdated: shouldUpdateKey, model: model || DEFAULT_ANTHROPIC_MODEL },
  })

  revalidatePath("/settings/integrations")
  return actionOk()
}

export async function saveOpenai(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireAdmin()
  const parsed = openaiSchema.safeParse({
    apiKey: fd.get("apiKey") || "",
    embeddingModel: fd.get("embeddingModel") || "",
  })
  if (!parsed.success) return actionError("Revisá los campos", fieldErrors(parsed))

  const { apiKey, embeddingModel } = parsed.data
  const shouldUpdateKey = apiKey && !apiKey.includes("…")

  if (shouldUpdateKey) {
    await setIntegration(INTEGRATION_KEYS.openaiApiKey, apiKey!, {
      updatedById: user.id,
      description: "Clave de OpenAI (embeddings)",
    })
  }
  await setIntegration(
    INTEGRATION_KEYS.openaiEmbeddingModel,
    (embeddingModel || DEFAULT_EMBEDDING_MODEL).trim(),
    { encrypted: false, updatedById: user.id, description: "Modelo de embeddings" }
  )

  revalidatePath("/settings/integrations")
  return actionOk()
}

async function clearByKeys(keys: string[]): Promise<ActionResult> {
  await requireAdmin()
  await prisma.integrationSetting.deleteMany({ where: { key: { in: keys } } })
  revalidatePath("/settings/integrations")
  return actionOk()
}

export async function clearAnthropic(): Promise<ActionResult> {
  return clearByKeys([INTEGRATION_KEYS.anthropicApiKey, INTEGRATION_KEYS.anthropicModel])
}

export async function clearOpenai(): Promise<ActionResult> {
  return clearByKeys([INTEGRATION_KEYS.openaiApiKey, INTEGRATION_KEYS.openaiEmbeddingModel])
}

export async function clearResend(): Promise<ActionResult> {
  return clearByKeys([INTEGRATION_KEYS.resendApiKey, INTEGRATION_KEYS.resendFrom])
}

// ---------- Proveedores LLM genéricos (Google / DeepSeek) ----------

const llmKeyByProvider: Record<string, string> = {
  google: INTEGRATION_KEYS.googleApiKey,
  deepseek: INTEGRATION_KEYS.deepseekApiKey,
}

async function saveLlmProvider(
  provider: "google" | "deepseek",
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  const user = await requireAdmin()
  const apiKey = String(fd.get("apiKey") ?? "")
  if (apiKey && apiKey.length < 8) return actionError("API key inválida", { apiKey: "Muy corta" })
  const shouldUpdate = apiKey && !apiKey.includes("…")
  if (shouldUpdate) {
    await setIntegration(llmKeyByProvider[provider], apiKey, {
      updatedById: user.id,
      description: `Clave de ${provider}`,
    })
  }
  logActivity({
    userId: user.id,
    entityType: "integration",
    entityId: provider,
    action: "integration_update",
    diff: { keyUpdated: shouldUpdate },
  })
  revalidatePath("/settings/integrations")
  return actionOk()
}

export async function saveGoogle(p: ActionResult, fd: FormData) {
  return saveLlmProvider("google", p, fd)
}
export async function saveDeepseek(p: ActionResult, fd: FormData) {
  return saveLlmProvider("deepseek", p, fd)
}
export async function clearGoogle(): Promise<ActionResult> {
  return clearByKeys([INTEGRATION_KEYS.googleApiKey])
}
export async function clearDeepseek(): Promise<ActionResult> {
  return clearByKeys([INTEGRATION_KEYS.deepseekApiKey])
}

async function testLlmProvider(provider: "google" | "deepseek"): Promise<ActionResult> {
  await requireAdmin()
  const { getLanguageModel, PROVIDERS } = await import("@/lib/ai/providers")
  const model = await getLanguageModel(provider, PROVIDERS[provider].defaultModel)
  if (!model) return actionError("Configurá la API key primero")
  try {
    const { generateText } = await import("ai")
    const r = await generateText({ model, prompt: "ping", maxOutputTokens: 8 })
    if (typeof r.text !== "string") throw new Error("Respuesta vacía")
    await recordVerification(llmKeyByProvider[provider], true)
    revalidatePath("/settings/integrations")
    return actionOk()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    await recordVerification(llmKeyByProvider[provider], false, msg)
    revalidatePath("/settings/integrations")
    return actionError(msg)
  }
}

export async function testGoogle() {
  return testLlmProvider("google")
}
export async function testDeepseek() {
  return testLlmProvider("deepseek")
}

// ---------- Resend ----------

const resendSchema = z.object({
  apiKey: z.string().min(8).optional().or(z.literal("")),
  from: z.string().trim().min(3).optional().or(z.literal("")),
})

export async function saveResend(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireAdmin()
  const parsed = resendSchema.safeParse({
    apiKey: fd.get("apiKey") || "",
    // El IntegrationCard renderiza el campo "From" con name="model" (slot genérico).
    // Leemos "model" primero y dejamos "from" como fallback.
    from: fd.get("model") || fd.get("from") || "",
  })
  if (!parsed.success) return actionError("Revisá los campos", fieldErrors(parsed))

  const { apiKey, from } = parsed.data
  const shouldUpdateKey = apiKey && !apiKey.includes("…")

  if (shouldUpdateKey) {
    await setIntegration(INTEGRATION_KEYS.resendApiKey, apiKey!, {
      updatedById: user.id,
      description: "Clave de Resend (emails)",
    })
  }
  await setIntegration(
    INTEGRATION_KEYS.resendFrom,
    (from || DEFAULT_FROM_ADDRESS).trim(),
    { encrypted: false, updatedById: user.id, description: "Dirección remitente" }
  )

  revalidatePath("/settings/integrations")
  return actionOk()
}

export async function testResend(): Promise<ActionResult> {
  const user = await requireAdmin()
  const apiKey = await loadKeyPlain(INTEGRATION_KEYS.resendApiKey)
  if (!apiKey) return actionError("Configurá la API key primero")

  const fromRow = await prisma.integrationSetting.findUnique({
    where: { key: INTEGRATION_KEYS.resendFrom },
  })
  const from = (fromRow?.value && !fromRow.encrypted ? fromRow.value : null) || DEFAULT_FROM_ADDRESS

  try {
    const resend = new Resend(apiKey)
    const r = await resend.emails.send({
      from,
      to: [user.email!],
      subject: "Helpdesk · prueba de Resend",
      html: `<p>Hola ${user.name ?? user.email}, este es un email de prueba enviado desde el panel de integraciones. Si lo recibís, la configuración funciona correctamente.</p>`,
    })
    if (r.error) throw new Error(r.error.message ?? "Error de envío")
    await recordVerification(INTEGRATION_KEYS.resendApiKey, true)
    revalidatePath("/settings/integrations")
    return actionOk()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    await recordVerification(INTEGRATION_KEYS.resendApiKey, false, msg)
    revalidatePath("/settings/integrations")
    return actionError(msg)
  }
}

async function loadKeyPlain(key: string): Promise<string | null> {
  const row = await prisma.integrationSetting.findUnique({ where: { key } })
  if (!row?.value) return null
  try {
    return row.encrypted ? decryptString(row.value) : row.value
  } catch {
    return null
  }
}

export async function testAnthropic(): Promise<ActionResult> {
  await requireAdmin()
  const apiKey = await loadKeyPlain(INTEGRATION_KEYS.anthropicApiKey)
  if (!apiKey) return actionError("Configurá la API key primero")

  const modelRow = await prisma.integrationSetting.findUnique({
    where: { key: INTEGRATION_KEYS.anthropicModel },
  })
  const model = (modelRow?.value && !modelRow.encrypted ? modelRow.value : null) || DEFAULT_ANTHROPIC_MODEL

  try {
    const client = new Anthropic({ apiKey })
    const r = await client.messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "ping" }],
    })
    if (!r.content) throw new Error("Respuesta vacía")
    await recordVerification(INTEGRATION_KEYS.anthropicApiKey, true)
    revalidatePath("/settings/integrations")
    return actionOk()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    await recordVerification(INTEGRATION_KEYS.anthropicApiKey, false, msg)
    revalidatePath("/settings/integrations")
    return actionError(msg)
  }
}

export async function testOpenai(): Promise<ActionResult> {
  await requireAdmin()
  const apiKey = await loadKeyPlain(INTEGRATION_KEYS.openaiApiKey)
  if (!apiKey) return actionError("Configurá la API key primero")

  const modelRow = await prisma.integrationSetting.findUnique({
    where: { key: INTEGRATION_KEYS.openaiEmbeddingModel },
  })
  const embeddingModel = (modelRow?.value && !modelRow.encrypted ? modelRow.value : null) || DEFAULT_EMBEDDING_MODEL

  try {
    const client = new OpenAI({ apiKey })
    const r = await client.embeddings.create({ model: embeddingModel, input: "ping" })
    if (!r.data?.[0]?.embedding) throw new Error("Respuesta vacía")
    await recordVerification(INTEGRATION_KEYS.openaiApiKey, true)
    revalidatePath("/settings/integrations")
    return actionOk()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    await recordVerification(INTEGRATION_KEYS.openaiApiKey, false, msg)
    revalidatePath("/settings/integrations")
    return actionError(msg)
  }
}
