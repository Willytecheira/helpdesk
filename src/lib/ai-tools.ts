import type Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { searchRag } from "@/lib/rag"
import { generateTicketCode } from "@/lib/ticket-codes"
import { indexTicket } from "@/lib/ai-indexer"

// Context que se pasa a los handlers — incluye user y customer si aplica.
export type AiToolContext = {
  userId: string
  role: "ADMIN" | "AGENT" | "CLIENT"
  customerId: string | null
}

export const AI_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_knowledge_base",
    description:
      "Busca en la base de conocimiento (artículos publicados, tickets anteriores) usando búsqueda semántica. Útil para encontrar soluciones a problemas similares ya documentados.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "La consulta en lenguaje natural describiendo el problema o tema.",
        },
        top_k: { type: "number", description: "Cantidad de resultados (default 6, máx 12)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_ticket_by_code",
    description: "Obtiene los detalles de un ticket específico por su código (ej: TKT-0001 o IMP-0042).",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Código del ticket" },
      },
      required: ["code"],
    },
  },
  {
    name: "list_recent_tickets",
    description:
      "Lista tickets recientes. Soporta filtrado por estado, prioridad, cliente y tipo.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED", "CANCELLED"],
        },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        type: { type: "string", enum: ["SUPPORT", "IMPLEMENTATION"] },
        customer_slug: { type: "string", description: "Slug del cliente para filtrar" },
        limit: { type: "number", description: "Máximo 25" },
      },
    },
  },
  {
    name: "get_customer_overview",
    description:
      "Devuelve un resumen completo del cliente: sus sistemas, servidores y tickets abiertos.",
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Slug del cliente" },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_server_status",
    description:
      "Obtiene el estado actual de un servidor por nombre, incluyendo último heartbeat y contenedores corriendo.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_ticket",
    description:
      "Crea un nuevo ticket de soporte en nombre del usuario. Usar SÓLO cuando el usuario confirma explícitamente que quiere abrir un ticket.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        customer_slug: { type: "string", description: "Slug del cliente. Requerido si el usuario es staff." },
        system_id: { type: "string", description: "Opcional" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "update_ticket_status",
    description:
      "Cambia el estado de un ticket. Usar cuando el usuario lo solicita explícitamente o cuando una solución fue confirmada.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Código del ticket (TKT-NNNN o IMP-NNNN)" },
        status: {
          type: "string",
          enum: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED", "CANCELLED"],
        },
      },
      required: ["code", "status"],
    },
  },
  {
    name: "add_ticket_comment",
    description:
      "Agrega un comentario al ticket en nombre del usuario. Si is_internal es true, sólo lo verán los técnicos.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string" },
        body: { type: "string" },
        is_internal: { type: "boolean" },
      },
      required: ["code", "body"],
    },
  },
]

