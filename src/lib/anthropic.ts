import Anthropic from "@anthropic-ai/sdk"
import { getAnthropicConfig, DEFAULT_ANTHROPIC_MODEL } from "@/lib/integrations"

// Caches dinámicos: se invalidan implícitamente cuando la API key cambia
// porque comparamos contra la key actual antes de reutilizar el cliente.
let cachedClient: { client: Anthropic; apiKey: string } | null = null

export async function getAnthropic(): Promise<Anthropic | null> {
  const { apiKey } = await getAnthropicConfig()
  if (!apiKey) return null
  if (cachedClient && cachedClient.apiKey === apiKey) return cachedClient.client
  const client = new Anthropic({ apiKey })
  cachedClient = { client, apiKey }
  return client
}

export async function getAnthropicModel(): Promise<string> {
  const { model } = await getAnthropicConfig()
  return model || DEFAULT_ANTHROPIC_MODEL
}

export { DEFAULT_ANTHROPIC_MODEL }
