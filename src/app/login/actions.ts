"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { AuthError } from "next-auth"
import { signIn } from "@/auth"
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit"
import { logActivity } from "@/lib/audit"
import { authLogger } from "@/lib/logger"

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
  totp: z.string().optional(),
})

export type LoginState = {
  error?: string
  fieldErrors?: Partial<Record<"email" | "password", string>>
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totp: formData.get("totp") || undefined,
  })

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === "email" || key === "password") fieldErrors[key] = issue.message
    }
    return { fieldErrors }
  }

  // Rate limit por IP: 5 intentos por minuto, y por email: 10 por hora.
  const h = await headers()
  const ip = getRequestIp(h)
  const ipCheck = checkRateLimit(`login-ip:${ip}`, 5, 60_000)
  if (!ipCheck.ok) {
    authLogger.warn({ ip, email: parsed.data.email }, "login_rate_limited_ip")
    return { error: "Demasiados intentos. Esperá un minuto y volvé a probar." }
  }
  const emailKey = parsed.data.email.toLowerCase()
  const emailCheck = checkRateLimit(`login-email:${emailKey}`, 10, 3600_000)
  if (!emailCheck.ok) {
    authLogger.warn({ ip, email: emailKey }, "login_rate_limited_email")
    return { error: "Demasiados intentos para esta cuenta. Probá más tarde." }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: parsed.data.totp ?? "",
      redirectTo: "/dashboard",
    })
    return {}
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        authLogger.info({ ip, email: emailKey }, "login_failed")
        logActivity({
          entityType: "session",
          entityId: emailKey,
          action: "login_failed",
          diff: { ip },
        })
        return { error: "Credenciales inválidas" }
      }
      return { error: "No se pudo iniciar sesión" }
    }
    throw err
  }
}
