import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const now = new Date()
  let dbOk = false
  let dbError: string | null = null

  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch (e) {
    dbError = e instanceof Error ? e.message : "unknown"
  }

  const ok = dbOk
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      timestamp: now.toISOString(),
      checks: {
        database: dbOk ? { ok: true } : { ok: false, error: dbError },
      },
    },
    { status: ok ? 200 : 503 }
  )
}
