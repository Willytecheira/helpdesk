import { mkdir, writeFile, unlink, stat } from "fs/promises"
import { createReadStream } from "fs"
import path from "path"
import { randomBytes } from "crypto"

const ROOT = path.resolve(process.cwd(), "uploads")

export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
export const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "application/octet-stream", // logs, etc.
]

function safeExt(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  if (!/^\.[a-z0-9]{1,8}$/i.test(ext)) return ""
  return ext
}

export type StoredFile = {
  storageKey: string // path relativo bajo ROOT
  size: number
}

/**
 * Guarda el buffer en uploads/{prefix}/{random}{ext}
 * No expone el filename original al disco (evita path traversal y colisiones).
 */
export async function saveBuffer(
  prefix: string,
  originalName: string,
  buffer: Buffer
): Promise<StoredFile> {
  const dir = path.join(ROOT, prefix)
  await mkdir(dir, { recursive: true })
  const ext = safeExt(originalName)
  const key = `${randomBytes(12).toString("hex")}${ext}`
  const abs = path.join(dir, key)
  await writeFile(abs, buffer)
  return { storageKey: path.join(prefix, key), size: buffer.length }
}

export function resolveAbs(storageKey: string): string {
  // Sanity: storageKey debe ser relativo y no salir de ROOT
  const abs = path.resolve(ROOT, storageKey)
  if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) {
    throw new Error("Path traversal bloqueado")
  }
  return abs
}

export async function fileExists(storageKey: string): Promise<boolean> {
  try {
    await stat(resolveAbs(storageKey))
    return true
  } catch {
    return false
  }
}

export async function deleteStored(storageKey: string): Promise<void> {
  try {
    await unlink(resolveAbs(storageKey))
  } catch {
    /* archivo ya no existe, ignorar */
  }
}

export function openReadStream(storageKey: string) {
  return createReadStream(resolveAbs(storageKey))
}
