import { prisma } from "@/lib/prisma"
import { generateTicketCode } from "@/lib/ticket-codes"
import { indexTicket } from "@/lib/ai-indexer"
import { notifyTicketCreated as inappNotify } from "@/lib/notifications"
import { notifyTicketCreated as emailNotify } from "@/lib/email"
import { logger } from "@/lib/logger"

/**
 * Procesa todos los recurrentes activos cuyo nextRunAt ya pasó.
 * Genera un ticket por cada uno y reprograma la próxima ejecución.
 */
export async function runRecurringTickets(now: Date = new Date()) {
  const due = await prisma.recurringTicket.findMany({
    where: { active: true, nextRunAt: { lte: now } },
  })

  const created: { id: string; code: string; recurringId: string }[] = []

  for (const rec of due) {
    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const code = await generateTicketCode(tx, "SUPPORT")
        const t = await tx.ticket.create({
          data: {
            code,
            type: "SUPPORT",
            title: rec.title,
            description: rec.description,
            priority: rec.priority,
            customerId: rec.customerId,
            systemId: rec.systemId,
            assignedToId: rec.assignedToId,
            tags: [...rec.tags, "recurrente"],
          },
          select: { id: true, code: true },
        })

        // Reprogramar: avanzar nextRunAt en intervalDays a partir de ahora
        const next = new Date(now.getTime() + rec.intervalDays * 24 * 60 * 60 * 1000)
        await tx.recurringTicket.update({
          where: { id: rec.id },
          data: { lastRunAt: now, nextRunAt: next },
        })
        return t
      })

      created.push({ id: ticket.id, code: ticket.code, recurringId: rec.id })
      indexTicket(ticket.id).catch(() => {})
      inappNotify(ticket.id, null).catch(() => {})
      emailNotify(ticket.id, null).catch(() => {})
    } catch (e) {
      logger.error(
        { err: e instanceof Error ? e.message : "unknown", recurringId: rec.id },
        "recurring_ticket_failed"
      )
    }
  }

  logger.info({ processed: due.length, created: created.length }, "recurring_run")
  return { processed: due.length, created }
}
