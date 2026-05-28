import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { slaStatus, type SlaStatus } from "@/lib/sla"
import { formatRelative } from "@/lib/format"

export function SlaBadge({
  dueAt,
  ticketStatus,
}: {
  dueAt: Date | string | null | undefined
  ticketStatus: string
}) {
  const status: SlaStatus = slaStatus(dueAt, ticketStatus)
  if (status === "none") return null

  if (status === "overdue") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" />
        Vencido {formatRelative(dueAt)}
      </Badge>
    )
  }
  if (status === "due_soon") {
    return (
      <Badge className="gap-1 bg-amber-500 hover:bg-amber-500">
        <Clock className="size-3" />
        Vence {formatRelative(dueAt)}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-emerald-600">
      <CheckCircle2 className="size-3" />
      SLA {formatRelative(dueAt)}
    </Badge>
  )
}
