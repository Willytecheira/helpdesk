import { tool, type Tool } from "ai"
import { z } from "zod"
import { TOOL_HANDLERS, type AiToolContext } from "@/lib/ai-tools"

// Catálogo de herramientas disponibles para los agentes, en formato AI SDK.
// Reutiliza los handlers de @/lib/ai-tools (que ya tienen aislamiento por rol).

export type ToolName =
  | "search_knowledge_base"
  | "get_ticket_by_code"
  | "list_recent_tickets"
  | "get_customer_overview"
  | "get_server_status"
  | "create_ticket"
  | "update_ticket_status"
  | "add_ticket_comment"

export const TOOL_CATALOG: { name: ToolName; label: string; mutates: boolean }[] = [
  { name: "search_knowledge_base", label: "Buscar en KB y tickets (RAG)", mutates: false },
  { name: "get_ticket_by_code", label: "Ver ticket por código", mutates: false },
  { name: "list_recent_tickets", label: "Listar tickets recientes", mutates: false },
  { name: "get_customer_overview", label: "Resumen de cliente", mutates: false },
  { name: "get_server_status", label: "Estado de servidor", mutates: false },
  { name: "create_ticket", label: "Crear ticket", mutates: true },
  { name: "update_ticket_status", label: "Cambiar estado de ticket", mutates: true },
  { name: "add_ticket_comment", label: "Comentar en ticket", mutates: true },
]

export const ALL_TOOL_NAMES = TOOL_CATALOG.map((t) => t.name)

const schemas: Record<ToolName, { description: string; inputSchema: z.ZodTypeAny }> = {
  search_knowledge_base: {
    description:
      "Busca en la base de conocimiento (artículos y tickets) con búsqueda semántica. Usalo para encontrar soluciones a problemas similares.",
    inputSchema: z.object({
      query: z.string().describe("Consulta en lenguaje natural"),
      top_k: z.number().optional().describe("Cantidad de resultados (máx 12)"),
    }),
  },
  get_ticket_by_code: {
    description: "Obtiene los detalles de un ticket por su código (ej: TKT-0001).",
    inputSchema: z.object({ code: z.string() }),
  },
  list_recent_tickets: {
    description: "Lista tickets recientes con filtros opcionales.",
    inputSchema: z.object({
      status: z
        .enum(["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED", "CANCELLED"])
        .optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      type: z.enum(["SUPPORT", "IMPLEMENTATION"]).optional(),
      customer_slug: z.string().optional(),
      limit: z.number().optional(),
    }),
  },
  get_customer_overview: {
    description: "Resumen del cliente: sistemas, servidores y tickets abiertos.",
    inputSchema: z.object({ slug: z.string() }),
  },
  get_server_status: {
    description: "Estado actual de un servidor por nombre (último heartbeat + contenedores).",
    inputSchema: z.object({ name: z.string() }),
  },
  create_ticket: {
    description:
      "Crea un ticket de soporte. Usar SÓLO cuando el usuario confirma que quiere abrir un ticket.",
    inputSchema: z.object({
      title: z.string(),
      description: z.string(),
      customer_slug: z.string().optional().describe("Requerido si el usuario es staff"),
      system_id: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    }),
  },
  update_ticket_status: {
    description: "Cambia el estado de un ticket cuando el usuario lo solicita.",
    inputSchema: z.object({
      code: z.string(),
      status: z.enum([
        "OPEN",
        "IN_PROGRESS",
        "WAITING_CLIENT",
        "RESOLVED",
        "CLOSED",
        "CANCELLED",
      ]),
    }),
  },
  add_ticket_comment: {
    description: "Agrega un comentario al ticket en nombre del usuario.",
    inputSchema: z.object({
      code: z.string(),
      body: z.string(),
      is_internal: z.boolean().optional(),
    }),
  },
}

/** Construye el objeto de tools para AI SDK, limitado a las habilitadas. */
export function buildAgentTools(
  ctx: AiToolContext,
  enabled: string[]
): Record<string, Tool> {
  const result: Record<string, Tool> = {}
  for (const { name } of TOOL_CATALOG) {
    if (!enabled.includes(name)) continue
    const def = schemas[name]
    const handler = TOOL_HANDLERS[name]
    result[name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (input: unknown) =>
        handler((input ?? {}) as Record<string, unknown>, ctx),
    })
  }
  return result
}
