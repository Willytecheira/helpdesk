import { type NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { toCsv, csvResponse } from "@/lib/csv"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const isClient = session.user.role === "CLIENT"

  const where: Prisma.TicketWhereInput = {}
  if (isClient) {
    if (!session.user.customerId) return NextResponse.json({ error: "no_customer" }, { status: 403 })
    where.customerId = session.user.customerId
  } else if (sp.get("customerId")) {
    where.customerId = sp.get("customerId")!
  }
  const status = sp.get("status")
  const priority = sp.get("priority")
  const type = sp.get("type")
  if (status) where.status = status as Prisma.TicketWhereInput["status"]
  if (priority) where.priority = priority as Prisma.TicketWhereInput["priority"]
  if (type === "SUPPORT" || type === "IMPLEMENTATION") where.type = type

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      customer: { select: { name: true } },
      system: { select: { name: true } },
      assignedTo: { select: { name: true, email: true } },
    },
  })

  const rows = tickets.map((t) => ({
    code: t.code,
    type: t.type,
    title: t.title,
    status: t.status,
    priority: t.priority,
    customer: t.customer.name,
    system: t.system?.name ?? "",
    assignedTo: t.assignedTo?.name ?? t.assignedTo?.email ?? "",
    tags: t.tags.join("; "),
    budgetAmount: t.budgetAmount?.toString() ?? "",
    estimatedHours: t.estimatedHours ?? "",
    actualHours: t.actualHours ?? "",
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt ?? "",
    dueAt: t.dueAt ?? "",
  }))

  const csv = toCsv(rows, [
    { key: "code", header: "Código" },
    { key: "type", header: "Tipo" },
    { key: "title", header: "Título" },
    { key: "status", header: "Estado" },
    { key: "priority", header: "Prioridad" },
    { key: "customer", header: "Cliente" },
    { key: "system", header: "Sistema" },
    { key: "assignedTo", header: "Asignado" },
    { key: "tags", header: "Tags" },
    { key: "budgetAmount", header: "Presupuesto" },
    { key: "estimatedHours", header: "Horas estimadas" },
    { key: "actualHours", header: "Horas reales" },
    { key: "createdAt", header: "Creado" },
    { key: "resolvedAt", header: "Resuelto" },
    { key: "dueAt", header: "Vence" },
  ])

  const date = new Date().toISOString().slice(0, 10)
  return csvResponse(csv, `tickets-${date}.csv`)
}
