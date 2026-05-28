import Link from "next/link"
import {
  Users,
  Boxes,
  LifeBuoy,
  ServerCog,
  Rocket,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Activity,
  Timer,
  TrendingDown,
  Users2,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ticketStatusLabel,
  ticketStatusVariant,
  priorityLabel,
} from "@/lib/ticket-ui"
import { formatRelative } from "@/lib/format"
import {
  type RangeKey,
  ticketsTimeSeries,
  distributionByStatus,
  openByPriority,
  topCustomers,
  meanTimeToResolve,
  loadByAgent,
  infrastructureHealth,
} from "@/lib/analytics"
import { TicketsTimeSeries } from "@/components/charts/time-series"
import { Donut, DonutLegend } from "@/components/charts/donut"
import { HorizontalBars } from "@/components/charts/horizontal-bars"
import { RangeSelector } from "@/components/charts/range-selector"

export const metadata = { title: "Dashboard" }

type SearchParams = Promise<{ range?: string }>

function parseRange(value: string | undefined): RangeKey {
  return value === "7d" || value === "30d" || value === "90d" ? value : "30d"
}

const priorityColor: Record<string, string> = {
  URGENT: "var(--color-destructive)",
  HIGH: "var(--color-chart-1)",
  MEDIUM: "var(--color-chart-2)",
  LOW: "var(--color-chart-3)",
}