type ToolHandler = (
  input: Record<string, unknown>,
  ctx: AiToolContext
) => Promise<unknown>

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  async search_knowledge_base(input, ctx) {
    const query = String(input.query ?? "")
    const topK = Math.min(Number(input.top_k ?? 6), 12)
    const results = await searchRag(query, {
      topK,
      customerId: ctx.role === "CLIENT" ? ctx.customerId : null,
    })
    return {
      matches: results.map((r) => ({
        type: r.sourceType,
        id: r.sourceId,
        similarity: Number(r.similarity.toFixed(3)),
        snippet: r.content.slice(0, 600),
        metadata: r.metadata,
      })),
    }
  },

  async get_ticket_by_code(input, ctx) {
    const code = String(input.code ?? "")
    const ticket = await prisma.ticket.findUnique({
      where: { code },
      include: {
        customer: { select: { id: true, slug: true, name: true } },
        system: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        comments: {
          where: ctx.role === "CLIENT" ? { isInternal: false } : undefined,
          orderBy: { createdAt: "asc" },
          take: 30,
          include: { author: { select: { name: true, email: true, role: true } } },
        },
      },
    })
    if (!ticket) return { error: "Ticket no encontrado" }
    if (ctx.role === "CLIENT" && ticket.customerId !== ctx.customerId) {
      return { error: "No autorizado" }
    }
    return {
      code: ticket.code,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      customer: ticket.customer.name,
      customer_slug: ticket.customer.slug,
      system: ticket.system?.name,
      assigned_to: ticket.assignedTo?.name ?? ticket.assignedTo?.email ?? null,
      tags: ticket.tags,
      created_at: ticket.createdAt,
      comments: ticket.comments.map((c) => ({
        author: c.author?.name ?? c.author?.email ?? "Sistema",
        author_role: c.author?.role ?? null,
        is_internal: c.isInternal,
        source: c.source,
        body: c.body,
        at: c.createdAt,
      })),
    }
  },

  async list_recent_tickets(input, ctx) {
    const limit = Math.min(Number(input.limit ?? 10), 25)
    const where: Record<string, unknown> = {}
    if (input.status) where.status = input.status
    if (input.priority) where.priority = input.priority
    if (input.type) where.type = input.type
    if (ctx.role === "CLIENT") {
      where.customerId = ctx.customerId
    } else if (input.customer_slug) {
      const c = await prisma.customer.findUnique({ where: { slug: String(input.customer_slug) } })
      if (!c) return { error: "Cliente no encontrado" }
      where.customerId = c.id
    }

    const tickets = await prisma.ticket.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        code: true,
        title: true,
        status: true,
        priority: true,
        type: true,
        customer: { select: { name: true, slug: true } },
        system: { select: { name: true } },
        createdAt: true,
      },
    })
    return { tickets }
  },

  async get_customer_overview(input, ctx) {
    const slug = String(input.slug ?? "")
    const customer = await prisma.customer.findUnique({
      where: { slug },
      include: {
        systems: { include: { product: true } },
        servers: true,
        _count: { select: { tickets: true } },
      },
    })
    if (!customer) return { error: "Cliente no encontrado" }
    if (ctx.role === "CLIENT" && customer.id !== ctx.customerId) {
      return { error: "No autorizado" }
    }

    const openTickets = await prisma.ticket.count({
      where: {
        customerId: customer.id,
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] },
      },
    })

    return {
      name: customer.name,
      slug: customer.slug,
      status: customer.status,
      systems: customer.systems.map((s) => ({
        id: s.id,
        name: s.name,
        product: s.product.name,
        environment: s.environment,
        status: s.status,
      })),
      servers: customer.servers.map((s) => ({
        name: s.name,
        ip: s.ipAddress,
        status: s.status,
        last_seen: s.lastSeenAt,
      })),
      total_tickets: customer._count.tickets,
      open_tickets: openTickets,
    }
  },

  async get_server_status(input, ctx) {
    const name = String(input.name ?? "")
    const server = await prisma.server.findFirst({
      where: ctx.role === "CLIENT" ? { name, customerId: ctx.customerId ?? "" } : { name },
      include: {
        customer: { select: { name: true, slug: true } },
        containers: { orderBy: { name: "asc" } },
        heartbeats: { take: 1, orderBy: { reportedAt: "desc" } },
      },
    })
    if (!server) return { error: "Servidor no encontrado" }
    const hb = server.heartbeats[0]
    return {
      name: server.name,
      customer: server.customer.name,
      status: server.status,
      last_seen: server.lastSeenAt,
      ip: server.ipAddress,
      os: server.os,
      cpu_cores: server.cpuCores,
      memory_gb: server.memoryGb,
      latest_metrics: hb
        ? {
            cpu_percent: hb.cpuPercent,
            memory_percent: hb.memoryPercent,
            disk_percent: hb.diskPercent,
            load_avg: [hb.loadAvg1, hb.loadAvg5, hb.loadAvg15],
            uptime_seconds: hb.uptimeSeconds,
            reported_at: hb.reportedAt,
          }
        : null,
      containers: server.containers.map((c) => ({
        name: c.name,
        image: `${c.image}${c.imageTag ? `:${c.imageTag}` : ""}`,
        status: c.status,
        cpu_percent: c.cpuPercent,
        memory_mb: c.memoryMb,
      })),
    }
  },

  async create_ticket(input, ctx) {
    const title = String(input.title ?? "").trim()
    const description = String(input.description ?? "").trim()
    const priority = ((input.priority as string) ?? "MEDIUM") as
      | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    const systemId = input.system_id ? String(input.system_id) : null

    if (!title || !description) {
      return { error: "Título y descripción son requeridos" }
    }

    let customerId: string | null = null
    if (ctx.role === "CLIENT") {
      customerId = ctx.customerId
    } else if (input.customer_slug) {
      const c = await prisma.customer.findUnique({ where: { slug: String(input.customer_slug) } })
      if (!c) return { error: "Cliente no encontrado" }
      customerId = c.id
    } else {
      return { error: "customer_slug es requerido para staff" }
    }
    if (!customerId) return { error: "Cliente requerido" }

    const result = await prisma.$transaction(async (tx) => {
      const code = await generateTicketCode(tx, "SUPPORT")
      return tx.ticket.create({
        data: {
          code,
          type: "SUPPORT",
          title,
          description,
          priority,
          customerId,
          systemId,
          createdById: ctx.userId || null,
          tags: ["ai-created"],
        },
        select: { id: true, code: true },
      })
    })

    // Reindexa para que aparezca en RAG inmediatamente
    indexTicket(result.id).catch(() => {})

    return { ok: true, code: result.code, ticket_id: result.id, message: `Ticket ${result.code} creado` }
  },

  async update_ticket_status(input, ctx) {
    const code = String(input.code ?? "")
    const status = String(input.status ?? "") as
      | "OPEN" | "IN_PROGRESS" | "WAITING_CLIENT" | "RESOLVED" | "CLOSED" | "CANCELLED"

    const ticket = await prisma.ticket.findUnique({ where: { code } })
    if (!ticket) return { error: "Ticket no encontrado" }
    if (ctx.role === "CLIENT" && ticket.customerId !== ctx.customerId) {
      return { error: "No autorizado" }
    }

    const now = new Date()
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? now : status === "OPEN" ? null : undefined,
        closedAt: status === "CLOSED" || status === "CANCELLED" ? now : undefined,
      },
    })

    await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: ctx.userId || null,
        body: `🤖 La IA cambió el estado a **${status.replace("_", " ")}**`,
        source: "AI",
      },
    })

    indexTicket(ticket.id).catch(() => {})
    return { ok: true, message: `Estado actualizado a ${status}` }
  },

  async add_ticket_comment(input, ctx) {
    const code = String(input.code ?? "")
    const body = String(input.body ?? "").trim()
    const isInternal = !!input.is_internal && ctx.role !== "CLIENT"

    if (!body) return { error: "Body vacío" }

    const ticket = await prisma.ticket.findUnique({ where: { code } })
    if (!ticket) return { error: "Ticket no encontrado" }
    if (ctx.role === "CLIENT" && ticket.customerId !== ctx.customerId) {
      return { error: "No autorizado" }
    }

    await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: ctx.userId || null,
        body,
        isInternal,
        source: "AI",
      },
    })

    indexTicket(ticket.id).catch(() => {})
    return { ok: true, message: "Comentario agregado" }
  },
}
