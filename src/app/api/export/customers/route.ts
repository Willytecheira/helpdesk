import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { toCsv, csvResponse } from "@/lib/csv"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { systems: true, servers: true, tickets: true } },
    },
  })

  const rows = customers.map((c) => ({
    name: c.name,
    slug: c.slug,
    status: c.status,
    email: c.email ?? "",
    phone: c.phone ?? "",
    website: c.website ?? "",
    systems: c._count.systems,
    servers: c._count.servers,
    tickets: c._count.tickets,
    createdAt: c.createdAt,
  }))

  const csv = toCsv(rows, [
    { key: "name", header: "Nombre" },
    { key: "slug", header: "Slug" },
    { key: "status", header: "Estado" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Teléfono" },
    { key: "website", header: "Sitio web" },
    { key: "systems", header: "Sistemas" },
    { key: "servers", header: "Servidores" },
    { key: "tickets", header: "Tickets" },
    { key: "createdAt", header: "Creado" },
  ])

  const date = new Date().toISOString().slice(0, 10)
  return csvResponse(csv, `clientes-${date}.csv`)
}
