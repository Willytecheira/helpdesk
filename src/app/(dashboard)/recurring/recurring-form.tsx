"use client"

import { useActionState, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createRecurring, updateRecurring } from "./actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const initial: ActionResult = { ok: true }
const NONE = "__none__"

type Option = { id: string; name: string }
type SystemOpt = Option & { customerId: string }
type Recurring = {
  id: string
  name: string
  title: string
  description: string
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  customerId: string
  systemId: string | null
  assignedToId: string | null
  intervalDays: number
  tags: string[]
}

export function RecurringForm({
  recurring,
  customers,
  systems,
  agents,
  onDone,
}: {
  recurring?: Recurring
  customers: Option[]
  systems: SystemOpt[]
  agents: Option[]
  onDone: () => void
}) {
  const isEdit = !!recurring
  const [customerId, setCustomerId] = useState(recurring?.customerId ?? "")
  const bound = isEdit ? updateRecurring.bind(null, recurring!.id) : createRecurring

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success(isEdit ? "Recurrente actualizado" : "Recurrente creado")
      onDone()
    } else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  const filteredSystems = customerId
    ? systems.filter((s) => s.customerId === customerId)
    : systems

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="r-name">Nombre de la plantilla *</Label>
        <Input
          id="r-name"
          name="name"
          defaultValue={recurring?.name}
          placeholder="ej: Mantenimiento mensual servidor"
          required
          aria-invalid={!!fe?.name}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Select name="customerId" value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="w-full" aria-invalid={!!fe?.customerId}>
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-interval">Cada (días) *</Label>
          <Input
            id="r-interval"
            name="intervalDays"
            type="number"
            min={1}
            max={3650}
            defaultValue={recurring?.intervalDays ?? 30}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="r-title">Título del ticket *</Label>
        <Input id="r-title" name="title" defaultValue={recurring?.title} required aria-invalid={!!fe?.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="r-desc">Descripción *</Label>
        <Textarea id="r-desc" name="description" defaultValue={recurring?.description} rows={3} required aria-invalid={!!fe?.description} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Prioridad</Label>
          <Select name="priority" defaultValue={recurring?.priority ?? "MEDIUM"}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Baja</SelectItem>
              <SelectItem value="MEDIUM">Media</SelectItem>
              <SelectItem value="HIGH">Alta</SelectItem>
              <SelectItem value="URGENT">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sistema</Label>
          <Select name="systemId" defaultValue={recurring?.systemId ?? NONE} key={customerId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {filteredSystems.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Asignar a</Label>
          <Select name="assignedToId" defaultValue={recurring?.assignedToId ?? NONE}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin asignar</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="r-start">Primera ejecución</Label>
          <Input id="r-start" name="startDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-tags">Tags</Label>
          <Input id="r-tags" name="tags" defaultValue={recurring?.tags.join(", ")} placeholder="mantenimiento" />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>Cancelar</Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
