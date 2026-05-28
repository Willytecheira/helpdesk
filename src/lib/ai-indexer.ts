import { prisma } from "@/lib/prisma"
import { embedTexts, embeddingsEnabled, toVectorLiteral } from "@/lib/embeddings"
import { Prisma } from "@prisma/client"

type IndexableChunk = {
  sourceType: "KB_ARTICLE" | "TICKET" | "SYSTEM" | "CUSTOMER"
  sourceId: string
  chunks: { index: number; content: string }[]
  metadata: Record<string, unknown>
}

const MAX_CHUNK_CHARS = 1800

function splitContent(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return []
  if (clean.length <= MAX_CHUNK_CHARS) return [clean]
  const parts: string[] = []
  for (let i = 0; i < clean.length; i += MAX_CHUNK_CHARS) {
    parts.push(clean.slice(i, i + MAX_CHUNK_CHARS))
  }
  return parts
}

export async function upsertEmbeddings(items: IndexableChunk[]) {
  if (items.length === 0) return { indexed: 0, skipped: 0 }
  if (!(await embeddingsEnabled())) return { indexed: 0, skipped: items.length }

  // Borrar chunks viejos de cada source
  for (const item of items) {
    await prisma.embeddingDocument.deleteMany({
      where: { sourceType: item.sourceType, sourceId: item.sourceId },
    })
  }

  const allChunks: {
    sourceType: IndexableChunk["sourceType"]
    sourceId: string
    chunkIndex: number
    content: string
    metadata: Record<string, unknown>
  }[] = []

  for (const item of items) {
    for (const chunk of item.chunks) {
      allChunks.push({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        chunkIndex: chunk.index,
        content: chunk.content,
        metadata: item.metadata,
      })
    }
  }

  if (allChunks.length === 0) return { indexed: 0, skipped: items.length }

  const BATCH = 96
  let indexed = 0
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const batch = allChunks.slice(i, i + BATCH)
    const vectors = await embedTexts(batch.map((c) => c.content))
    if (!vectors) continue

    for (let j = 0; j < batch.length; j++) {
      const c = batch[j]
      const v = vectors[j]
      await prisma.$executeRaw`
        INSERT INTO "EmbeddingDocument" (id, "sourceType", "sourceId", "chunkIndex", content, metadata, embedding, "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${c.sourceType}::"EmbeddingSource",
          ${c.sourceId},
          ${c.chunkIndex},
          ${c.content},
          ${c.metadata as Prisma.InputJsonValue},
          ${toVectorLiteral(v)}::vector,
          NOW()
        )
      `
      indexed++
    }
  }

  return { indexed, skipped: 0 }
}

// Indexers por entidad

export async function indexTicket(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      customer: { select: { id: true, name: true } },
      system: { select: { id: true, name: true } },
      comments: {
        where: { isInternal: false, source: { in: ["USER", "AI"] } },
        orderBy: { createdAt: "asc" },
        select: { body: true },
      },
    },
  })
  if (!ticket) return

  const commentsText = ticket.comments.map((c) => c.body).join("\n\n")
  const fullText = [
    `[${ticket.code}] ${ticket.title}`,
    `Cliente: ${ticket.customer.name}${ticket.system ? ` · Sistema: ${ticket.system.name}` : ""}`,
    `Estado: ${ticket.status} · Prioridad: ${ticket.priority} · Tipo: ${ticket.type}`,
    "",
    "Descripción:",
    ticket.description,
    commentsText ? "\n\nConversación:\n" + commentsText : "",
  ].join("\n")

  const chunks = splitContent(fullText).map((content, index) => ({ index, content }))

  await upsertEmbeddings([
    {
      sourceType: "TICKET",
      sourceId: ticket.id,
      chunks,
      metadata: {
        code: ticket.code,
        title: ticket.title,
        customerId: ticket.customerId,
        customerName: ticket.customer.name,
        systemId: ticket.systemId,
        status: ticket.status,
        type: ticket.type,
        tags: ticket.tags,
      },
    },
  ])
}

export async function indexKbArticle(articleId: string) {
  const article = await prisma.kbArticle.findUnique({
    where: { id: articleId },
    include: {
      customer: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      system: { select: { id: true, name: true } },
    },
  })
  if (!article || !article.published) return

  const fullText = [
    article.title,
    article.product ? `Producto: ${article.product.name}` : "",
    article.customer ? `Cliente: ${article.customer.name}` : "",
    article.tags.length > 0 ? `Tags: ${article.tags.join(", ")}` : "",
    "",
    article.body,
  ]
    .filter(Boolean)
    .join("\n")

  const chunks = splitContent(fullText).map((content, index) => ({ index, content }))

  await upsertEmbeddings([
    {
      sourceType: "KB_ARTICLE",
      sourceId: article.id,
      chunks,
      metadata: {
        slug: article.slug,
        title: article.title,
        customerId: article.customerId,
        productId: article.productId,
        systemId: article.systemId,
        tags: article.tags,
      },
    },
  ])
}

export async function reindexAll() {
  const stats = { tickets: 0, kb: 0 }
  const tickets = await prisma.ticket.findMany({ select: { id: true } })
  for (const t of tickets) {
    await indexTicket(t.id)
    stats.tickets++
  }
  const articles = await prisma.kbArticle.findMany({
    where: { published: true },
    select: { id: true },
  })
  for (const a of articles) {
    await indexKbArticle(a.id)
    stats.kb++
  }
  return stats
}
