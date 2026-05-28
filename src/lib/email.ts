import { Resend } from "resend"
import { prisma } from "@/lib/prisma"
import { getResendConfig } from "@/lib/integrations"

let cached: { client: Resend; apiKey: string } | null = null

async function getClient() {
  const { apiKey, from, baseUrl } = await getResendConfig()
  if (!apiKey) return null
  if (cached && cached.apiKey === apiKey) {
    return { client: cached.client, from, baseUrl }
  }
  const client = new Resend(apiKey)
  cached = { client, apiKey }
  return { client, from, baseUrl }
}

export async function emailEnabled(): Promise<boolean> {
  const { apiKey } = await getResendConfig()
  return !!apiKey
}

type SendOptions = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendMail(opts: SendOptions): Promise<{ ok: boolean; error?: string }> {
  const c = await getClient()
  if (!c) return { ok: false, error: "email_disabled" }
  try {
    await c.client.emails.send({
      from: c.from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" }
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function layout(title: string, body: string, ctaUrl?: string, ctaLabel?: string) {
  return `
<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f4f4f5;padding:24px;color:#18181b">
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden">
    <tr><td style="background:#0f172a;color:#fff;padding:14px 20px;font-weight:600">${escapeHtml(title)}</td></tr>
    <tr><td style="padding:20px;font-size:14px;line-height:1.55">
      ${body}
      ${ctaUrl ? `<p style="margin:24px 0 4px"><a href="${ctaUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500">${escapeHtml(ctaLabel || "Abrir")}</a></p>` : ""}
    </td></tr>
    <tr><td style="padding:14px 20px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a">
      Este mensaje fue enviado por tu Helpdesk. No respondas a este email.
    </td></tr>
  </table>
</body></html>`.trim()
}

// ---------------- Triggers de negocio ----------------

export async function notifyTicketCreated(ticketId: string, actorId: string | null) {
  if (!(await emailEnabled())) return

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      customer: { select: { id: true, name: true } },
      assignedTo: { select: { email: true, name: true } },
    },
  })
  if (!ticket) return

  const { baseUrl } = await getResendConfig()
  const url = `${baseUrl.replace(/\/$/, "")}/tickets/${ticket.id}`

  // Notificar a los staff (admins + asignado)
  const recipients = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "AGENT"] }, id: { not: actorId ?? undefined } },
    select: { email: true },
  })
  const emails = Array.from(new Set(recipients.map((r) => r.email))).filter(Boolean)
  if (emails.length === 0) return

  const subject = `[${ticket.code}] ${ticket.priority === "URGENT" ? "🚨 " : ""}${ticket.title}`
  const html = layout(
    `Nuevo ticket · ${ticket.code}`,
    `
    <p><strong>${escapeHtml(ticket.title)}</strong></p>
    <p style="color:#52525b"><strong>Cliente:</strong> ${escapeHtml(ticket.customer.name)} · <strong>Prioridad:</strong> ${ticket.priority}</p>
    <p style="white-space:pre-wrap">${escapeHtml(ticket.description.slice(0, 600))}${ticket.description.length > 600 ? "…" : ""}</p>
    ${ticket.assignedTo ? `<p style="color:#52525b"><strong>Asignado:</strong> ${escapeHtml(ticket.assignedTo.name || ticket.assignedTo.email)}</p>` : ""}
    `,
    url,
    "Ver ticket"
  )

  await sendMail({ to: emails, subject, html })
}

export async function notifyTicketComment(
  ticketId: string,
  commentId: string,
  actorId: string | null
) {
  if (!(await emailEnabled())) return

  const [ticket, comment] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        customer: { include: { users: { where: { role: "CLIENT" }, select: { email: true } } } },
        assignedTo: { select: { email: true, id: true } },
        createdBy: { select: { email: true, id: true } },
      },
    }),
    prisma.ticketComment.findUnique({
      where: { id: commentId },
      include: { author: { select: { name: true, email: true, role: true } } },
    }),
  ])
  if (!ticket || !comment) return
  if (comment.source === "SYSTEM") return

  const { baseUrl } = await getResendConfig()
  const url = `${baseUrl.replace(/\/$/, "")}/tickets/${ticket.id}`

  // Si es interno, sólo staff
  const recipientEmails = new Set<string>()
  if (comment.isInternal) {
    const staff = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "AGENT"] }, id: { not: actorId ?? undefined } },
      select: { email: true },
    })
    staff.forEach((s) => recipientEmails.add(s.email))
  } else {
    // Si el actor es CLIENT → notificar a staff. Si el actor es staff/IA → notificar al cliente.
    if (comment.author?.role === "CLIENT") {
      const staff = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "AGENT"] }, id: { not: actorId ?? undefined } },
        select: { email: true },
      })
      staff.forEach((s) => recipientEmails.add(s.email))
    } else {
      ticket.customer.users.forEach((u) => recipientEmails.add(u.email))
    }
  }

  const emails = Array.from(recipientEmails).filter(Boolean)
  if (emails.length === 0) return

  const authorName =
    comment.source === "AI"
      ? "Asistente IA"
      : (comment.author?.name ?? comment.author?.email ?? "Sistema")

  const subject = `[${ticket.code}] Nuevo comentario de ${authorName}`
  const html = layout(
    `${ticket.code} · ${ticket.title}`,
    `
    <p><strong>${escapeHtml(authorName)}</strong> escribió:</p>
    <blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #d4d4d8;background:#fafafa;white-space:pre-wrap;color:#3f3f46">${escapeHtml(comment.body.slice(0, 800))}${comment.body.length > 800 ? "…" : ""}</blockquote>
    ${comment.isInternal ? '<p style="color:#a16207;font-size:12px;font-weight:500">⚠ Nota interna (sólo visible al staff)</p>' : ""}
    `,
    url,
    "Responder en Helpdesk"
  )

  await sendMail({ to: emails, subject, html })
}

export async function notifyTicketStatusChanged(
  ticketId: string,
  newStatus: string,
  actorId: string | null
) {
  if (!(await emailEnabled())) return
  if (newStatus !== "RESOLVED" && newStatus !== "CLOSED" && newStatus !== "WAITING_CLIENT") return

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      customer: { include: { users: { where: { role: "CLIENT" }, select: { email: true } } } },
    },
  })
  if (!ticket) return

  // Sólo notificar al cliente si el actor fue staff
  const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } }) : null
  if (actor?.role === "CLIENT") return

  const { baseUrl } = await getResendConfig()
  const url = `${baseUrl.replace(/\/$/, "")}/tickets/${ticket.id}`
  const emails = ticket.customer.users.map((u) => u.email).filter(Boolean)
  if (emails.length === 0) return

  const statusLabel: Record<string, string> = {
    RESOLVED: "marcado como resuelto",
    CLOSED: "cerrado",
    WAITING_CLIENT: "esperando tu respuesta",
  }

  const subject = `[${ticket.code}] Tu ticket fue ${statusLabel[newStatus]}`
  const html = layout(
    `${ticket.code} · ${ticket.title}`,
    `<p>Tu ticket fue <strong>${escapeHtml(statusLabel[newStatus])}</strong>.</p>`,
    url,
    "Ver ticket"
  )
  await sendMail({ to: emails, subject, html })
}
