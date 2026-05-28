"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import {
  generateSetup,
  generateRecoveryCodes,
  hashRecovery,
  verifyTotp,
} from "@/lib/totp"
import { encryptString, decryptString } from "@/lib/crypto"
import { logActivity } from "@/lib/audit"

// Stash temporal del secret en cookie/memory no es buena idea; lo guardamos
// en el user pero NO habilitamos 2FA hasta que confirme con un código válido.
// Reutilizamos twoFactorSecret cifrado y twoFactorEnabled=false hasta confirmar.

export async function startTotpSetup(): Promise<ActionResult<{ secret: string; otpauthUrl: string }>> {
  const me = await requireUser()
  const user = await prisma.user.findUnique({ where: { id: me.id }, select: { email: true } })
  if (!user) return actionError("Usuario no encontrado")

  const { secret, otpauthUrl } = generateSetup(user.email)
  await prisma.user.update({
    where: { id: me.id },
    data: {
      twoFactorSecret: encryptString(secret),
      twoFactorEnabled: false,
    },
  })
  return actionOk({ secret, otpauthUrl })
}

const confirmSchema = z.object({ code: z.string().min(6).max(6) })

export async function confirmTotp(
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const me = await requireUser()
  const parsed = confirmSchema.safeParse({ code: String(fd.get("code") ?? "").replace(/\s+/g, "") })
  if (!parsed.success) return actionError("Código inválido")

  const user = await prisma.user.findUnique({ where: { id: me.id } })
  if (!user?.twoFactorSecret) return actionError("Primero generá el código QR")
  const secret = decryptString(user.twoFactorSecret)
  if (!verifyTotp(secret, parsed.data.code)) {
    return actionError("Código incorrecto. Probá de nuevo.")
  }

  const recoveryCodes = generateRecoveryCodes()
  const hashed = recoveryCodes.map(hashRecovery)
  await prisma.user.update({
    where: { id: me.id },
    data: {
      twoFactorEnabled: true,
      twoFactorRecovery: JSON.stringify(hashed),
    },
  })
  logActivity({
    userId: me.id,
    entityType: "user",
    entityId: me.id,
    action: "update",
    diff: { twoFactorEnabled: true },
  })
  revalidatePath("/profile")
  return actionOk({ recoveryCodes })
}

const disableSchema = z.object({ code: z.string().min(6).max(15) })

export async function disableTotp(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireUser()
  const parsed = disableSchema.safeParse({ code: String(fd.get("code") ?? "").replace(/[\s-]/g, "") })
  if (!parsed.success) return actionError("Código inválido")

  const { verifyTotpCode } = await import("@/lib/totp")
  const ok = await verifyTotpCode(me.id, parsed.data.code)
  if (!ok) return actionError("Código incorrecto")

  await prisma.user.update({
    where: { id: me.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecovery: null,
    },
  })
  logActivity({
    userId: me.id,
    entityType: "user",
    entityId: me.id,
    action: "update",
    diff: { twoFactorEnabled: false },
  })
  revalidatePath("/profile")
  return actionOk()
}
