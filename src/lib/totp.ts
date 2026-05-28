import { authenticator } from "otplib"
import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { encryptString, decryptString } from "@/lib/crypto"

authenticator.options = {
  window: 1, // permite ±30s de drift
  step: 30,
}

export type SetupTotp = {
  secret: string
  otpauthUrl: string
}

export function generateSetup(email: string, issuer: string = "Helpdesk"): SetupTotp {
  const secret = authenticator.generateSecret()
  const otpauthUrl = authenticator.keyuri(email, issuer, secret)
  return { secret, otpauthUrl }
}

export function verifyTotp(secret: string, code: string): boolean {
  return authenticator.verify({ token: code.replace(/\s+/g, ""), secret })
}

/** Genera 10 códigos de recuperación de un solo uso. */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () =>
    randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
  )
}

export function hashRecovery(code: string): string {
  return createHash("sha256").update(code.toUpperCase().replace(/-/g, "")).digest("hex")
}

/** Verifica TOTP o recovery code para un user. Marca recovery como usado. */
export async function verifyTotpCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorRecovery: true, twoFactorEnabled: true },
  })
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) return false

  const clean = code.replace(/[\s-]/g, "").toUpperCase()
  if (clean.length === 6 && /^\d+$/.test(clean)) {
    // TOTP numérico
    try {
      const secret = decryptString(user.twoFactorSecret)
      return verifyTotp(secret, clean)
    } catch {
      return false
    }
  }

  // Probar como recovery code
  if (clean.length >= 8 && user.twoFactorRecovery) {
    try {
      const codes: string[] = JSON.parse(user.twoFactorRecovery)
      const hash = hashRecovery(clean)
      const idx = codes.indexOf(hash)
      if (idx === -1) return false
      // consume
      codes.splice(idx, 1)
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorRecovery: JSON.stringify(codes) },
      })
      return true
    } catch {
      return false
    }
  }
  return false
}

export { encryptString, decryptString }
