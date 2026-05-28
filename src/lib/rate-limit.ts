// Rate limiter en memoria (sliding window). Apto para una sola instancia.
// Para multi-instancia, reemplazar el store por Redis/Upstash.

import { logger } from "@/lib/logger"

type Entry = { timestamps: number[] }
const store = new Map<string, Entry>()
const MAX_KEYS = 50_000 // soft cap para evitar memory leak

/**
 * Verifica si un identificador (ej: IP + ruta) puede hacer otra request.
 * Devuelve { ok, remaining, resetAt }.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const windowStart = now - windowMs

  if (store.size > MAX_KEYS) {
    // GC simple: borrar mitad al azar
    let i = 0
    for (const k of store.keys()) {
      if (i++ % 2 === 0) store.delete(k)
    }
  }

  const entry = store.get(key) ?? { timestamps: [] }
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  if (entry.timestamps.length >= limit) {
    store.set(key, entry)
    const oldest = entry.timestamps[0]
    return { ok: false, remaining: 0, resetAt: oldest + windowMs }
  }

  entry.timestamps.push(now)
  store.set(key, entry)
  return { ok: true, remaining: limit - entry.timestamps.length, resetAt: now + windowMs }
}

/**
 * Extrae IP del request. Usa headers comunes detrás de proxy (Caddy, Nginx, Cloudflare).
 */
export function getRequestIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  )
}

/**
 * Wrapper para usar en route handlers. Devuelve Response 429 con headers
 * estándar si se excede. Retorna null si está OK.
 */
export function rateLimitResponse(
  identifier: string,
  bucket: string,
  limit: number,
  windowMs: number
): Response | null {
  const key = `${bucket}:${identifier}`
  const result = checkRateLimit(key, limit, windowMs)
  if (!result.ok) {
    logger.warn({ bucket, identifier, limit, windowMs }, "rate_limited")
    return new Response(
      JSON.stringify({ error: "rate_limited", resetAt: result.resetAt }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
        },
      }
    )
  }
  return null
}
