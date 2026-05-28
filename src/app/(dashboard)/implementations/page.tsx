import Link from "next/link"
import { Rocket, DollarSign, Clock, AlertTriangle, Calendar } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ImplementationProgress } from "@/components/implementation-progress"
import { formatCurrency, formatDate, formatRelative } from "@/lib/format"

export const metadata = { title: "Implementaciones" }

const statusOrder = ["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED"] as const

const statusLabel = {
  OPEN: "Por arrancar",
  IN_PROGRESS: "En desarrollo",
  WAITING_CLIENT: "Esperando cliente",
  RESOLVED: "Finalizadas",
  CLOSED: "Cerradas",
  CANCELLED: "Canceladas",
} as const

const statusColor = {
  OPEN: "border-slate-300 dark:border-slate-700",
  IN_PROGRESS: "border-blue-400/60",
  WAITING_CLIENT: "border-amber-400/60",
  RESOLVED: "border-emerald-400/60",
  CLOSED: "border-slate-300 dark:border-slate-700",
  CANCELLED: "border-slate-300 dark:border-slate-700",
} as const

export default async function ImplementationsPage() {
  await requireStaff()

  const projects = await prisma.ticket.findMany({
    where: { type: "IMPLEMENTATION" },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { id: true, name: true } },
      system: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      phases: { orderBy: { order: "asc" } },
      _count: { select: { comments: true } },
    },
  })

  const totalBudget = projects.reduce(
    (acc, p) => acc + Number(p.budgetAmount ?? 0),
    0
  )
  const totalEstHours = projects.reduce(
    (acc, p) => acc + (p.estimatedHours ?? 0),
    0
  )
  const totalActualHours = projects.reduce(
    (acc, p) => acc + (p.actualHours ?? 0),
    0
  )
  const overBudgetCount = projects.filter((p) => {
    const est = p.estimatedHours ?? 0
    const real = p.actualHours ?? 0
    return est > 0 && real / est > 1
  }).length
  const lateProjects = projects.filter(
    (p) => p.endDate && new Date(p.endDate) < new Date() && p.status !== "CLOSED" && p.status !== "RESOLVED"
  ).length

  const grouped = statusOrder.reduce(
    (acc, st) => {
      acc[st] = projects.filter((p) => p.status === st)
      return acc
    },
    {} as Record<(typeof statusOrder)[number], typeof projects>
  )

  return (
    <div>
      <PageHeader
        title="Implementaciones"
        description="Proyectos en curso con presupuesto, fases y avance."
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Rocket}
            label="Proyectos"
            value={projects.length}
            sub={`${grouped.IN_PROGRESS.length} en desarrollo`}
          />
          <KpiCard
            icon={DollarSign}
            label="Presupuesto total"
            value={formatCurrency(totalBudget, "USD")}
            sub={`${projects.filter((p) => p.budgetAmount).length} con presupuesto`}
          />
          <KpiCard
            icon={Clock}
            label="Horas"
            value={`${totalActualHours.toFixed(0)} / ${totalEstHours.toFixed(0)}h`}
            sub={
              totalEstHours > 0
                ? `${Math.round((totalActualHours / totalEstHours) * 100)}% del estimado`
                : "—"
            }
          />
          <KpiCard
            icon={AlertTriangle}
            label="Alertas"
            value={overBudgetCount + lateProjects}
            sub={`${overBudgetCount} sobre horas · ${lateProjects} atrasados`}
            tone={overBudgetCount + lateProjects > 0 ? "warn" : "default"}
          />
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={Rocket}
                title="Sin implementaciones"
                description='Creá tu primer proyecto desde Tickets → Nuevo → "Implementación".'
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {statusOrder.map((st) => (
              <div key={st} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold">{statusLabel[st]}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {grouped[st].length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {grouped[st].length === 0 ? (
                    <p className="text-muted-foreground rounded-md border border-dashed py-6 text-center text-xs">
                      Sin proyectos
                    </p>
                  ) : (
                    grouped[st].map((p) => (
                      <Link
                        key={p.id}
                        href={`/tickets/${p.id}`}
                        className={`block rounded-lg border-l-4 ${statusColor[st]} bg-card transition-shadow hover:shadow-md`}
                      >
                        <Card className="border-l-0">
                          <CardContent className="space-y-3 p-4">
                            <div>
                              <div className="text-muted-foreground font-mono text-xs">
                                {p.code}
                              </div>
                              <div className="font-medium leading-tight">{p.title}</div>
                              <div className="text-muted-foreground mt-0.5 text-xs">
                                {p.customer.name}
                                {p.system && ` · ${p.system.name}`}
                              </div>
                            </div>

                            <ImplementationProgress
                              compact
                              ticket={{
                                estimatedHours: p.estimatedHours,
                                actualHours: p.actualHours,
                                budgetAmount: p.budgetAmount?.toString() ?? null,
                                budgetCurrency: p.budgetCurrency,
                                phases: p.phases.map((ph) => ({
                                  status: ph.status,
                                  estimatedHours: ph.estimatedHours,
                                  actualHours: ph.actualHours,
                                  budgetAmount: ph.budgetAmount ? Number(ph.budgetAmount) : null,
                                })),
                              }}
                            />

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {p.assignedTo && (
                                <span>{p.assignedTo.name ?? p.assignedTo.email}</span>
                              )}
                              {p.endDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="size-3" />
                                  {formatDate(p.endDate)}
                                </span>
                              )}
                              <span>· actualizado {formatRelative(p.updatedAt)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: typeof Rocket
  label: string
  value: React.ReactNode
  sub: string
  tone?: "default" | "warn"
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className={tone === "warn" ? "text-amber-600 size-4" : "size-4"} />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs">{sub}</p>
      </CardContent>
    </Card>
  )
}
