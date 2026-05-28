import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET: lista las 30 más recientes + cuenta de no leídas
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
  ])
  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      url: n.url,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
    unread,
  })
}

// POST: marca todas como leídas (sin body) o una sola (?id=...)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get("id")
  const now = new Date()
  if (id) {
    await prisma.notification.updateMany({
      where: { id, userId: session.user.id, readAt: null },
      data: { readAt: now },
    })
  } else {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: now },
    })
  }
  return NextResponse.json({ ok: true })
}
