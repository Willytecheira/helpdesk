"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { logActivity } from "@/lib/audit"
import { runRecurringTickets } from "@/lib/recurring"

const schema = z.object({
  name: z.string().min(2),
  title: z.string().min(3),
  description: z.string().min(5),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  customerId: z.string().min(1),
  systemId: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  intervalDays: z.coerce.number().int().positive().max(3650),
  startDate: z.string().optional().or(z.literal("")),
  tags: z.string().optional().or(z.literal("")),
})

function fieldErrors<T>(p: z.ZodSafeParseError<T>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

function parseTags(input?: string) {
  if (!input) return []
  return input.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20)
}

function parse(fd: FormData) {
  return schema.safeParse({
    name: fd.get("name"),
    title: fd.get("title"),
    description: fd.get("description"),
    priority: fd.get("priority") || undefined,
    customerId: fd.get("customerId"),
    systemId: fd.get("systemId") || undefined,
    assignedToId: fd.get("assignedToId") || undefined,
    intervalDays: fd.get("intervalDays"),
    startDate: fd.get("startDate") || undefined,
    tags: fd.get("tags") || undefined,
  })
}

export async function createRecurring(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", fieldErrors(parsed))
  const d = parsed.data

  const nextRunAt = d.startDate ? new Date(d.startDate) : new Date()

  const rec = await prisma.recurringTicket.create({
    data: {
      name: d.name.trim(),
      title: d.title.trim(),
      description: d.description.trim(),
      priority: d.priority,
      customerId: d.customerId,
      systemId: d.systemId || null,
      assignedToId: d.assignedToId || null,
      intervalDays: d.intervalDays,
      nextRunAt,
      tags: parseTags(d.tags),
    },
  })
  logActivity({
    userId: me.id,
    entityType: "ticket",
    entityId: rec.id,
    action: "create",
    diff: { recurring: true, name: d.name, intervalDays: d.intervalDays },
  })
  revalidatePath("/recurring")
  return actionOk()
}

export async function updateRecurring(
  id: string,
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  await requireStaff()
  const parsed = parse(fd)
  if (!parsed.success) return actionError("Revisá los campos", fieldErrors(parsed))
  const d = parsed.data
  await prisma.recurringTicket.update({
    where: { id },
    data: {
      name: d.name.trim(),
      title: d.title.trim(),
      description: d.description.trim(),
      priority: d.priority,
      customerId: d.customerId,
      systemId: d.systemId || null,
      assignedToId: d.assignedToId || null,
      intervalDays: d.intervalDays,
      ...(d.startDate ? { nextRunAt: new Date(d.startDate) } : {}),
      tags: parseTags(d.tags),
    },
  })
  revalidatePath("/recurring")
  return actionOk()
}

export async function toggleRecurring(id: string): Promise<ActionResult> {
  await requireStaff()
  const rec = await prisma.recurringTicket.findUnique({ where: { id } })
  if (!rec) return actionError("No encontrado")
  await prisma.recurringTicket.update({ where: { id }, data: { active: !rec.active } })
  revalidatePath("/recurring")
  return actionOk()
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  await requireStaff()
  await prisma.recurringTicket.delete({ where: { id } })
  revalidatePath("/recurring")
  return actionOk()
}

/** Ejecuta manualmente el procesamiento (botón "Ejecutar ahora"). */
export async function runNow(): Promise<ActionResult<{ created: number }>> {
  await requireStaff()
  const r = await runRecurringTickets()
  revalidatePath("/recurring")
  revalidatePath("/tickets")
  return actionOk({ created: r.created.length })
}
