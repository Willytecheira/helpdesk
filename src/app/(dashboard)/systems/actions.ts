"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"

const schema = z.object({
  name: z.string().min(2),
  customerId: z.string().min(1, "Seleccioná un cliente"),
  productId: z.string().min(1, "Seleccioná un producto"),
  environment: z.enum(["PRODUCTION", "STAGING", "DEVELOPMENT"]).default("PRODUCTION"),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).default("ACTIVE"),
  url: z.string().url("URL inválida").optional().or(z.literal("")),
  installedAt: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
})

function parse(fd: FormData) {
  return schema.safeParse({
    name: fd.get("name"),
    customerId: fd.get("customerId"),
    productId: fd.get("productId"),
    environment: fd.get("environment") || undefined,
    status: fd.get("status") || undefined,
    url: fd.get("url") || undefined,
    installedAt: fd.get("installedAt") || undefined,
    notes: fd.get("notes") || undefined,
  })
}

function errors(p: z.ZodSafeParseError<z.infer<typeof schema>>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

function toData(d: z.infer<typeof schema>) {
  return {
    name: d.name.trim(),
    customerId: d.customerId,
    productId: d.productId,
    environment: d.environment,
    status: d.status,
    url: d.url?.trim() || null,
    installedAt: d.installedAt ? new Date(d.installedAt) : null,
    notes: d.notes?.trim() || null,
  }
}

export async function createSystem(_p: ActionResult, fd: FormData): Promise<ActionResult<{ id: string }>> {
  await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))
  try {
    const s = await prisma.system.create({ data: toData(parsed.data) })
    revalidatePath("/systems")
    revalidatePath(`/customers/${parsed.data.customerId}`)
    return actionOk({ id: s.id })
  } catch {
    return actionError("No se pudo crear")
  }
}

export async function updateSystem(
  id: string,
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))
  try {
    await prisma.system.update({ where: { id }, data: toData(parsed.data) })
    revalidatePath("/systems")
    revalidatePath(`/systems/${id}`)
    return actionOk()
  } catch {
    return actionError("No se pudo actualizar")
  }
}

export async function deleteSystem(id: string) {
  await requireStaff()
  const sys = await prisma.system.findUnique({ where: { id }, select: { customerId: true } })
  try {
    await prisma.system.delete({ where: { id } })
  } catch {
    return actionError("No se pudo eliminar (puede tener tickets o contenedores)")
  }
  revalidatePath("/systems")
  if (sys) revalidatePath(`/customers/${sys.customerId}`)
  redirect("/systems")
}

const linkSchema = z.object({
  serverId: z.string().min(1),
  role: z.string().optional().or(z.literal("")),
})

export async function linkSystemToServer(
  systemId: string,
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  await requireStaff()
  const parsed = linkSchema.safeParse({
    serverId: fd.get("serverId"),
    role: fd.get("role") || undefined,
  })
  if (!parsed.success) return actionError("Datos inválidos")
  try {
    await prisma.serverSystem.create({
      data: {
        systemId,
        serverId: parsed.data.serverId,
        role: parsed.data.role?.trim() || null,
      },
    })
  } catch {
    return actionError("Ya está vinculado")
  }
  revalidatePath(`/systems/${systemId}`)
  return actionOk()
}

export async function unlinkSystemFromServer(systemId: string, serverId: string) {
  await requireStaff()
  await prisma.serverSystem.delete({
    where: { serverId_systemId: { serverId, systemId } },
  })
  revalidatePath(`/systems/${systemId}`)
}
