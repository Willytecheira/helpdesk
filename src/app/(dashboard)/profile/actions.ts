"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { logActivity } from "@/lib/audit"

const profileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
})

function fieldErrors<T>(p: z.ZodSafeParseError<T>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

export async function updateProfile(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireUser()
  const parsed = profileSchema.safeParse({
    name: fd.get("name"),
    email: fd.get("email"),
  })
  if (!parsed.success) return actionError("Datos inválidos", fieldErrors(parsed))

  try {
    await prisma.user.update({
      where: { id: me.id },
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email.toLowerCase().trim(),
      },
    })
    revalidatePath("/profile")
    return actionOk()
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Ese email ya está en uso", { email: "Ya en uso" })
    }
    return actionError("No se pudo actualizar")
  }
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

export async function changePassword(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireUser()
  const parsed = passwordSchema.safeParse({
    currentPassword: fd.get("currentPassword"),
    newPassword: fd.get("newPassword"),
    confirmPassword: fd.get("confirmPassword"),
  })
  if (!parsed.success) return actionError("Datos inválidos", fieldErrors(parsed))

  const user = await prisma.user.findUnique({ where: { id: me.id } })
  if (!user || !user.password) return actionError("No se pudo verificar")

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!valid) {
    return actionError("Contraseña actual incorrecta", {
      currentPassword: "Incorrecta",
    })
  }

  const hash = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({
    where: { id: me.id },
    data: {
      password: hash,
      tokenVersion: { increment: 1 }, // cierra otras sesiones
    },
  })
  logActivity({
    userId: me.id,
    entityType: "user",
    entityId: me.id,
    action: "update",
    diff: { passwordChanged: true },
  })
  revalidatePath("/profile")
  return actionOk()
}

export async function revokeMySessions(): Promise<ActionResult> {
  const me = await requireUser()
  await prisma.user.update({
    where: { id: me.id },
    data: { tokenVersion: { increment: 1 } },
  })
  logActivity({
    userId: me.id,
    entityType: "session",
    entityId: me.id,
    action: "logout",
    diff: { reason: "self_revoke_all" },
  })
  return actionOk()
}
