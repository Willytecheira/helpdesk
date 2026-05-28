import { NextResponse, type NextRequest } from "next/server"
import { runRecurringTickets } from "@/lib/recurring"
import { getRequestIp, rateLimitResponse } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Endpoint llamado por un scheduler (cron container) cada hora.
 * Autenticación: header Authorization: Bearer <CRON_SECRET>.
 * Fallback: AGENT_API_TOKEN si CRON_SECRET no está definido.
 */
export async function POST(req: NextRequest) {
  const ip = getRequestIp(req.headers)
  const rl = rateLimitResponse(ip, "cron", 30, 60_000)
  if (rl) return rl

  const expected = process.env.CRON_SECRET || process.env.AGENT_API_TOKEN
  if (!expected) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 })
  }

  const header = req.headers.get("authorization") ?? ""
  const token = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim()
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const result = await runRecurringTickets()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    logger.error({ err: e instanceof Error ? e.message : "unknown" }, "cron_recurring_error")
    return NextResponse.json({ error: "cron_failed" }, { status: 500 })
  }
}

// GET para health-check del cron
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "recurring", method: "POST" })
}
