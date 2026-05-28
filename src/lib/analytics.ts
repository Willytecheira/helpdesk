import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type RangeKey = "7d" | "30d" | "90d"

export function rangeToDays(range: RangeKey): number {
  return range === "7d" ? 7 : range === "30d" ? 30 : 90
}

export function rangeStart(range: RangeKey): Date {
  const d = new Date()
  d.setDate(d.getDate() - rangeToDays(range))
  d.setHours(0, 0, 0, 0)
  return d
}

type CustomerScope = { customerId?: string }

// 1. Serie temporal: tickets creados vs resueltos por día
export async function ticketsTimeSeries(range: RangeKey, scope: CustomerScope = {}) {
  const start = rangeStart(range)
  const days = rangeToDays(range)
  const customerFilter = scope.customerId ? Prisma.sql`AND "customerId" = ${scope.customerId}` : Prisma.empty

  const created = await prisma.$queryRaw<{ day: Date; count: bigint }[]>(Prisma.sql`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
    FROM "Ticket"
    WHERE "createdAt" >= ${start} ${customerFilter}
    GROUP BY day
    ORDER BY day ASC
  `)
  const resolved = await prisma.$queryRaw<{ day: Date; count: bigint }[]>(Prisma.sql`
    SELECT date_trunc('day', "resolvedAt") AS day, COUNT(*)::bigint AS count
    FROM "Ticket"
    WHERE "resolvedAt" >= ${start} ${customerFilter}
    GROUP BY day
    ORDER BY day ASC
  `)

  const createdMap = new Map(created.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]))
  const resolvedMap = new Map(resolved.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]))

  const series: { date: string; creados: number; resueltos: number }[] = []
  for (let i = 0; i <= days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    series.push({
      date: key,
      creados: createdMap.get(key) ?? 0,
      resueltos: resolvedMap.get(key) ?? 0,
    })
  }
  return series
}

// 2. Distribución por estado
export async function distributionByStatus(range: RangeKey, scope: CustomerScope = {}) {
  const start = rangeStart(range)
  const rows = await prisma.ticket.groupBy({
    by: ["status"],
    where: { createdAt: { gte: start }, ...(scope.customerId ? { customerId: scope.customerId } : {}) },
    _count: { _all: true },
  })
  return rows.map((r) => ({ name: r.status, value: r._count._all }))
}

// 3. Distribución por prioridad (sólo abiertos)
export async function openByPriority(scope: CustomerScope = {}) {
  const rows = await prisma.ticket.groupBy({
    by: ["priority"],
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] },
      ...(scope.customerId ? { customerId: scope.customerId } : {}),
    },
    _count: { _all: true },
  })
  const order = ["URGENT", "HIGH", "MEDIUM", "LOW"]
  return rows
    .map((r) => ({ name: r.priority, value: r._count._all }))
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
}

// 4. Top clientes por tickets (en el rango)
export async function topCustomers(range: RangeKey, limit = 5) {
  const start = rangeStart(range)
  const rows = await prisma.ticket.groupBy({
    by: ["customerId"],
    where: { createdAt: { gte: start } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  })
  if (rows.length === 0) return []
  const customers = await prisma.customer.findMany({
    where: { id: { in: rows.map((r) => r.customerId) } },
    select: { id: true, name: true },
  })
  const nameMap = new Map(customers.map((c) => [c.id, c.name]))
  return rows.map((r) => ({
    name: nameMap.get(r.customerId) ?? "Desconocido",
    value: r._count._all,
  }))
}

// 5. MTTR — Mean Time To Resolve (en horas) sobre tickets resueltos en el rango
export async function meanTimeToResolve(range: RangeKey, scope: CustomerScope = {}) {
  const start = rangeStart(range)
  const tickets = await prisma.ticket.findMany({
    where: {
      resolvedAt: { gte: start },
      type: "SUPPORT",
      ...(scope.customerId ? { customerId: scope.customerId } : {}),
    },
    select: { createdAt: true, resolvedAt: true },
  })
  if (tickets.length === 0) return { hours: null, count: 0 }
  const totalMs = tickets.reduce((acc, t) => {
    const r = t.resolvedAt as Date
    return acc + (r.getTime() - t.createdAt.getTime())
  }, 0)
  const hours = totalMs / tickets.length / 1000 / 3600
  return { hours, count: tickets.length }
}

// 6. Carga por técnico — tickets activos asignados a cada agente
export async function loadByAgent(limit = 6) {
  const rows = await prisma.ticket.groupBy({
    by: ["assignedToId"],
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] },
      assignedToId: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  })
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.assignedToId!).filter(Boolean)
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email]))
  return rows.map((r) => ({
    name: r.assignedToId ? (userMap.get(r.assignedToId) ?? "—") : "Sin asignar",
    value: r._count._all,
  }))
}

// 7. Salud de servidores (% online por cliente)
export async function infrastructureHealth() {
  const customers = await prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      servers: { select: { status: true } },
    },
  })
  return customers
    .filter((c) => c.servers.length > 0)
    .map((c) => {
      const total = c.servers.length
      const online = c.servers.filter((s) => s.status === "ONLINE").length
      return {
        name: c.name,
        value: Math.round((online / total) * 100),
        total,
        online,
      }
    })
    .sort((a, b) => a.value - b.value)
    .slice(0, 6)
}
