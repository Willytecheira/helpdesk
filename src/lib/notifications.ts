import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

type Kind =
  | "TICKET_CREATED"
  | "TICKET_COMMENTED"
  | "TICKET_STATUS_CHANGED"
  | "TICKET_ASSIGNED"
  | "SYSTEM"

type NotifyOpts = {
  userIds: string[]
  kind: Kind
  title: string
  body?: string
  url?: string
}

export async function notify({ userIds, kind, title, body, url }: NotifyOpts) {
  if (userIds.length === 0) return
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, kind, title, body: body ?? null, url: url ?? null })),
    })
  } catch (e) {
    logger.warn(
      { err: e instanceof Error ? e.message : "unknown", kind, count: userIds.length },
      "notification_create_failed"
    )
  }
}

// Helpers para los eventos comunes —————————————————————————

export async function notifyTicketCreated(ticketId: string, actorId: string | null) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      customer: { select: { name: true, users: { where: { role: "CLIENT" }, select: { id: true } } } },
      assignedTo: { select: { id: true } },
    },
  })
  if (!ticket) return

  // Notificar a admins + agentes + asignado (excepto el actor)
  const staff = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "AGENT"] },
      active: true,
      id: { not: actorId ?? undefined },
    },
    select: { id: true },
  })
  await notify({
    userIds: staff.map((s) => s.id),
    kind: "TICKET_CREATED",
    title: `${ticket.code}: ${ticket.title}`,
    body: `Cliente: ${ticket.customer.name} · Prioridad: ${ticket.priority}`,
    url: `/tickets/${ticket.id}`,
  })
}

export async function notifyTicketComment(
  ticketId: string,
  commentId: string,
  actorId: string | null
) {
  const [ticket, comment] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        customer: { select: { users: { where: { role: "CLIENT" }, select: { id: true } } } },
        assignedTo: { select: { id: true } },
      },
    }),
    prisma.ticketComment.findUnique({
      where: { id: commentId },
      include: { author: { select: { id: true, role: true } } },
    }),
  ])
  if (!ticket || !comment) return
  if (comment.source === "SYSTEM") return

  // Si es interno: sólo staff. Sino: si actor es CLIENT → staff; si actor es staff → clientes
  const recipientIds = new Set<string>()
  if (comment.isInternal) {
    const staff = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "AGENT"] },
        active: true,
        id: { not: actorId ?? undefined },
      },
      select: { id: true },
    })
    staff.forEach((s) => recipientIds.add(s.id))
  } else if (comment.author?.role === "CLIENT") {
    const staff = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "AGENT"] }, active: true },
      select: { id: true },
    })
    staff.forEach((s) => recipientIds.add(s.id))
  } else {
    ticket.customer.users.forEach((u) => recipientIds.add(u.id))
  }
  // Sacar al actor
  if (actorId) recipientIds.delete(actorId)

  await notify({
    userIds: [...recipientIds],
    kind: "TICKET_COMMENTED",
    title: `Nuevo comentario en ticket`,
    body: comment.body.slice(0, 200),
    url: `/tickets/${ticket.id}`,
  })
}

export async function notifyTicketStatusChanged(
  ticketId: string,
  newStatus: string,
  actorId: string | null
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      customer: { select: { users: { where: { role: "CLIENT" }, select: { id: true } } } },
      assignedTo: { select: { id: true } },
    },
  })
  if (!ticket) return

  const recipientIds = new Set<string>()
  // Avisar al asignado (si no fue el actor)
  if (ticket.assignedTo?.id && ticket.assignedTo.id !== actorId) {
    recipientIds.add(ticket.assignedTo.id)
  }
  // Y al cliente si el cambio es relevante
  if (["RESOLVED", "CLOSED", "WAITING_CLIENT"].includes(newStatus)) {
    ticket.customer.users.forEach((u) => {
      if (u.id !== actorId) recipientIds.add(u.id)
    })
  }

  await notify({
    userIds: [...recipientIds],
    kind: "TICKET_STATUS_CHANGED",
    title: `${ticket.code} → ${newStatus.replace("_", " ")}`,
    body: ticket.title,
    url: `/tickets/${ticket.id}`,
  })
}

export async function notifyTicketAssigned(
  ticketId: string,
  assignedToId: string,
  actorId: string | null
) {
  if (assignedToId === actorId) return
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, code: true, title: true },
  })
  if (!ticket) return
  await notify({
    userIds: [assignedToId],
    kind: "TICKET_ASSIGNED",
    title: `Te asignaron ${ticket.code}`,
    body: ticket.title,
    url: `/tickets/${ticket.id}`,
  })
}
