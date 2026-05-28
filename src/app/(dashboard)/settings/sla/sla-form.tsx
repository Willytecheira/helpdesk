"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { saveSla } from "./actions"
import type { ActionResult } from "@/lib/action-result"
import type { SlaConfig } from "@/lib/sla"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial: ActionResult = { ok: true }

export function SlaForm({ config }: { config: SlaConfig }) {
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await saveSla(prev, fd)
    if (r.ok) toast.success("SLA actualizado")
    else toast.error(r.error)
    return r
  }, initial)

  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border p-3">
        <input
          id="sla-enabled"
          name="enabled"
          type="checkbox"
          defaultChecked={config.enabled}
          className="size-4"
        />
        <Label htmlFor="sla-enabled" className="cursor-pointer">
          Activar SLA (calcula fecha de vencimiento al crear tickets de soporte)
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="urgent" label="Urgente" value={config.hoursByPriority.URGENT} />
        <Field name="high" label="Alta" value={config.hoursByPriority.HIGH} />
        <Field name="medium" label="Media" value={config.hoursByPriority.MEDIUM} />
        <Field name="low" label="Baja" value={config.hoursByPriority.LOW} />
      </div>

      <p className="text-muted-foreground text-xs">
        Horas hasta el vencimiento de resolución, según la prioridad del ticket.
        Sólo afecta tickets nuevos; los existentes mantienen su fecha.
      </p>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Guardar SLA
        </Button>
      </div>
      {!state.ok && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}
    </form>
  )
}

function Field({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`sla-${name}`}>{label} (horas)</Label>
      <Input id={`sla-${name}`} name={name} type="number" min={1} max={8760} defaultValue={value} />
    </div>
  )
}
