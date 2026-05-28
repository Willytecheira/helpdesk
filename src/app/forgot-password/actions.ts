"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { generateToken, hashToken } from "@/lib/tokens"
import { sendMail, emailEnabled } from "@/lib/email"
import { getResendConfig } from "@/lib/integrations"
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit"
import { authLogger } from "@/lib/logger"

const schema = z.object({ email: z.string().email() })

export async function requestPasswordReset(
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  const parsed = schema.safeParse({ email: fd.get("email") })
  if (!parsed.success) return actionError("Email inválido")

  // Rate limit por IP y por email para no permitir enumeration
  const h = await headers()
  const ip = getRequestIp(h)
  if (!checkRateLimit(`pwreq-ip:${ip}`, 5, 60_000).ok) {
    return actionError("Demasiados intentos. Probá en un minuto.")
  }
  const email = parsed.data.email.toLowerCase().trim()
  if (!checkRateLimit(`pwreq-email:${email}`, 3, 3600_000).ok) {
    return actionError("Demasiados intentos para este email. Probá más tarde.")
  }

  const user = await prisma.user.findUnique({ where: { email } })
  // Respuesta intencionalmente idéntica si el user existe o no (anti-enumeración)
  if (!user || !user.active) {
    return actionOk()
  }

  if (!(await emailEnabled())) {
    authLogger.warn({ email }, "password_reset_requested_but_email_disabled")
    return actionError("El envío de emails no está configurado. Pedile al admin.")
  }

  // Borrar tokens previos no usados
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  })

  const token = generateToken()
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
    },
  })

  const { baseUrl } = await getResendConfig()
  const url = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`

  await sendMail({
    to: user.email,
    subject: "Helpdesk · restablecer contraseña",
    html: `
      <p>Hola ${escapeHtml(user.name ?? user.email)},</p>
      <p>Recibimos un pedido para restablecer tu contraseña. El link es válido por 1 hora:</p>
      <p><a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Restablecer contraseña</a></p>
      <p style="font-size:12px;color:#64748b">Si no fuiste vos, ignorá este email.</p>
    `,
  })

  authLogger.info({ userId: user.id }, "password_reset_link_sent")
  return actionOk()
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
