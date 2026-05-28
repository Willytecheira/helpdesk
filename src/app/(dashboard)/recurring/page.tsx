import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { RecurringManager } from "./recurring-manager"

export const metadata = { title: "Tickets recurrentes" }

export default async function RecurringPage() {
  await requireStaff()

  const [items, customers, systems, agents] = await Promise.all([
    prisma.recurringTicket.findMany({
      orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
      include: { customer: { select: { name: true } } },
    }),
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.system.findMany({
      select: { id: true, name: true, customerId: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "AGENT"] }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ])

  return (
    <div>
      <PageHeader
        title="Tickets recurrentes"
        description="Plantillas que generan tickets de soporte automáticamente cada cierto tiempo (mantenimientos, revisiones)."
      />
      <div className="p-4 md:p-6">
        <Card>
          <CardContent>
            <RecurringManager
              customers={customers}
              systems={systems}
              agents={agents.map((a) => ({ id: a.id, name: a.name ?? a.email }))}
              items={items.map((r) => ({
                id: r.id,
                name: r.name,
                title: r.title,
                description: r.description,
                priority: r.priority,
                customerId: r.customerId,
                customerName: r.customer.name,
                systemId: r.systemId,
                assignedToId: r.assignedToId,
                intervalDays: r.intervalDays,
                nextRunAt: r.nextRunAt.toISOString(),
                lastRunAt: r.lastRunAt?.toISOString() ?? null,
                active: r.active,
                tags: r.tags,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
