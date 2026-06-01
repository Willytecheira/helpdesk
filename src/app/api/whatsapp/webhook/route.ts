import { NextResponse, type NextRequest } from "next/server"
import type { ModelMessage } from "ai"
import { prisma } from "@/lib/prisma"
import { generateTicketCode } from "@/lib/ticket-codes"
import { indexTicket } from "@/lib/ai-indexer"
import { notifyTicketCreated, notifyTicketComment } from "@/lib/notifications"
import { getRequestIp, rateLimitResponse } from "@/lib/rate-limit"
import { logActivity } from "@/lib/audit"
import { agentLogger } from "@/lib/logger"
import { getEvolutionConfig } from "@/lib/integrations"
import { jidToNumber, isGroupJid, sendWhatsappText } from "@/lib/evolution"
import { runAgentReply, WHATSAPP_TOOLS } from "@/lib/ai/run-agent"
import type { AiToolContext } from "@/lib/ai-tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] as const

/** Extrae el texto de un objeto `message` de WhatsApp (varias formas posibles). */
function extractText(message: unknown): string {
  if (!message || typeof message !== "object") return ""
  const m = message as Record<string, unknown>
  const get = (o: unknown, k: string): string | undefined => {
    if (o && typeof o === "object" && k in o) {
      const v = (o as Record<string, unknown>)[k]
      return typeof v === "string" ? v : undefined
    }
    return undefined
  }
  return (
    get(m, "conversation") ??
    get(m.extendedTextMessage, "text") ??
    get(m.imageMessage, "caption") ??
    get(m.videoMessage, "caption") ??
    get(m.documentMessage, "caption") ??
    get(m.buttonsResponseMessage, "selectedDisplayText") ??
    get(m.listResponseMessage, "title") ??
    ""
  ).trim()
}

/** Busca el cliente al que pertenece un número (por contacto o por teléfono del cliente). */
async function mapNumberToCustomer(number: string): Promise<string | null> {
  const last8 = number.slice(-8)
  if (last8.length >= 6) {
    const contact = await prisma.contact.findFirst({
      where: { phone: { contains: last8 } },
      select: { customerId: true },
    })
    if (contact) return contact.customerId

    const customer = await prisma.customer.findFirst({
      where: { phone: { contains: last8 } },
      select: { id: true },
    })
    if (customer) return customer.id
  }
  return null
}

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req.headers)
  const rl = rateLimitResponse(ip, "wa-inbound", 120, 60_000)
  if (rl) return rl

  const cfg = await getEvolutionConfig()

  // Autenticación: token en ?token= o header Authorization Bearer.
  if (cfg.webhookToken) {
    const provided =
      req.nextUrl.searchParams.get("token") ||
      /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]
    if (provided !== cfg.webhookToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  // Evolution puede mandar un objeto o (raro) un array de eventos.
  const events = Array.isArray(body) ? body : [body]

  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue
    const e = ev as Record<string, unknown>
    const eventName = String(e.event ?? "").toLowerCase().replace(/_/g, ".")
    if (eventName && eventName !== "messages.upsert") continue

    const data = e.data as Record<string, unknown> | undefined
    if (!data) continue
    const key = data.key as Record<string, unknown> | undefined
    const remoteJid = String(key?.remoteJid ?? "")
    const fromMe = key?.fromMe === true

    // Ignorar: mensajes propios (evita loop), grupos, sin JID
    if (fromMe || !remoteJid || isGroupJid(remoteJid)) continue

    const text = extractText(data.message)
    const pushName = typeof data.pushName === "string" ? data.pushName : null
    const number = jidToNumber(remoteJid)
    if (!number) continue

    try {
      await handleIncoming({ number, text, pushName, cfg })
    } catch (err) {
      agentLogger.error(
        { err: String(err), number: number.slice(-4) },
        "wa_inbound_handle_error"
      )
    }
  }

  // Siempre 200 para que Evolution no reintente en loop.
  return NextResponse.json({ ok: true })
}

