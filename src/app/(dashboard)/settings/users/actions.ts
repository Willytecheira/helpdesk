"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { generateToken, hashToken } from "@/lib/tokens"
import { sendMail, emailEnabled } from "@/lib/email"
import { getResendConfig } from "@/lib/integrations"
import { logActivity } from "@/lib/audit"

const inviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "AGENT", "CLIENT"]),
  customerId: z.string().optional().or(z.literal("")),
  sendInvite: z.coerce.boolean().optional(),
})

function fieldErrors<T>(p: z.ZodSafeParseError<T>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

export async function inviteUser(
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult<{ id: string; setPasswordUrl?: string }>> {
  const me = await requireAdmin()
  const parsed = inviteSchema.safeParse({
    name: fd.get("name"),
    email: fd.get("email"),
    role: fd.get("role"),
    customerId: fd.get("customerId") || undefined,
    sendInvite: fd.get("sendInvite") === "on",
  })
  if (!parsed.success) return actionError("Revisá los campos", fieldErrors(parsed))
  const d = parsed.data

  if (d.role === "CLIENT" && !d.customerId) {
    return actionError("Un cliente debe estar vinculado a un customer", {
      customerId: "Requerido para CLIENT",
    })
  }

  const email = d.email.toLowerCase().trim()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return actionError("Ya existe un usuario con ese email", { email: "Ya registrado" })
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: d.name.trim(),
      role: d.role,
      customerId: d.role === "CLIENT" ? d.customerId : null,
      password: null, // se setea con la invitación
      active: true,
    },
  })

  // Token de set-password (válido 7 días)
  const token = generateToken()
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const { baseUrl } = await getResendConfig()
  const setPasswordUrl = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`

  logActivity({
    userId: me.id,
    entityType: "user",
    entityId: user.id,
    action: "create",
    diff: { email, role: d.role, invitedBy: me.email },
  })

  // Si Resend está configurado y el admin pidió mandar invitación, lo envía
  if (d.sendInvite && (await emailEnabled())) {
    await sendMail({
      to: email,
      subject: "Tenés una invitación al Helpdesk",
      html: `
        <p>Hola ${escapeHtml(d.name)},</p>
        <p><strong>${escapeHtml(me.name ?? me.email!)}</strong> te invitó al Helpdesk.</p>
        <p>Para activar tu cuenta y elegir tu contraseña, ingresá al siguiente link (válido 7 días):</p>
        <p><a href="${setPasswordUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Activar mi cuenta</a></p>
        <p style="font-size:12px;color:#64748b">Si el botón no funciona, copiá este link: ${setPasswordUrl}</p>
      `,
    })
  }

  revalidatePath("/settings/users")
  return actionOk({ id: user.id, setPasswordUrl })
}

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "AGENT", "CLIENT"]).optional(),
  customerId: z.string().optional().or(z.literal("")),
  active: z.coerce.boolean().optional(),
})

export async function updateUser(
  id: string,
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  const me = await requireAdmin()
  const parsed = updateSchema.safeParse({
    name: fd.get("name") || undefined,
    email: fd.get("email") || undefined,
    role: fd.get("role") || undefined,
    customerId: fd.get("customerId") || undefined,
    active: fd.get("active") === "on",
  })
  if (!parsed.success) return actionError("Datos inválidos", fieldErrors(parsed))

  // Evitar que el admin se baje a sí mismo o se desactive
  if (id === me.id && parsed.data.role && parsed.data.role !== "ADMIN") {
    return actionError("No podés bajarte el rol a vos mismo")
  }
  if (id === me.id && parsed.data.active === false) {
    return actionError("No podés desactivar tu propia cuenta")
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.name && { name: parsed.data.name.trim() }),
        ...(parsed.data.email && { email: parsed.data.email.toLowerCase().trim() }),
        ...(parsed.data.role && { role: parsed.data.role }),
        ...(parsed.data.role === "CLIENT"
          ? { customerId: parsed.data.customerId || null }
          : parsed.data.role
            ? { customerId: null }
            : {}),
        ...(parsed.data.active !== undefined && { active: parsed.data.active }),
        // Si se desactiva o cambia rol/customer, invalidar sesiones existentes
        tokenVersion: { increment: 1 },
      },
    })
    logActivity({
      userId: me.id,
      entityType: "user",
      entityId: id,
      action: "update",
      diff: parsed.data,
    })
    revalidatePath("/settings/users")
    return actionOk()
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Ese email ya está en uso", { email: "Ya en uso" })
    }
    return actionError("No se pudo actualizar")
  }
}

export async function revokeUserSessions(id: string): Promise<ActionResult> {
  const me = await requireAdmin()
  await prisma.user.update({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  })
  logActivity({
    userId: me.id,
    entityType: "session",
    entityId: id,
    action: "logout",
    diff: { reason: "admin_revoke_all" },
  })
  revalidatePath("/settings/users")
  return actionOk()
}

export async function resendInvite(id: string): Promise<ActionResult> {
  const me = await requireAdmin()
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return actionError("Usuario no encontrado")

  if (!(await emailEnabled())) {
    return actionError("Resend no está configurado. Activá la integración primero.")
  }

  // Borrar tokens previos
  await prisma.passwordResetToken.deleteMany({
    where: { userId: id, usedAt: null },
  })

  const token = generateToken()
  await prisma.passwordResetToken.create({
    data: {
      userId: id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const { baseUrl } = await getResendConfig()
  const url = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`

  const result = await sendMail({
    to: user.email,
    subject: "Helpdesk · re-envío de invitación",
    html: `
      <p>Hola ${escapeHtml(user.name ?? user.email)},</p>
      <p><strong>${escapeHtml(me.name ?? me.email!)}</strong> te re-envió la invitación al Helpdesk.</p>
      <p><a href="${url}">Activar mi cuenta</a></p>
    `,
  })
  if (!result.ok) return actionError(result.error ?? "No se pudo enviar")

  return actionOk()
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
