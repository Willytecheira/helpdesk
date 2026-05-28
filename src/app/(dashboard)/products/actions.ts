"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { slugify } from "@/lib/format"

const schema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Sólo minúsculas, números y guiones")
    .optional()
    .or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  version: z.string().optional().or(z.literal("")),
})

function parse(fd: FormData) {
  return schema.safeParse({
    name: fd.get("name"),
    slug: fd.get("slug") || undefined,
    description: fd.get("description") || undefined,
    version: fd.get("version") || undefined,
  })
}

function errors(p: z.ZodSafeParseError<z.infer<typeof schema>>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

export async function createProduct(_prev: ActionResult, fd: FormData): Promise<ActionResult<{ id: string }>> {
  await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))
  const d = parsed.data
  try {
    const p = await prisma.product.create({
      data: {
        name: d.name.trim(),
        slug: (d.slug || slugify(d.name)).trim(),
        description: d.description?.trim() || null,
        version: d.version?.trim() || null,
      },
    })
    revalidatePath("/products")
    return actionOk({ id: p.id })
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Ya existe un producto con ese slug", { slug: "Ya en uso" })
    }
    return actionError("No se pudo crear")
  }
}

export async function updateProduct(
  id: string,
  _prev: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))
  const d = parsed.data
  try {
    await prisma.product.update({
      where: { id },
      data: {
        name: d.name.trim(),
        slug: (d.slug || slugify(d.name)).trim(),
        description: d.description?.trim() || null,
        version: d.version?.trim() || null,
      },
    })
    revalidatePath("/products")
    return actionOk()
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Slug ya en uso", { slug: "Ya en uso" })
    }
    return actionError("No se pudo actualizar")
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireStaff()
  try {
    await prisma.product.delete({ where: { id } })
  } catch {
    return actionError("No se pudo eliminar (puede tener sistemas asociados)")
  }
  revalidatePath("/products")
  return actionOk()
}
