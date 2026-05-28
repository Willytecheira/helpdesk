export const ticketStatusLabel = {
  OPEN: "Abierto",
  IN_PROGRESS: "En progreso",
  WAITING_CLIENT: "Esperando cliente",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
} as const

export const ticketStatusVariant = {
  OPEN: "destructive",
  IN_PROGRESS: "default",
  WAITING_CLIENT: "secondary",
  RESOLVED: "outline",
  CLOSED: "outline",
  CANCELLED: "outline",
} as const

export const priorityLabel = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
} as const

export const priorityVariant = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "default",
  URGENT: "destructive",
} as const

export const ticketTypeLabel = {
  SUPPORT: "Soporte",
  IMPLEMENTATION: "Implementación",
} as const

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CLIENT",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
] as const

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
