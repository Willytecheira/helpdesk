import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getRequestIp, checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req.headers)
  if (!checkRateLimit(`check2fa:${ip}`, 20, 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ required: false })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ required: false })

  // Para no permitir enumeración, devolvemos { required } siempre,
  // y no exponemos si el email existe o no.
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
    select: { twoFactorEnabled: true, active: true },
  })
  return NextResponse.json({ required: !!user?.twoFactorEnabled && user.active })
}
