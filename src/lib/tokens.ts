import { randomBytes, createHash } from "crypto"

/** Genera un token seguro url-safe (32 bytes → 43 chars base64url). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url")
}

/** Hash SHA-256 hex para guardar en DB (el token plano nunca se persiste). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
