import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { generateTicketCode } from "@/lib/ticket-codes"
import { indexTicket } from "@/lib/ai-indexer"
import { notifyTicketCreated, notifyTicketComment } from "@/lib/notifications"
import { getRequestIp, rateLimitResponse } from "@/lib/rate-limit"
import { logActivity } from "@/lib/audit"
import { agentLogger } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Payload flexible: aceptamos el formato de Resend inbound u otros similares.
const schema = z.object({
  type: z.string().optional(),
  data: z
    .object({
      from: z.union([z.string(), z.object({ address: z.string() })]).optional(),
      to: z.union([z.string(), z.array(z.string())]).optional(),
      subject: z.string().optional(),
      text: z.string().optional(),
      html: z.string().optional(),
    })
    .optional(),
  // Algunos proveedores mandan estos campos en el root
  from: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
})

function extractEmail(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "object" && value !== null && "address" in value) {
    return String((value as { address: string }).address).toLowerCase()
  }
  const s = String(value)
  // "Nombre <email@dom.com>" → email@dom.com
  const m = /<([^>]+)>/.exec(s)
  const email = (m ? m[1] : s).trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+$/.test(email) ? email : null
}

/** Quita el hilo citado de una respuesta de email. */
function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    // Corta en marcadores típicos de reply
    if (/^>/.test(line)) break
    if (/^On .* wrote:$/.test(line.trim())) break
    if (/^El .* escribió:$/.test(line.trim())) break
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break
    out.push(line)
  }
  return out.join("\n").trim()
}

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req.headers)
  const rl = rateLimitResponse(ip, "inbound-email", 60, 60_000)
  if (rl) return rl

  // Autenticación: token compartido en query (?token=) o header.
  // Para producción con Resend, se puede reemplazar por verificación Svix.
  const secret = process.env.INBOUND_EMAIL_SECRET
  if (secret) {
    const provided =
      req.nextUrl.searchParams.get("token") ||
      /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 422 })
  }

  const d = parsed.data
  const fromEmail = extractEmail(d.data?.from ?? d.from)
  const subject = (d.data?.subject ?? d.subject ?? "").trim()
  const rawText = d.data?.text ?? d.text ?? ""
  const text = stripQuoted(rawText) || rawText.trim()

  if (!fromEmail) {
    agentLogger.warn({ subject }, "inbound_email_no_from")
    return NextResponse.json({ ok: true, ignored: "no_from" })
  }

  // 1. ¿El subject referencia un ticket existente? (TKT-0001 / IMP-0042)
  const codeMatch = /\b((?:TKT|IMP)-\d{1,6})\b/i.exec(subject)
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase()
    const ticket = await prisma.ticket.findUnique({ where: { code }, select: { id: true, customerId: true } })
    if (ticket) {
      // Validar que el remitente pertenezca al cliente del ticket (o sea staff)
      const sender = await prisma.user.findUnique({ where: { email: fromEmail }, select: { id: true, role: true, customerId: true } })
      const authorized =
        sender &&
        (sender.role !== "CLIENT" || sender.customerId === ticket.customerId)

      const comment = await prisma.ticketComment.create({
        data: {
          ticketId: ticket.id,
          authorId: authorized ? sender!.id : null,
          body: `📧 **Email de ${fromEmail}**\n\n${text || "(sin contenido)"}`,
          source: "USER",
        },
      })
      indexTicket(ticket.id).catch(() => {})
      notifyTicketComment(ticket.id, comment.id, authorized ? sender!.id : null).catch(() => {})
      logActivity({
        userId: authorized ? sender!.id : null,
        entityType: "ticket_comment",
        entityId: comment.id,
        action: "create",
        diff: { via: "email", from: fromEmail, ticket: code },
      })
      return NextResponse.json({ ok: true, action: "comment_appended", ticket: code })
    }
  }

  // 2. Crear ticket nuevo. Mapear el remitente a un cliente.
  let customerId: string | null = null
  let createdById: string | null = null

  const senderUser = await prisma.user.findUnique({
    where: { email: fromEmail },
    select: { id: true, customerId: true, role: true },
  })
  if (senderUser?.customerId) {
    customerId = senderUser.customerId
    createdById = senderUser.id
  } else {
    // Buscar como contacto de algún cliente
    const contact = await prisma.contact.findFirst({
      where: { email: fromEmail },
      select: { customerId: true },
    })
    if (contact) customerId = contact.customerId
  }

  if (!customerId) {
    agentLogger.warn({ fromEmail, subject }, "inbound_email_unmapped_sender")
    // 200 para que el proveedor no reintente; queda registrado en logs
    return NextResponse.json({ ok: true, ignored: "unmapped_sender" })
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const code = await generateTicketCode(tx, "SUPPORT")
    return tx.ticket.create({
      data: {
        code,
        type: "SUPPORT",
        title: subject || `Email de ${fromEmail}`,
        description: `${text || "(sin contenido)"}\n\n— Recibido por email de ${fromEmail}`,
        priority: "MEDIUM",
        customerId: customerId!,
        createdById,
        tags: ["email"],
      },
      select: { id: true, code: true },
    })
  })

  indexTicket(ticket.id).catch(() => {})
  notifyTicketCreated(ticket.id, createdById).catch(() => {})
  logActivity({
    userId: createdById,
    entityType: "ticket",
    entityId: ticket.id,
    action: "create",
    diff: { via: "email", from: fromEmail },
  })

  return NextResponse.json({ ok: true, action: "ticket_created", ticket: ticket.code })
}
