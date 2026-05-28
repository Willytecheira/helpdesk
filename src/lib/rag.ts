import { prisma } from "@/lib/prisma"
import { embedText, toVectorLiteral, embeddingsEnabled } from "@/lib/embeddings"

export type RagMatch = {
  sourceType: "KB_ARTICLE" | "TICKET" | "TICKET_COMMENT" | "SYSTEM" | "CUSTOMER"
  sourceId: string
  content: string
  similarity: number
  metadata: Record<string, unknown> | null
}

type SearchOptions = {
  topK?: number
  sourceTypes?: RagMatch["sourceType"][]
  customerId?: string | null
}

export async function searchRag(
  query: string,
  opts: SearchOptions = {}
): Promise<RagMatch[]> {
  if (!(await embeddingsEnabled())) return []
  if (!query.trim()) return []

  const vec = await embedText(query)
  if (!vec) return []

  const topK = Math.min(opts.topK ?? 6, 20)
  const literal = toVectorLiteral(vec)

  const filters: string[] = []
  const params: unknown[] = [literal]

  if (opts.sourceTypes && opts.sourceTypes.length > 0) {
    const placeholders = opts.sourceTypes.map((_, idx) => `$${params.length + idx + 1}`).join(",")
    filters.push(`"sourceType"::text IN (${placeholders})`)
    params.push(...opts.sourceTypes)
  }

  if (opts.customerId) {
    filters.push(`(metadata->>'customerId' = $${params.length + 1} OR metadata->>'customerId' IS NULL)`)
    params.push(opts.customerId)
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      sourceType: RagMatch["sourceType"]
      sourceId: string
      content: string
      metadata: Record<string, unknown> | null
      distance: number
    }>
  >(
    `
    SELECT "sourceType", "sourceId", content, metadata,
           (embedding <=> $1::vector) AS distance
    FROM "EmbeddingDocument"
    ${where}
    ORDER BY embedding <=> $1::vector
    LIMIT ${topK}
    `,
    ...params
  )

  return rows.map((r) => ({
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    content: r.content,
    metadata: r.metadata,
    similarity: 1 - Number(r.distance),
  }))
}
