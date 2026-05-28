import OpenAI from "openai"
import { getOpenAiConfig, DEFAULT_EMBEDDING_MODEL } from "@/lib/integrations"

export const EMBEDDING_DIMENSIONS = 1536

let cachedClient: { client: OpenAI; apiKey: string } | null = null

async function getClient(): Promise<{ client: OpenAI; model: string } | null> {
  const { apiKey, embeddingModel } = await getOpenAiConfig()
  if (!apiKey) return null
  if (cachedClient && cachedClient.apiKey === apiKey) {
    return { client: cachedClient.client, model: embeddingModel }
  }
  const client = new OpenAI({ apiKey })
  cachedClient = { client, apiKey }
  return { client, model: embeddingModel || DEFAULT_EMBEDDING_MODEL }
}

export async function embeddingsEnabled(): Promise<boolean> {
  const { apiKey } = await getOpenAiConfig()
  return !!apiKey
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const c = await getClient()
  if (!c) return null
  if (texts.length === 0) return []

  const cleaned = texts.map((t) => t.replace(/\s+/g, " ").trim().slice(0, 30_000))
  const result = await c.client.embeddings.create({
    model: c.model,
    input: cleaned,
  })
  return result.data.map((d) => d.embedding)
}

export async function embedText(text: string): Promise<number[] | null> {
  const all = await embedTexts([text])
  if (!all) return null
  return all[0] ?? null
}

export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`
}
