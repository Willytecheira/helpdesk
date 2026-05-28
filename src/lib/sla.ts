import { getIntegration, setIntegration } from "@/lib/integrations"

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export type SlaConfig = {
  enabled: boolean
  // Horas hasta el vencimiento de resolución, por prioridad
  hoursByPriority: Record<Priority, number>
}

export const DEFAULT_SLA: SlaConfig = {
  enabled: false,
  hoursByPriority: {
    URGENT: 4,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 168,
  },
}

const SLA_KEY = "sla.config"

export async function getSlaConfig(): Promise<SlaConfig> {
  const raw = await getIntegration(SLA_KEY)
  if (!raw) return DEFAULT_SLA
  try {
    const parsed = JSON.parse(raw) as Partial<SlaConfig>
    return {
      enabled: parsed.enabled ?? DEFAULT_SLA.enabled,
      hoursByPriority: {
        ...DEFAULT_SLA.hoursByPriority,
        ...(parsed.hoursByPriority ?? {}),
      },
    }
  } catch {
    return DEFAULT_SLA
  }
}

export async function saveSlaConfig(config: SlaConfig, updatedById?: string) {
  await setIntegration(SLA_KEY, JSON.stringify(config), {
    encrypted: false,
    updatedById,
    description: "Configuración de SLA por prioridad",
  })
}

/** Calcula la fecha de vencimiento según prioridad. Null si SLA deshabilitado. */
export function computeDueAt(
  config: SlaConfig,
  priority: Priority,
  from: Date = new Date()
): Date | null {
  if (!config.enabled) return null
  const hours = config.hoursByPriority[priority]
  if (!hours || hours <= 0) return null
  return new Date(from.getTime() + hours * 60 * 60 * 1000)
}

export type SlaStatus = "ok" | "due_soon" | "overdue" | "none"

/** Estado del SLA de un ticket. due_soon = vence en menos del 20% del tiempo restante. */
export function slaStatus(
  dueAt: Date | string | null | undefined,
  ticketStatus: string
): SlaStatus {
  if (!dueAt) return "none"
  // Tickets cerrados/resueltos no tienen SLA activo
  if (["RESOLVED", "CLOSED", "CANCELLED"].includes(ticketStatus)) return "none"
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt
  const now = Date.now()
  const remaining = due.getTime() - now
  if (remaining < 0) return "overdue"
  if (remaining < 4 * 60 * 60 * 1000) return "due_soon" // menos de 4h
  return "ok"
}
