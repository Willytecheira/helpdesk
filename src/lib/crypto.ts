import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

// Deriva una clave AES-256 a partir del AUTH_SECRET.
// Si en el futuro querés rotar, podés agregar un INTEGRATION_SECRET separado.
function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado (requerido para encriptar integraciones)")
  }
  return createHash("sha256").update(secret).digest()
}

// AES-256-GCM. Output: base64(iv | authTag | ciphertext)
export function encryptString(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString("base64")
}

export function decryptString(b64: string): string {
  const buf = Buffer.from(b64, "base64")
  if (buf.length < 12 + 16 + 1) throw new Error("Ciphertext inválido")
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString("utf8")
}

// Para preview en UI: muestra los primeros y últimos chars del valor sin exponerlo.
export function maskSecret(value: string): string {
  if (!value) return ""
  if (value.length <= 8) return "•".repeat(value.length)
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}
