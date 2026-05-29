import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getRequestIp, rateLimitResponse } from "@/lib/rate-limit"
import { logActivity } from "@/lib/audit"
import { authLogger } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET: indica si el sistema necesita setup inicial (no hay usuarios todavía).
export async function GET() {
  const count = await prisma.user.count()
  return NextResponse.json({ needsSetup: count === 0 })
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  name: z.string().min(2).optional(),
})

/**
 * POST: crea el primer ADMIN. Sólo funciona si:
 *  - No existe ningún usuario todavía (one-shot), y
 *  - Se provee el SETUP_TOKEN correcto (header Authorization: Bearer o ?token=).
 * Una vez creado el primer usuario, el endpoint queda deshabilitado (410).
 */
export async function POST(req: NextRequest) {
  const ip = getRequestIp(req.headers)
  const rl = rateLimitResponse(ip, "setup", 5, 60_000)
  if (rl) return rl

  const userCount = await prisma.user.count()
  if (userCount > 0) {
    return NextResponse.json(
      { error: "setup_already_done" },
      { status: 410 }
    )
  }

  const expected = process.env.SETUP_TOKEN
  if (!expected) {
    return NextResponse.json(
      { error: "setup_token_not_configured" },
      { status: 503 }
    )
  }
  const provided =
    req.nextUrl.searchParams.get("token") ||
    /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const hash = await bcrypt.hash(parsed.data.password, 10)
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase().trim(),
      password: hash,
      name: parsed.data.name ?? "Administrador",
      role: "ADMIN",
      active: true,
      emailVerified: new Date(),
    },
    select: { id: true, email: true },
  })

  authLogger.info({ userId: user.id }, "initial_admin_created")
  logActivity({
    userId: user.id,
    entityType: "user",
    entityId: user.id,
    action: "create",
    diff: { initialAdmin: true },
  })

  return NextResponse.json({ ok: true, email: user.email })
}