async function handleIncoming(opts: {
  number: string
  text: string
  pushName: string | null
  cfg: Awaited<ReturnType<typeof getEvolutionConfig>>
}) {
  const { number, text, pushName, cfg } = opts
  const display = pushName ? `${pushName} (${number})` : number
  const messageText = text || "(mensaje sin texto)"

  // 1. ¿Hay un ticket de WhatsApp abierto para este número?
  let ticket = await prisma.ticket.findFirst({
    where: {
      channel: "WHATSAPP",
      channelRef: number,
      status: { in: [...OPEN_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, customerId: true },
  })

  if (ticket) {
    // Anexar el mensaje entrante como comentario
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: null,
        body: messageText,
        source: "USER",
      },
    })
    indexTicket(ticket.id).catch(() => {})
    notifyTicketComment(ticket.id, comment.id, null).catch(() => {})
    logActivity({
      userId: null,
      entityType: "ticket_comment",
      entityId: comment.id,
      action: "create",
      diff: { via: "whatsapp", from: number, ticket: ticket.code },
    })
  } else {
    // 2. Crear ticket nuevo. Mapear número → cliente (o usar el cliente por defecto).
    let customerId = await mapNumberToCustomer(number)
    if (!customerId && cfg.defaultCustomerId) customerId = cfg.defaultCustomerId

    if (!customerId) {
      agentLogger.warn({ from: number }, "wa_inbound_unmapped_number")
      // Sin cliente no podemos crear ticket. Avisamos por WhatsApp si hay auto-reply.
      if (cfg.autoReply) {
        await sendWhatsappText(
          number,
          "Hola 👋 No pudimos identificar tu cuenta. Un agente se va a contactar a la brevedad."
        )
      }
      return
    }

    const title = messageText.replace(/\s+/g, " ").slice(0, 80) || `WhatsApp de ${number}`
    const created = await prisma.$transaction(async (tx) => {
      const code = await generateTicketCode(tx, "SUPPORT")
      return tx.ticket.create({
        data: {
          code,
          type: "SUPPORT",
          title,
          description: `${messageText}\n\n— Recibido por WhatsApp de ${display}`,
          priority: "MEDIUM",
          status: "OPEN",
          channel: "WHATSAPP",
          channelRef: number,
          customerId,
          tags: ["whatsapp"],
        },
        select: { id: true, code: true, customerId: true },
      })
    })
    ticket = created

    indexTicket(ticket.id).catch(() => {})
    notifyTicketCreated(ticket.id, null).catch(() => {})
    logActivity({
      userId: null,
      entityType: "ticket",
      entityId: ticket.id,
      action: "create",
      diff: { via: "whatsapp", from: number },
    })
  }

  // 3. Auto-respuesta del agente IA (si está habilitada)
  if (!cfg.autoReply) return

  const history = await buildHistory(ticket.id)

  const ctx: AiToolContext = {
    userId: "",
    role: "CLIENT",
    customerId: ticket.customerId,
  }

  // Contexto del cliente: el agente debe conocer los recursos SIN preguntarle el nombre.
  const customer = await prisma.customer.findUnique({
    where: { id: ticket.customerId },
    select: {
      name: true,
      slug: true,
      servers: { select: { name: true }, orderBy: { name: "asc" } },
      systems: { select: { name: true }, orderBy: { name: "asc" } },
    },
  })
  const serverNames = customer?.servers.map((s) => s.name) ?? []
  const systemNames = customer?.systems.map((s) => s.name) ?? []

  const serverGuidance =
    serverNames.length === 1
      ? `El cliente tiene UN solo servidor ("${serverNames[0]}"). Cuando hable de "el servidor", usá get_server_status con ese nombre y dale el estado directamente, SIN preguntar cuál.`
      : serverNames.length > 1
        ? "El cliente tiene VARIOS servidores. Si no aclaró cuál, ofrecele la lista para que elija; no le pidas el nombre como si no lo supieras."
        : "El cliente no tiene servidores registrados; si pregunta por uno, avisáselo."

  const extraSystem = [
    "Estás respondiendo a un cliente por WhatsApp.",
    "Respuestas BREVES y en texto plano (sin tablas ni markdown complejo; emojis ok con moderación).",
    `Este es el ticket ${ticket.code}.`,
    `Si lograste resolver el problema, marcá el ticket como RESUELTO usando la herramienta update_ticket_status (code="${ticket.code}", status="RESOLVED") y recién después confirmáselo al cliente. No digas que lo resolviste si no llamaste a la herramienta.`,
    "Si no podés resolverlo o requiere intervención humana, dejá el ticket abierto y avisá que derivás a un agente.",
    "",
    "--- Recursos de este cliente (ya los conocés, NO se los preguntes) ---",
    customer ? `Cliente: ${customer.name} (slug: ${customer.slug}).` : "",
    `Servidores (${serverNames.length}): ${serverNames.join(", ") || "ninguno"}.`,
    `Sistemas (${systemNames.length}): ${systemNames.join(", ") || "ninguno"}.`,
    serverGuidance,
  ]
    .filter(Boolean)
    .join("\n")

  const reply = await runAgentReply({
    agentId: cfg.agentId,
    ctx,
    messages: history,
    toolAllowlist: WHATSAPP_TOOLS,
    extraSystem,
  })

  if (!reply || !reply.text) {
    agentLogger.warn({ ticket: ticket.code }, "wa_no_agent_reply")
    return
  }

  // Enviar por WhatsApp y registrar como comentario AI
  const sent = await sendWhatsappText(number, reply.text)
  await prisma.ticketComment.create({
    data: {
      ticketId: ticket.id,
      authorId: null,
      body: reply.text,
      source: "AI",
    },
  })
  indexTicket(ticket.id).catch(() => {})

  if (!sent) {
    agentLogger.warn({ ticket: ticket.code }, "wa_reply_send_failed")
  }
}

/**
 * Arma la conversación como un ÚNICO mensaje de usuario con el transcript completo.
 * Evita problemas de alternancia de roles (Anthropic exige empezar por "user" y
 * alternar) y le da al modelo TODO el hilo, así no se queda en loop ni ignora que
 * el cliente ya dijo que se solucionó.
 */
async function buildHistory(ticketId: string): Promise<ModelMessage[]> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      description: true,
      comments: {
        where: { isInternal: false, source: { in: ["USER", "AI"] } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { body: true, source: true },
      },
    },
  })

  const lines: string[] = []
  if (ticket) {
    // El primer mensaje del cliente quedó en la descripción del ticket.
    const firstMsg = ticket.description.split("\n\n— Recibido")[0].trim()
    if (firstMsg) lines.push(`Cliente: ${firstMsg}`)
    for (const c of [...ticket.comments].reverse()) {
      if (c.source === "AI" && c.body.startsWith("🤖")) continue // notas de cambio de estado
      lines.push(`${c.source === "AI" ? "Agente" : "Cliente"}: ${c.body}`)
    }
  }

  const transcript =
    "Conversación con el cliente por WhatsApp hasta ahora:\n\n" +
    (lines.join("\n") || "Cliente: Hola") +
    "\n\nRespondé SOLO al último mensaje del cliente, teniendo en cuenta todo el hilo. " +
    "No repitas pasos que el cliente ya hizo. Si el cliente indica que el problema se solucionó " +
    "(p. ej. 'ya funciona', 'se arregló', 'gracias'), confirmá brevemente y marcá el ticket como " +
    "RESUELTO con la herramienta update_ticket_status."

  return [{ role: "user", content: transcript }]
}
