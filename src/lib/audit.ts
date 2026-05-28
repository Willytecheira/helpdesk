import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "unpublish"
  | "login"
  | "logout"
  | "login_failed"
  | "status_change"
  | "assign"
  | "ai_action"
  | "integration_update"
  | "integration_clear"
  | "integration_test"
  | "rate_limited"

export type AuditEntity =
  | "user"
  | "customer"
  | "product"
  | "system"
  | "server"
  | "container"
  | "ticket"
  | "ticket_comment"
  | "phase"
  | "kb_article"
  | "integration"
  | "session"
  | "agent"

type LogOpts = {
  userId?: string | null
  entityType: AuditEntity
  entityId: string
  action: AuditAction
  diff?: Record<string, unknown> | null
}

/** No bloquea: si falla, sólo loguea localmente. */
export async function logActivity(opts: LogOpts): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: opts.userId ?? null,
        entityType: opts.entityType,
        entityId: opts.entityId,
        action: opts.action,
        diff: (opts.diff ?? undefined) as unknown as never,
      },
    })
  } catch (e) {
    logger.warn(
      { err: e instanceof Error ? e.message : "unknown", ...opts },
      "activitylog_failed"
    )
  }
}

/** Devuelve sólo los campos cambiados entre antes y después. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const result: Record<string, { from: unknown; to: unknown }> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const k of keys) {
    if (k === "updatedAt" || k === "createdAt") continue
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      result[k] = { from: before[k] ?? null, to: after[k] ?? null }
    }
  }
  return result
}
