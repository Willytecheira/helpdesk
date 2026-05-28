"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"

const serverSchema = z.object({
  customerId: z.string().min(1, "Seleccioná un cliente"),
  name: z.string().min(2),
  hostname: z.string().optional().or(z.literal("")),
  ipAddress: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  provider: z.string().optional().or(z.literal("")),
  os: z.string().optional().or(z.literal("")),
  cpuCores: z.coerce.number().int().positive().optional().or(z.literal("")),
  memoryGb: z.coerce.number().positive().optional().or(z.literal("")),
  diskGb: z.coerce.number().positive().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
})

type ServerInput = z.infer<typeof serverSchema>

function parse(fd: FormData) {
  return serverSchema.safeParse({
    customerId: fd.get("customerId"),
    name: fd.get("name"),
    hostname: fd.get("hostname") || undefined,
    ipAddress: fd.get("ipAddress") || undefined,
    location: fd.get("location") || undefined,
    provider: fd.get("provider") || undefined,
    os: fd.get("os") || undefined,
    cpuCores: fd.get("cpuCores") || undefined,
    memoryGb: fd.get("memoryGb") || undefined,
    diskGb: fd.get("diskGb") || undefined,
    notes: fd.get("notes") || undefined,
  })
}

function errors(p: z.ZodSafeParseError<ServerInput>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

function clean(d: ServerInput) {
  return {
    customerId: d.customerId,
    name: d.name.trim(),
    hostname: d.hostname?.toString().trim() || null,
    ipAddress: d.ipAddress?.toString().trim() || null,
    location: d.location?.toString().trim() || null,
    provider: d.provider?.toString().trim() || null,
    os: d.os?.toString().trim() || null,
    cpuCores: d.cpuCores === "" || d.cpuCores === undefined ? null : Number(d.cpuCores),
    memoryGb: d.memoryGb === "" || d.memoryGb === undefined ? null : Number(d.memoryGb),
    diskGb: d.diskGb === "" || d.diskGb === undefined ? null : Number(d.diskGb),
    notes: d.notes?.toString().trim() || null,
  }
}

export async function createServer(_p: ActionResult, fd: FormData): Promise<ActionResult<{ id: string }>> {
  await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))
  try {
    const s = await prisma.server.create({
      data: { ...clean(parsed.data), agentToken: randomBytes(24).toString("hex") },
    })
    revalidatePath("/infrastructure")
    return actionOk({ id: s.id })
  } catch {
    return actionError("No se pudo crear")
  }
}

export async function updateServer(
  id: string,
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))
  try {
    await prisma.server.update({ where: { id }, data: clean(parsed.data) })
    revalidatePath("/infrastructure")
    revalidatePath(`/infrastructure/${id}`)
    return actionOk()
  } catch {
    return actionError("No se pudo actualizar")
  }
}

export async function deleteServer(id: string) {
  await requireStaff()
  try {
    await prisma.server.delete({ where: { id } })
  } catch {
    return actionError("No se pudo eliminar")
  }
  revalidatePath("/infrastructure")
  redirect("/infrastructure")
}

export async function regenerateAgentToken(id: string): Promise<ActionResult<{ token: string }>> {
  await requireStaff()
  const token = randomBytes(24).toString("hex")
  await prisma.server.update({ where: { id }, data: { agentToken: token } })
  revalidatePath(`/infrastructure/${id}`)
  return actionOk({ token })
}

// Contenedores manuales
const containerSchema = z.object({
  serverId: z.string().min(1),
  systemId: z.string().optional().or(z.literal("")),
  name: z.string().min(1),
  image: z.string().min(1),
  imageTag: z.string().optional().or(z.literal("")),
  status: z.enum(["RUNNING", "PAUSED", "EXITED", "RESTARTING", "CREATED", "DEAD", "UNKNOWN"]).default("UNKNOWN"),
  notes: z.string().optional().or(z.literal("")),
})

export async function createContainer(
  serverId: string,
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  await requireStaff()
  const parsed = containerSchema.safeParse({
    serverId,
    systemId: fd.get("systemId") || undefined,
    name: fd.get("name"),
    image: fd.get("image"),
    imageTag: fd.get("imageTag") || undefined,
    status: fd.get("status") || undefined,
    notes: fd.get("notes") || undefined,
  })
  if (!parsed.success) {
    const errs: Record<string, string> = {}
    for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message
    return actionError("Datos inválidos", errs)
  }
  try {
    await prisma.container.create({
      data: {
        serverId,
        systemId: parsed.data.systemId || null,
        name: parsed.data.name.trim(),
        image: parsed.data.image.trim(),
        imageTag: parsed.data.imageTag?.trim() || null,
        status: parsed.data.status,
        notes: parsed.data.notes?.trim() || null,
      },
    })
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Ya existe un contenedor con ese nombre en este servidor")
    }
    return actionError("No se pudo crear")
  }
  revalidatePath(`/infrastructure/${serverId}`)
  return actionOk()
}

export async function deleteContainer(id: string, serverId: string) {
  await requireStaff()
  await prisma.container.delete({ where: { id } })
  revalidatePath(`/infrastructure/${serverId}`)
}
