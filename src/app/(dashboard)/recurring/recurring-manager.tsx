"use client"

import { useState, useTransition } from "react"
import { Plus, Play, Pause, Pencil, Trash2, Loader2, RefreshCw, Repeat } from "lucide-react"
import { toast } from "sonner"
import { toggleRecurring, deleteRecurring, runNow } from "./actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { formatDate, formatRelative } from "@/lib/format"
import { RecurringForm } from "./recurring-form"

type Option = { id: string; name: string }
type SystemOpt = Option & { customerId: string }
type Row = {
  id: string
  name: string
  title: string
  description: string
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  customerId: string
  customerName: string
  systemId: string | null
  assignedToId: string | null
  intervalDays: number
  nextRunAt: string
  lastRunAt: string | null
  active: boolean
  tags: string[]
}

const priorityLabel = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", URGENT: "Urgente" } as const

export function RecurringManager({
  items,
  customers,
  systems,
  agents,
}: {
  items: Row[]
  customers: Option[]
  systems: SystemOpt[]
  agents: Option[]
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [pending, start] = useTransition()

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-muted-foreground text-sm">
          {items.length} plantilla{items.length === 1 ? "" : "s"} · generan tickets automáticamente
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await runNow()
                if (r.ok) {
                  const data = (r as { ok: true; data?: { created: number } }).data
                  toast.success(`${data?.created ?? 0} tickets generados`)
                } else toast.error(r.error)
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Ejecutar ahora
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            Nuevo recurrente
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Sin recurrentes"
          description="Creá una plantilla para generar tickets de mantenimiento automáticamente."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plantilla</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Cada</TableHead>
              <TableHead>Próxima</TableHead>
              <TableHead>Última</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} className={!r.active ? "opacity-50" : ""}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-muted-foreground text-xs">{r.title}</div>
                </TableCell>
                <TableCell className="text-sm">{r.customerName}</TableCell>
                <TableCell className="text-sm">{r.intervalDays}d</TableCell>
                <TableCell className="text-sm">{formatDate(r.nextRunAt)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {r.lastRunAt ? formatRelative(r.lastRunAt) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={r.active ? "default" : "outline"}>
                    {r.active ? "Activo" : "Pausado"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={r.active ? "Pausar" : "Activar"}
                      onClick={() =>
                        start(async () => {
                          const res = await toggleRecurring(r.id)
                          if (res.ok) toast.success(r.active ? "Pausado" : "Activado")
                          else toast.error(res.error)
                        })
                      }
                    >
                      {r.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        start(async () => {
                          if (!confirm(`¿Eliminar "${r.name}"?`)) return
                          const res = await deleteRecurring(r.id)
                          if (res.ok) toast.success("Eliminado")
                          else toast.error(res.error)
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo ticket recurrente</DialogTitle>
          </DialogHeader>
          <RecurringForm
            customers={customers}
            systems={systems}
            agents={agents}
            onDone={() => setNewOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar recurrente</DialogTitle>
          </DialogHeader>
          {editing && (
            <RecurringForm
              recurring={editing}
              customers={customers}
              systems={systems}
              agents={agents}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
