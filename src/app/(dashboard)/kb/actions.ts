"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { slugify } from "@/lib/format"
import { indexKbArticle } from "@/lib/ai-indexer"

const articleSchema = z.object({
  title: z.string().min(3, "Título demasiado corto"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Sólo minúsculas, números y guiones")
    .optional()
    .or(z.literal("")),
  body: z.string().min(10, "El cuerpo es muy corto"),
  tags: z.string().optional().or(z.literal("")),
  productId: z.string().optional().or(z.literal("")),
  customerId: z.string().optional().or(z.literal("")),
  systemId: z.string().optional().or(z.literal("")),
  published: z.coerce.boolean().optional(),
})

function parse(fd: FormData) {
  return articleSchema.safeParse({
    title: fd.get("title"),
    slug: fd.get("slug") || undefined,
    body: fd.get("body"),
    tags: fd.get("tags") || undefined,
    productId: fd.get("productId") || undefined,
    customerId: fd.get("customerId") || undefined,
    systemId: fd.get("systemId") || undefined,
    published: fd.get("published") === "on",
  })
}

function errors(p: z.ZodSafeParseError<z.infer<typeof articleSchema>>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

function parseTags(input?: string) {
  if (!input) return []
  return input
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20)
}

function clean(d: z.infer<typeof articleSchema>) {
  return {
    title: d.title.trim(),
    body: d.body.trim(),
    tags: parseTags(d.tags ?? ""),
    productId: d.productId || null,
    customerId: d.customerId || null,
    systemId: d.systemId || null,
    published: !!d.published,
  }
}

export async function createArticle(
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult<{ slug: string }>> {
  const user = await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))

  const slug = (parsed.data.slug || slugify(parsed.data.title)).trim()
  if (!slug) return actionError("Slug inválido")

  try {
    const article = await prisma.kbArticle.create({
      data: {
        slug,
        ...clean(parsed.data),
        createdById: user.id,
      },
    })
    revalidatePath("/kb")
    if (article.published) indexKbArticle(article.id).catch(() => {})
    return actionOk({ slug: article.slug })
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Ya existe un artículo con ese slug", { slug: "Ya en uso" })
    }
    return actionError("No se pudo crear el artículo")
  }
}

export async function updateArticle(
  id: string,
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult<{ slug: string }>> {
  await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))

  const slug = (parsed.data.slug || slugify(parsed.data.title)).trim()
  if (!slug) return actionError("Slug inválido")

  try {
    const article = await prisma.kbArticle.update({
      where: { id },
      data: { slug, ...clean(parsed.data) },
    })
    revalidatePath("/kb")
    revalidatePath(`/kb/${slug}`)
    if (article.published) {
      indexKbArticle(article.id).catch(() => {})
    } else {
      // Si se despublicó, borrar de embeddings
      await prisma.embeddingDocument.deleteMany({
        where: { sourceType: "KB_ARTICLE", sourceId: article.id },
      })
    }
    return actionOk({ slug: article.slug })
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Slug ya en uso", { slug: "Ya en uso" })
    }
    return actionError("No se pudo actualizar")
  }
}

export async function togglePublished(id: string): Promise<ActionResult> {
  await requireStaff()
  const article = await prisma.kbArticle.findUnique({ where: { id } })
  if (!article) return actionError("Artículo no encontrado")
  const next = !article.published
  await prisma.kbArticle.update({ where: { id }, data: { published: next } })
  if (next) {
    indexKbArticle(id).catch(() => {})
  } else {
    await prisma.embeddingDocument.deleteMany({
      where: { sourceType: "KB_ARTICLE", sourceId: id },
    })
  }
  revalidatePath("/kb")
  revalidatePath(`/kb/${article.slug}`)
  return actionOk()
}

export async function deleteArticle(id: string) {
  await requireStaff()
  const article = await prisma.kbArticle.findUnique({ where: { id } })
  if (!article) return actionError("No encontrado")
  await prisma.kbArticle.delete({ where: { id } })
  await prisma.embeddingDocument.deleteMany({
    where: { sourceType: "KB_ARTICLE", sourceId: id },
  })
  revalidatePath("/kb")
  redirect("/kb")
}
