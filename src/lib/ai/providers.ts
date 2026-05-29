import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createDeepSeek } from "@ai-sdk/deepseek"
import type { LanguageModel } from "ai"
import { getIntegration } from "@/lib/integrations"

export type ProviderId = "anthropic" | "openai" | "google" | "deepseek"

type ProviderConfig = {
  id: ProviderId
  label: string
  keyName: string
  envKey: string
  models: string[]
  defaultModel: string
  docsUrl: string
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyName: "anthropic.apiKey",
    envKey: "ANTHROPIC_API_KEY",
    models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-6"],
    defaultModel: "claude-sonnet-4-6",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    id: "openai",
    label: "OpenAI (GPT)",
    keyName: "openai.apiKey",
    envKey: "OPENAI_API_KEY",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
    defaultModel: "gpt-4o-mini",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  google: {
    id: "google",
    label: "Google (Gemini)",
    keyName: "google.apiKey",
    envKey: "GOOGLE_API_KEY",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    defaultModel: "gemini-2.5-flash",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    keyName: "deepseek.apiKey",
    envKey: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

export function isProviderId(v: string): v is ProviderId {
  return v in PROVIDERS
}

/** Devuelve la API key configurada para un proveedor (DB → env fallback). */
export async function getProviderKey(provider: ProviderId): Promise<string | null> {
  const cfg = PROVIDERS[provider]
  return getIntegration(cfg.keyName, cfg.envKey)
}

export async function providerConfigured(provider: ProviderId): Promise<boolean> {
  return !!(await getProviderKey(provider))
}

/** Construye un LanguageModel del proveedor indicado, o null si no hay key. */
export async function getLanguageModel(
  provider: ProviderId,
  model: string
): Promise<LanguageModel | null> {
  const apiKey = await getProviderKey(provider)
  if (!apiKey) return null

  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model)
    case "openai":
      return createOpenAI({ apiKey })(model)
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model)
    case "deepseek":
      return createDeepSeek({ apiKey })(model)
    default:
      return null
  }
}
