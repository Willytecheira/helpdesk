"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { hashToken } from "@/lib/tokens"
import { authLogger } from "@/lib/logger"
import { logActivity } from "@/lib/audit"

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: "Las contraseñas no coinciden",
  path: ["passwordConfirm"],
})

function fieldErrors<T>(p: z.ZodSafeParseError<T>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

export async function resetPassword(
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  const parsed = schema.safeParse({
    token: fd.get("token"),
    password: fd.get("password"),
    passwordConfirm: fd.get("passwordConfirm"),
  })
  if (!parsed.success) return actionError("Revisá los campos", fieldErrors(parsed))

  const tokenHash = hashToken(parsed.data.token)
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return actionError("El link es inválido o expiró. Pedí uno nuevo.")
  }

  const hash = await bcrypt.hash(parsed.data.password, 10)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        password: hash,
        emailVerified: new Date(),
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])

  authLogger.info({ userId: record.userId }, "password_reset_completed")
  logActivity({
    userId: record.userId,
    entityType: "user",
    entityId: record.userId,
    action: "update",
    diff: { passwordReset: true },
  })

  return actionOk()
}