const priorityLabelShort: Record<string, string> = {
  URGENT: "Urgente",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser()
  const { range: rangeParam } = await searchParams
  const range = parseRange(rangeParam)
  const isClient = user.role === "CLIENT"
  const customerFilter = isClient && user.customerId ? { customerId: user.customerId } : {}
  const scope = isClient && user.customerId ? { customerId: user.customerId } : {}

  // KPIs principales (no dependen del range)
  const [
    customers,
    systems,
    servers,
    serversOnline,
    openTickets,
    urgentTickets,
    activeImpl,
    recent,
    // Range-aware metrics
    timeSeries,
    statusDist,
    priorityDist,
    topClients,
    mttr,
    agentLoad,
    infraHealth,
  ] = await Promise.all([
    isClient ? Promise.resolve(1) : prisma.customer.count({ where: { status: "ACTIVE" } }),
    prisma.system.count({ where: { ...customerFilter, status: "ACTIVE" } }),
    prisma.server.count({ where: customerFilter }),
    prisma.server.count({ where: { ...customerFilter, status: "ONLINE" } }),
    prisma.ticket.count({
      where: {
        ...customerFilter,
        type: "SUPPORT",
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] },
      },
    }),
    prisma.ticket.count({
      where: {
        ...customerFilter,
        type: "SUPPORT",
        priority: "URGENT",
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    }),
    prisma.ticket.count({
      where: { ...customerFilter, type: "IMPLEMENTATION", status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.ticket.findMany({
      where: customerFilter,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true, system: true },
    }),
    ticketsTimeSeries(range, scope),
    distributionByStatus(range, scope),
    openByPriority(scope),
    isClient ? Promise.resolve([]) : topCustomers(range),
    meanTimeToResolve(range, scope),
    isClient ? Promise.resolve([]) : loadByAgent(),
    isClient ? Promise.resolve([]) : infrastructureHealth(),
  ])

  const serverHealth = servers === 0 ? 0 : Math.round((serversOnline / servers) * 100)

  const statusSlices = statusDist.map((s) => ({
    name: s.name,
    label: ticketStatusLabel[s.name as keyof typeof ticketStatusLabel] ?? s.name,
    value: s.value,
  }))

  const prioritySlices = priorityDist.map((s) => ({
    name: priorityLabelShort[s.name] ?? s.name,
    value: s.value,
    color: priorityColor[s.name],
  }))

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          isClient
            ? "Vista de tus tickets y sistemas."
            : "Vista general de tu operación: clientes, soporte e infraestructura."
        }
        actions={<RangeSelector current={range} />}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!isClient && (
            <KpiCard icon={Users} label="Clientes activos" value={customers} hint={`${systems} sistemas`} href="/customers" />
          )}
          <KpiCard
            icon={LifeBuoy}
            label="Tickets abiertos"
            value={openTickets}
            hint={`${urgentTickets} urgentes`}
            highlight={urgentTickets > 0}
            href="/tickets"
          />
          {!isClient ? (
            <KpiCard
              icon={ServerCog}
              label="Salud servidores"
              value={`${serverHealth}%`}
              hint={`${serversOnline}/${servers} en línea`}
              href="/infrastructure"
            />
          ) : (
            <KpiCard icon={Boxes} label="Sistemas activos" value={systems} hint="Tu cuenta" />
          )}
          <KpiCard
            icon={Rocket}
            label={isClient ? "Implementaciones" : "Implementaciones activas"}
            value={activeImpl}
            hint="En desarrollo"
            href={isClient ? undefined : "/implementations"}
          />
          <KpiCard
            icon={Timer}
            label="MTTR"
            value={mttr.hours != null ? `${mttr.hours.toFixed(1)}h` : "—"}
            hint={`${mttr.count} resueltos · ${range}`}
          />
        </div>

        {/* Time series + Donut */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4" />
                Tickets: creados vs resueltos
              </CardTitle>
              <CardDescription>Tendencia diaria en el período</CardDescription>
            </CardHeader>
            <CardContent>
              <TicketsTimeSeries data={timeSeries} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribución por estado</CardTitle>
              <CardDescription>Tickets del período</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
              {statusSlices.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm sm:col-span-2">
                  Sin datos
                </p>
              ) : (
                <>
                  <Donut data={statusSlices} centerLabel="Total" />
                  <DonutLegend data={statusSlices} />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Priority + top clients (staff) */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Tickets abiertos por prioridad</CardTitle>
              <CardDescription>Estado actual (no histórico)</CardDescription>
            </CardHeader>
            <CardContent>
              {prioritySlices.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">Sin tickets abiertos</p>
              ) : (
                <HorizontalBars data={prioritySlices} height={180} />
              )}
            </CardContent>
          </Card>

          {!isClient && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users2 className="size-4" />
                  Top clientes
                </CardTitle>
                <CardDescription>Por volumen de tickets en {range}</CardDescription>
              </CardHeader>
              <CardContent>
                {topClients.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">Sin datos</p>
                ) : (
                  <HorizontalBars data={topClients} height={180} />
                )}
              </CardContent>
            </Card>
          )}

          {!isClient && (
            <Card>
              <CardHeader>
                <CardTitle>Carga por técnico</CardTitle>
                <CardDescription>Tickets activos asignados</CardDescription>
              </CardHeader>
              <CardContent>
                {agentLoad.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Sin asignaciones activas
                  </p>
                ) : (
                  <HorizontalBars
                    data={agentLoad.map((a) => ({ ...a, color: "var(--color-chart-2)" }))}
                    height={180}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Infrastructure health (staff) + recientes */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Tickets recientes</CardTitle>
              <CardDescription>Últimas solicitudes recibidas</CardDescription>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
                  <CheckCircle2 className="size-8" />
                  <p>No hay tickets todavía</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {recent.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/tickets/${t.id}`}
                          className="truncate block text-sm font-medium hover:underline"
                        >
                          {t.title}
                        </Link>
                        <p className="text-muted-foreground truncate text-xs">
                          {t.code} · {t.customer.name}
                          {t.system && ` · ${t.system.name}`} · {formatRelative(t.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline">{priorityLabel[t.priority]}</Badge>
                      <Badge variant={ticketStatusVariant[t.status]}>
                        {ticketStatusLabel[t.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {!isClient && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ServerCog className="size-4" />
                  Salud infraestructura
                </CardTitle>
                <CardDescription>% servidores online por cliente</CardDescription>
              </CardHeader>
              <CardContent>
                {infraHealth.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Sin servidores registrados
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {infraHealth.map((h) => (
                      <li key={h.name} className="space-y-1">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="truncate">{h.name}</span>
                          <span className="tabular-nums">
                            <span
                              className={
                                h.value < 50
                                  ? "text-destructive"
                                  : h.value < 100
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                              }
                            >
                              {h.value}%
                            </span>
                            <span className="text-muted-foreground ml-1 text-xs">
                              ({h.online}/{h.total})
                            </span>
                          </span>
                        </div>
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className={
                              "h-full " +
                              (h.value < 50
                                ? "bg-destructive"
                                : h.value < 100
                                  ? "bg-amber-500"
                                  : "bg-emerald-500")
                            }
                            style={{ width: `${h.value}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
  href,
}: {
  icon: typeof Activity
  label: string
  value: React.ReactNode
  hint: string
  highlight?: boolean
  href?: string
}) {
  const card = (
    <Card className="h-full">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={
            highlight
              ? "text-destructive flex items-center gap-1 text-xs"
              : "text-muted-foreground text-xs"
          }
        >
          {highlight && <AlertCircle className="size-3" />}
          {hint}
        </p>
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {card}
    </Link>
  ) : (
    card
  )
}
