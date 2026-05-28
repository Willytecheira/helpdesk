import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (!q) return NextResponse.json({ tickets: [], customers: [], kb: [] })

  const role = session.user.role
  const customerId = session.user.customerId
  const isClient = role === "CLIENT"
  const search = { contains: q, mode: "insensitive" as const }

  const customerFilter = isClient && customerId ? { customerId } : {}

  const [tickets, customers, kb] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        ...customerFilter,
        OR: [{ title: search }, { code: search }],
      },
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        priority: true,
        type: true,
        customer: { select: { name: true } },
      },
    }),
    isClient
      ? Promise.resolve([])
      : prisma.customer.findMany({
          where: {
            OR: [{ name: search }, { slug: search }, { email: search }],
          },
          take: 6,
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true, status: true },
        }),
    prisma.kbArticle.findMany({
      where: {
        published: true,
        ...(isClient && customerId
          ? { OR: [{ customerId: null }, { customerId }] }
          : {}),
        AND: [
          {
            OR: [
              { title: search },
              { body: search },
              { tags: { has: q.toLowerCase() } },
            ],
          },
        ],
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, title: true, tags: true },
    }),
  ])

  return NextResponse.json({ tickets, customers, kb })
}
