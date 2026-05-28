import { LifeBuoy } from "lucide-react"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { TICKET_STATUSES, TICKET_PRIORITIES } from "@/lib/ticket-ui"
import { NewTicketButton } from "./new-ticket-button"
import { TicketFilterBar } from "./filter-bar"
import { ExportButton } from "@/components/export-button"
import { TicketsTable } from "./tickets-table"

export const metadata = { title: "Tickets" }

type Search = {
  q?: string
  status?: string
  priority?: string
  type?: string
  customerId?: string
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const user = await requireUser()
  const params = await searchParams
  const isClient = user.role === "CLIENT"

  const where: Prisma.TicketWhereInput = {}

  if (isClient) {
    if (!user.customerId) return <NoCustomerLink />
    where.customerId = user.customerId
  } else if (params.customerId) {
    where.customerId = params.customerId
  }

  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { code: { contains: params.q, mode: "insensitive" } },
    ]
  }
  if (params.status && TICKET_STATUSES.includes(params.status as (typeof TICKET_STATUSES)[number])) {
    where.status = params.status as (typeof TICKET_STATUSES)[number]
  }
  if (
    params.priority &&
    TICKET_PRIORITIES.includes(params.priority as (typeof TICKET_PRIORITIES)[number])
  ) {
    where.priority = params.priority as (typeof TICKET_PRIORITIES)[number]
  }
  if (params.type === "SUPPORT" || params.type === "IMPLEMENTATION") {
    where.type = params.type
  }

  const [tickets, customers, systems, servers, agents] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        customer: { select: { id: true, name: true } },
        system: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true } },
      },
    }),
    isClient
      ? prisma.customer.findMany({
          where: { id: user.customerId! },
          select: { id: true, name: true },
        })
      : prisma.customer.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
    prisma.system.findMany({
      where: isClient ? { customerId: user.customerId! } : undefined,
      select: { id: true, name: true, customerId: true },
      orderBy: { name: "asc" },
    }),
    isClient
      ? Promise.resolve([])
      : prisma.server.findMany({
          select: { id: true, name: true, customerId: true },
          orderBy: { name: "asc" },
        }),
    isClient
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { role: { in: ["ADMIN", "AGENT"] } },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
  ])

  const agentsOpt = (agents as Array<{ id: string; name: string | null; email: string }>).map((a) => ({
    id: a.id,
    name: a.name ?? a.email,
  }))

  return (
    <div>
      <PageHeader
        title="Tickets"
        description={
          isClient
            ? "Tus solicitudes de soporte e implementaciones."
            : "Gestioná las solicitudes de soporte e implementaciones."
        }
        actions={
          <div className="flex items-center gap-2">
            {!isClient && <ExportButton endpoint="/api/export/tickets" label="Exportar" />}
            <NewTicketButton
              customers={customers}
              systems={systems as Array<{ id: string; name: string; customerId: string }>}
              servers={servers as Array<{ id: string; name: string; customerId: string }>}
              agents={agentsOpt}
              role={user.role}
              defaultCustomerId={isClient ? user.customerId : null}
            />
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <TicketFilterBar customers={customers} showCustomer={!isClient} />

        <Card>
          <CardContent className="p-0">
            {tickets.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title="Sin tickets"
                description="No hay tickets que coincidan con los filtros aplicados."
              />
            ) : (
              <TicketsTable
                isClient={isClient}
                agents={agentsOpt}
                tickets={tickets.map((t) => ({
                  id: t.id,
                  code: t.code,
                  title: t.title,
                  tags: t.tags,
                  type: t.type,
                  status: t.status,
                  priority: t.priority,
                  dueAt: t.dueAt ? t.dueAt.toISOString() : null,
                  customer: { id: t.customer.id, name: t.customer.name },
                  system: t.system ? { name: t.system.name } : null,
                  assignedTo: t.assignedTo
                    ? { name: t.assignedTo.name, email: t.assignedTo.email }
                    : null,
                  commentsCount: t._count.comments,
                  createdAt: t.createdAt.toISOString(),
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function NoCustomerLink() {
  return (
    <div className="p-6">
      <EmptyState
        icon={LifeBuoy}
        title="Tu cuenta no está vinculada a un cliente"
        description="Contactá al administrador para que vincule tu usuario a un cliente."
      />
    </div>
  )
}
