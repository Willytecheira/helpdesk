"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireUser, requireStaff } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { generateTicketCode } from "@/lib/ticket-codes"
import { indexTicket } from "@/lib/ai-indexer"
import {
  notifyTicketCreated as emailTicketCreated,
  notifyTicketComment as emailTicketComment,
  notifyTicketStatusChanged as emailTicketStatus,
} from "@/lib/email"
import {
  notifyTicketCreated as inappTicketCreated,
  notifyTicketComment as inappTicketComment,
  notifyTicketStatusChanged as inappTicketStatus,
  notifyTicketAssigned as inappTicketAssigned,
} from "@/lib/notifications"
import { logActivity } from "@/lib/audit"
import { getSlaConfig, computeDueAt } from "@/lib/sla"

const createSchema = z.object({
  type: z.enum(["SUPPORT", "IMPLEMENTATION"]).default("SUPPORT"),
  title: z.string().min(3, "Título demasiado corto"),
  description: z.string().min(5, "Descripción demasiado corta"),
  customerId: z.string().min(1, "Cliente requerido"),
  systemId: z.string().optional().or(z.literal("")),
  serverId: z.string().optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assignedToId: z.string().optional().or(z.literal("")),
  tags: z.string().optional().or(z.literal("")),
  // Implementación
  budgetAmount: z.string().optional().or(z.literal("")),
  budgetCurrency: z.string().optional().or(z.literal("")),
  estimatedHours: z.string().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
})

function parseCreate(fd: FormData) {
  return createSchema.safeParse({
    type: fd.get("type") || undefined,
    title: fd.get("title"),
    description: fd.get("description"),
    customerId: fd.get("customerId"),
    systemId: fd.get("systemId") || undefined,
    serverId: fd.get("serverId") || undefined,
    priority: fd.get("priority") || undefined,
    assignedToId: fd.get("assignedToId") || undefined,
    tags: fd.get("tags") || undefined,
    budgetAmount: fd.get("budgetAmount") || undefined,
    budgetCurrency: fd.get("budgetCurrency") || undefined,
    estimatedHours: fd.get("estimatedHours") || undefined,
    startDate: fd.get("startDate") || undefined,
    endDate: fd.get("endDate") || undefined,
  })
}

function parseTags(input?: string) {
  if (!input) return []
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20)
}

export async function createTicket(_p: ActionResult, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser()
  const parsed = parseCreate(fd)
  if (!parsed.success) {
    const errs: Record<string, string> = {}
    for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message
    return actionError("Revisá los campos", errs)
  }
  const d = parsed.data

  // CLIENT solo puede crear tickets para su propio cliente
  if (user.role === "CLIENT") {
    if (!user.customerId || user.customerId !== d.customerId) {
      return actionError("No autorizado")
    }
    if (d.type === "IMPLEMENTATION") {
      return actionError("Los clientes no pueden crear tickets de implementación")
    }
  }

  // SLA: sólo aplica a tickets de soporte
  const slaConfig = await getSlaConfig()
  const dueAt = d.type === "SUPPORT" ? computeDueAt(slaConfig, d.priority) : null

  try {
    const result = await prisma.$transaction(async (tx) => {
      const code = await generateTicketCode(tx, d.type)
      return tx.ticket.create({
        data: {
          code,
          type: d.type,
          title: d.title.trim(),
          description: d.description.trim(),
          priority: d.priority,
          customerId: d.customerId,
          systemId: d.systemId || null,
          serverId: d.serverId || null,
          createdById: user.id,
          assignedToId: user.role === "CLIENT" ? null : d.assignedToId || null,
          tags: parseTags(d.tags),
          dueAt,
          budgetAmount: d.budgetAmount ? Number(d.budgetAmount) : null,
          budgetCurrency: d.budgetCurrency || (d.budgetAmount ? "USD" : null),
          estimatedHours: d.estimatedHours ? Number(d.estimatedHours) : null,
          startDate: d.startDate ? new Date(d.startDate) : null,
          endDate: d.endDate ? new Date(d.endDate) : null,
        },
      })
    })

    revalidatePath("/tickets")
    revalidatePath("/dashboard")
    indexTicket(result.id).catch(() => {})
    emailTicketCreated(result.id, user.id).catch(() => {})
    inappTicketCreated(result.id, user.id).catch(() => {})
    logActivity({
      userId: user.id,
      entityType: "ticket",
      entityId: result.id,
      action: "create",
      diff: { code: result.code, title: d.title, type: d.type, priority: d.priority },
    })
    return actionOk({ id: result.id })
  } catch {
    return actionError("No se pudo crear el ticket")
  }
}

// Cambio rápido de estado
const statusSchema = z.enum(["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED", "CANCELLED"])

export async function setTicketStatus(
  ticketId: string,
  status: z.infer<typeof statusSchema>
): Promise<ActionResult> {
  const user = await requireUser()
  const valid = statusSchema.safeParse(status)
  if (!valid.success) return actionError("Estado inválido")

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { customerId: true } })
  if (!ticket) return actionError("Ticket no encontrado")
  if (user.role === "CLIENT" && ticket.customerId !== user.customerId) {
    return actionError("No autorizado")
  }

  const now = new Date()
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: valid.data,
      resolvedAt: valid.data === "RESOLVED" ? now : valid.data === "OPEN" ? null : undefined,
      closedAt: valid.data === "CLOSED" || valid.data === "CANCELLED" ? now : undefined,
    },
  })

  await prisma.ticketComment.create({
    data: {
      ticketId,
      authorId: user.id,
      body: `Cambió el estado a **${valid.data.replace("_", " ")}**`,
      source: "SYSTEM",
    },
  })

  revalidatePath("/tickets")
  revalidatePath(`/tickets/${ticketId}`)
  indexTicket(ticketId).catch(() => {})
  emailTicketStatus(ticketId, valid.data, user.id).catch(() => {})
  inappTicketStatus(ticketId, valid.data, user.id).catch(() => {})
  logActivity({
    userId: user.id,
    entityType: "ticket",
    entityId: ticketId,
    action: "status_change",
    diff: { status: valid.data },
  })
  return actionOk()
}

