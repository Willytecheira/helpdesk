import { AlertTriangle } from "lucide-react"
import { ProgressBar } from "@/components/ui/progress-bar"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

type PhaseRow = {
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED"
  estimatedHours: number | null
  actualHours: number | null
  budgetAmount: number | null
}

type Props = {
  ticket: {
    estimatedHours: number | null
    actualHours: number | null
    budgetAmount: number | string | null
    budgetCurrency: string | null
    phases: PhaseRow[]
  }
  compact?: boolean
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === "string" ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

export function ImplementationProgress({ ticket, compact = false }: Props) {
  const phases = ticket.phases
  const totalEstHours = phases.reduce((acc, p) => acc + (p.estimatedHours ?? 0), 0) ||
    (ticket.estimatedHours ?? 0)
  const totalActualHours =
    phases.reduce((acc, p) => acc + (p.actualHours ?? 0), 0) || ticket.actualHours || 0

  const totalBudgetPhases = phases.reduce((acc, p) => acc + (p.budgetAmount ?? 0), 0)
  const ticketBudget = toNumber(ticket.budgetAmount) ?? 0
  const totalBudget = totalBudgetPhases > 0 ? totalBudgetPhases : ticketBudget

  const completedPhases = phases.filter((p) => p.status === "COMPLETED").length
  const progressPct = phases.length > 0 ? completedPhases / phases.length : 0
  const hoursRatio = totalEstHours > 0 ? totalActualHours / totalEstHours : 0

  const overBudget = totalEstHours > 0 && hoursRatio > 1
  const consumedBudget = totalBudget * Math.min(hoursRatio, 1)

  const blocks = [
    {
      label: "Avance",
      value: `${completedPhases}/${phases.length || 0} fases`,
      sub: `${Math.round(progressPct * 100)}%`,
      ratio: progressPct,
    },
    {
      label: "Horas",
      value: `${totalActualHours.toFixed(1)} / ${totalEstHours.toFixed(1)}h`,
      sub: totalEstHours > 0 ? `${Math.round(hoursRatio * 100)}%` : "—",
      ratio: hoursRatio,
    },
    {
      label: "Presupuesto",
      value: totalBudget > 0
        ? formatCurrency(totalBudget, ticket.budgetCurrency ?? "USD")
        : "—",
      sub: totalBudget > 0
        ? `${formatCurrency(consumedBudget, ticket.budgetCurrency ?? "USD")} consumido`
        : "",
      ratio: Math.min(hoursRatio, 1.5),
    },
  ]

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {overBudget && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5" />
          Las horas reales superan las estimadas en{" "}
          <strong>{Math.round((hoursRatio - 1) * 100)}%</strong>.
        </div>
      )}
      <div className={cn("grid gap-3", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
        {blocks.map((b) => (
          <div key={b.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-muted-foreground text-xs">{b.label}</p>
              <p className="text-muted-foreground text-[10px]">{b.sub}</p>
            </div>
            <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>{b.value}</p>
            <ProgressBar value={b.ratio} max={1} />
          </div>
        ))}
      </div>
    </div>
  )
}
