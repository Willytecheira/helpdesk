"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { indexTicket } from "@/lib/ai-indexer"

const phaseSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().or(z.literal("")),
  estimatedHours: z.coerce.number().nonnegative().optional().or(z.literal("")),
  actualHours: z.coerce.number().nonnegative().optional().or(z.literal("")),
  budgetAmount: z.coerce.number().nonnegative().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED"]).default("PENDING"),
})

function parsePhase(fd: FormData) {
  return phaseSchema.safeParse({
    name: fd.get("name"),
    description: fd.get("description") || undefined,
    estimatedHours: fd.get("estimatedHours") || undefined,
    actualHours: fd.get("actualHours") || undefined,
    budgetAmount: fd.get("budgetAmount") || undefined,
    startDate: fd.get("startDate") || undefined,
    endDate: fd.get("endDate") || undefined,
    status: fd.get("status") || undefined,
  })
}

function clean(d: z.infer<typeof phaseSchema>) {
  return {
    name: d.name.trim(),
    description: d.description?.trim() || null,
    estimatedHours: d.estimatedHours === "" || d.estimatedHours === undefined ? null : Number(d.estimatedHours),
    actualHours: d.actualHours === "" || d.actualHours === undefined ? null : Number(d.actualHours),
    budgetAmount: d.budgetAmount === "" || d.budgetAmount === undefined ? null : Number(d.budgetAmount),
    startDate: d.startDate ? new Date(d.startDate) : null,
    endDate: d.endDate ? new Date(d.endDate) : null,
    status: d.status,
  }
}

function errors(p: z.ZodSafeParseError<z.infer<typeof phaseSchema>>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

export async function addPhase(ticketId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireStaff()
  const parsed = parsePhase(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))

  const last = await prisma.implementationPhase.findFirst({
    where: { ticketId },
    orderBy: { order: "desc" },
    select: { order: true },
  })

  await prisma.implementationPhase.create({
    data: {
      ticketId,
      ...clean(parsed.data),
      order: (last?.order ?? 0) + 1,
    },
  })
  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath("/implementations")
  indexTicket(ticketId).catch(() => {})
  return actionOk()
}

export async function updatePhase(phaseId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireStaff()
  const parsed = parsePhase(fd)
  if (!parsed.success) return actionError("Revisá los campos", errors(parsed))

  const phase = await prisma.implementationPhase.findUnique({ where: { id: phaseId }, select: { ticketId: true } })
  if (!phase) return actionError("Fase no encontrada")
  await prisma.implementationPhase.update({ where: { id: phaseId }, data: clean(parsed.data) })

  revalidatePath(`/tickets/${phase.ticketId}`)
  revalidatePath("/implementations")
  return actionOk()
}

const statusSchema = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED"])

export async function setPhaseStatus(
  phaseId: string,
  status: z.infer<typeof statusSchema>
): Promise<ActionResult> {
  await requireStaff()
  const valid = statusSchema.safeParse(status)
  if (!valid.success) return actionError("Estado inválido")
  const phase = await prisma.implementationPhase.findUnique({ where: { id: phaseId } })
  if (!phase) return actionError("Fase no encontrada")

  await prisma.implementationPhase.update({
    where: { id: phaseId },
    data: {
      status: valid.data,
      startDate: valid.data === "IN_PROGRESS" && !phase.startDate ? new Date() : phase.startDate,
      endDate: valid.data === "COMPLETED" && !phase.endDate ? new Date() : phase.endDate,
    },
  })

  revalidatePath(`/tickets/${phase.ticketId}`)
  revalidatePath("/implementations")
  return actionOk()
}

export async function setPhaseActualHours(phaseId: string, hours: number): Promise<ActionResult> {
  await requireStaff()
  if (Number.isNaN(hours) || hours < 0) return actionError("Horas inválidas")
  const phase = await prisma.implementationPhase.findUnique({ where: { id: phaseId } })
  if (!phase) return actionError("Fase no encontrada")
  await prisma.implementationPhase.update({ where: { id: phaseId }, data: { actualHours: hours } })

  // Recalcular total de horas reales en el ticket
  const phases = await prisma.implementationPhase.findMany({
    where: { ticketId: phase.ticketId },
    select: { actualHours: true },
  })
  const total = phases.reduce((acc, p) => acc + (p.actualHours ?? 0), 0)
  await prisma.ticket.update({
    where: { id: phase.ticketId },
    data: { actualHours: total },
  })

  revalidatePath(`/tickets/${phase.ticketId}`)
  revalidatePath("/implementations")
  return actionOk()
}

export async function deletePhase(phaseId: string): Promise<ActionResult> {
  await requireStaff()
  const phase = await prisma.implementationPhase.findUnique({ where: { id: phaseId }, select: { ticketId: true } })
  if (!phase) return actionError("Fase no encontrada")
  await prisma.implementationPhase.delete({ where: { id: phaseId } })
  revalidatePath(`/tickets/${phase.ticketId}`)
  revalidatePath("/implementations")
  return actionOk()
}

export async function reorderPhase(phaseId: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireStaff()
  const phase = await prisma.implementationPhase.findUnique({ where: { id: phaseId } })
  if (!phase) return actionError("Fase no encontrada")
  const siblings = await prisma.implementationPhase.findMany({
    where: { ticketId: phase.ticketId },
    orderBy: { order: "asc" },
  })
  const idx = siblings.findIndex((s) => s.id === phaseId)
  const swapIdx = direction === "up" ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= siblings.length) return actionOk()

  const a = siblings[idx]
  const b = siblings[swapIdx]
  await prisma.$transaction([
    prisma.implementationPhase.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.implementationPhase.update({ where: { id: b.id }, data: { order: a.order } }),
  ])

  revalidatePath(`/tickets/${phase.ticketId}`)
  return actionOk()
}