const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])

export async function setTicketPriority(
  ticketId: string,
  priority: z.infer<typeof prioritySchema>
): Promise<ActionResult> {
  await requireStaff()
  const valid = prioritySchema.safeParse(priority)
  if (!valid.success) return actionError("Prioridad inválida")
  await prisma.ticket.update({ where: { id: ticketId }, data: { priority: valid.data } })
  revalidatePath("/tickets")
  revalidatePath(`/tickets/${ticketId}`)
  return actionOk()
}

export async function assignTicket(
  ticketId: string,
  userId: string | null
): Promise<ActionResult> {
  const me = await requireStaff()
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { assignedToId: userId || null },
  })
  if (userId) inappTicketAssigned(ticketId, userId, me.id).catch(() => {})
  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath("/tickets")
  return actionOk()
}

const commentSchema = z.object({
  body: z.string().min(1, "Comentario vacío"),
  isInternal: z.coerce.boolean().optional(),
})

export async function addTicketComment(
  ticketId: string,
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = commentSchema.safeParse({
    body: fd.get("body"),
    isInternal: fd.get("isInternal") === "on",
  })
  if (!parsed.success) {
    const errs: Record<string, string> = {}
    for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message
    return actionError("Datos inválidos", errs)
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { customerId: true, channel: true, channelRef: true },
  })
  if (!ticket) return actionError("Ticket no encontrado")
  if (user.role === "CLIENT" && ticket.customerId !== user.customerId) {
    return actionError("No autorizado")
  }

  const isInternal = user.role !== "CLIENT" && !!parsed.data.isInternal
  const created = await prisma.ticketComment.create({
    data: {
      ticketId,
      authorId: user.id,
      body: parsed.data.body.trim(),
      isInternal,
      source: "USER",
    },
  })

  // Si es un ticket de WhatsApp y la respuesta es pública del staff, enviarla al número.
  if (
    !isInternal &&
    user.role !== "CLIENT" &&
    ticket.channel === "WHATSAPP" &&
    ticket.channelRef
  ) {
    const { sendWhatsappText } = await import("@/lib/evolution")
    sendWhatsappText(ticket.channelRef, parsed.data.body.trim()).catch(() => {})
  }

  revalidatePath(`/tickets/${ticketId}`)
  indexTicket(ticketId).catch(() => {})
  emailTicketComment(ticketId, created.id, user.id).catch(() => {})
  inappTicketComment(ticketId, created.id, user.id).catch(() => {})
  return actionOk()
}

export async function deleteTicket(id: string) {
  const user = await requireStaff()
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { code: true } })
  await prisma.ticket.delete({ where: { id } })
  logActivity({
    userId: user.id,
    entityType: "ticket",
    entityId: id,
    action: "delete",
    diff: ticket ? { code: ticket.code } : null,
  })
  revalidatePath("/tickets")
  redirect("/tickets")
}

// ---- Bulk actions (sólo staff) ----

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
  action: z.enum(["status", "priority", "assign"]),
  value: z.string(),
})

export async function bulkUpdateTickets(input: {
  ids: string[]
  action: "status" | "priority" | "assign"
  value: string
}): Promise<ActionResult<{ updated: number }>> {
  const user = await requireStaff()
  const parsed = bulkSchema.safeParse(input)
  if (!parsed.success) return actionError("Datos inválidos")
  const { ids, action, value } = parsed.data

  let data: Record<string, unknown> = {}
  if (action === "status") {
    if (!statusSchema.safeParse(value).success) return actionError("Estado inválido")
    const now = new Date()
    data = {
      status: value,
      resolvedAt: value === "RESOLVED" ? now : value === "OPEN" ? null : undefined,
      closedAt: value === "CLOSED" || value === "CANCELLED" ? now : undefined,
    }
  } else if (action === "priority") {
    if (!prioritySchema.safeParse(value).success) return actionError("Prioridad inválida")
    data = { priority: value }
  } else if (action === "assign") {
    data = { assignedToId: value === "__unassign__" ? null : value }
  }

  const result = await prisma.ticket.updateMany({
    where: { id: { in: ids } },
    data,
  })

  // Comentario de sistema + reindex para cada ticket (fire-and-forget)
  for (const id of ids) {
    if (action === "status") {
      prisma.ticketComment
        .create({
          data: {
            ticketId: id,
            authorId: user.id,
            body: `Cambió el estado a **${value.replace("_", " ")}** (acción masiva)`,
            source: "SYSTEM",
          },
        })
        .catch(() => {})
    }
    indexTicket(id).catch(() => {})
  }

  logActivity({
    userId: user.id,
    entityType: "ticket",
    entityId: `bulk-${ids.length}`,
    action: action === "status" ? "status_change" : action === "assign" ? "assign" : "update",
    diff: { ids, action, value, count: result.count },
  })

  revalidatePath("/tickets")
  return actionOk({ updated: result.count })
}
