"use client"

import { useActionState, useState, useTransition } from "react"
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Pencil,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import {
  addPhase,
  updatePhase,
  setPhaseStatus,
  setPhaseActualHours,
  deletePhase,
  reorderPhase,
} from "@/app/(dashboard)/implementations/actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProgressBar } from "@/components/ui/progress-bar"
import { formatDate, formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

type PhaseStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED"

type PhaseView = {
  id: string
  ticketId: string
  name: string
  description: string | null
  order: number
  status: PhaseStatus
  estimatedHours: number | null
  actualHours: number | null
  budgetAmount: number | string | null
  startDate: Date | string | null
  endDate: Date | string | null
}

const statusLabel: Record<PhaseStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  BLOCKED: "Bloqueada",
  CANCELLED: "Cancelada",
}

const statusVariant: Record<PhaseStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  BLOCKED: "destructive",
  CANCELLED: "outline",
}

export function PhasesManager({
  ticketId,
  phases,
  currency = "USD",
}: {
  ticketId: string
  phases: PhaseView[]
  currency?: string
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PhaseView | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Fases ({phases.length})
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="size-4" />
              Agregar fase
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva fase</DialogTitle>
            </DialogHeader>
            <PhaseForm ticketId={ticketId} onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {phases.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed py-8 text-center text-sm">
          Aún no hay fases. Agregá la primera para planificar el proyecto.
        </div>
      ) : (
        <ul className="space-y-2">
          {phases.map((p, idx) => (
            <PhaseRow
              key={p.id}
              phase={p}
              isFirst={idx === 0}
              isLast={idx === phases.length - 1}
              currency={currency}
              onEdit={() => setEditing(p)}
            />
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar fase</DialogTitle>
          </DialogHeader>
          {editing && (
            <PhaseForm
              phase={editing}
              ticketId={ticketId}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PhaseRow({
  phase,
  isFirst,
  isLast,
  currency,
  onEdit,
}: {
  phase: PhaseView
  isFirst: boolean
  isLast: boolean
  currency: string
  onEdit: () => void
}) {
  const [statusPending, startStatus] = useTransition()
  const [orderPending, startOrder] = useTransition()
  const [hoursPending, startHours] = useTransition()
  const [delPending, startDel] = useTransition()
  const [hoursInput, setHoursInput] = useState(phase.actualHours?.toString() ?? "")

  const est = phase.estimatedHours ?? 0
  const real = phase.actualHours ?? 0
  const ratio = est > 0 ? real / est : 0
  const budget = typeof phase.budgetAmount === "string" ? Number(phase.budgetAmount) : phase.budgetAmount

  return (
    <li
      className={cn(
        "rounded-md border p-3",
        phase.status === "COMPLETED" && "bg-muted/30",
        phase.status === "BLOCKED" && "border-destructive/40 bg-destructive/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={isFirst || orderPending}
            onClick={() => startOrder(async () => { await reorderPhase(phase.id, "up") })}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={isLast || orderPending}
            onClick={() => startOrder(async () => { await reorderPhase(phase.id, "down") })}
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-mono text-xs">#{phase.order}</span>
            <p className="font-medium">{phase.name}</p>
            <Badge variant={statusVariant[phase.status]} className="text-[10px]">
              {statusLabel[phase.status]}
            </Badge>
          </div>

          {phase.description && (
            <p className="text-muted-foreground text-sm">{phase.description}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(phase.startDate || phase.endDate) && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
              </span>
            )}
            {budget !== null && budget !== undefined && Number(budget) > 0 && (
              <span>{formatCurrency(budget, currency)}</span>
            )}
          </div>

          {est > 0 && (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  {real.toFixed(1)} / {est.toFixed(1)}h
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.round(ratio * 100)}%
                </span>
              </div>
              <ProgressBar value={ratio} max={1} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Select
              value={phase.status}
              disabled={statusPending}
              onValueChange={(v) =>
                startStatus(async () => {
                  const r = await setPhaseStatus(phase.id, v as PhaseStatus)
                  if (!r.ok) toast.error(r.error)
                  else toast.success("Estado actualizado")
                })
              }
            >
              <SelectTrigger size="sm" className="h-7 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(statusLabel) as PhaseStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.5"
                min={0}
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                className="h-7 w-20"
                placeholder="0"
              />
              <span className="text-muted-foreground text-xs">h reales</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={hoursPending}
                onClick={() =>
                  startHours(async () => {
                    const n = Number(hoursInput || "0")
                    const r = await setPhaseActualHours(phase.id, n)
                    if (!r.ok) toast.error(r.error)
                    else toast.success("Horas actualizadas")
                  })
                }
              >
                {hoursPending && <Loader2 className="size-3 animate-spin" />}
                Guardar
              </Button>
            </div>

            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-7 w-7"
              disabled={delPending}
              onClick={() =>
                startDel(async () => {
                  if (!confirm(`¿Eliminar la fase "${phase.name}"?`)) return
                  const r = await deletePhase(phase.id)
                  if (!r.ok) toast.error(r.error)
                  else toast.success("Fase eliminada")
                })
              }
            >
              {delPending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}

const initial: ActionResult = { ok: true }

function PhaseForm({
  ticketId,
  phase,
  onDone,
}: {
  ticketId: string
  phase?: PhaseView
  onDone: () => void
}) {
  const isEdit = !!phase
  const bound = isEdit ? updatePhase.bind(null, phase!.id) : addPhase.bind(null, ticketId)
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success(isEdit ? "Fase actualizada" : "Fase agregada")
      onDone()
    } else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  const startDefault = phase?.startDate ? new Date(phase.startDate).toISOString().slice(0, 10) : ""
  const endDefault = phase?.endDate ? new Date(phase.endDate).toISOString().slice(0, 10) : ""

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="ph-name">Nombre *</Label>
        <Input id="ph-name" name="name" defaultValue={phase?.name} required aria-invalid={!!fe?.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ph-desc">Descripción</Label>
        <Textarea id="ph-desc" name="description" defaultValue={phase?.description ?? ""} rows={2} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ph-est">Horas estimadas</Label>
          <Input id="ph-est" name="estimatedHours" type="number" step="0.5" min={0} defaultValue={phase?.estimatedHours ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ph-act">Horas reales</Label>
          <Input id="ph-act" name="actualHours" type="number" step="0.5" min={0} defaultValue={phase?.actualHours ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ph-bud">Presupuesto</Label>
          <Input
            id="ph-bud"
            name="budgetAmount"
            type="number"
            step="0.01"
            min={0}
            defaultValue={
              phase?.budgetAmount != null
                ? (typeof phase.budgetAmount === "string"
                    ? phase.budgetAmount
                    : phase.budgetAmount.toString())
                : ""
            }
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ph-start">Inicio</Label>
          <Input id="ph-start" name="startDate" type="date" defaultValue={startDefault} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ph-end">Fin</Label>
          <Input id="ph-end" name="endDate" type="date" defaultValue={endDefault} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Estado</Label>
        <Select name="status" defaultValue={phase?.status ?? "PENDING"}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(statusLabel) as PhaseStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar" : "Agregar"}
        </Button>
      </div>
    </form>
  )
}
