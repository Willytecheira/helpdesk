"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Server } from "@prisma/client"
import { createServer, updateServer } from "./actions"
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

type Option = { id: string; name: string }

export function ServerForm({
  server,
  customers,
  onDone,
}: {
  server?: Server
  customers: Option[]
  onDone: (id?: string) => void
}) {
  const isEdit = !!server
  const bound = isEdit ? updateServer.bind(null, server!.id) : createServer
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success(isEdit ? "Servidor actualizado" : "Servidor creado")
      const data = (r as { ok: true; data?: { id: string } }).data
      onDone(data?.id)
    } else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Select name="customerId" defaultValue={server?.customerId}>
            <SelectTrigger className="w-full" aria-invalid={!!fe?.customerId}>
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fe?.customerId && <p className="text-destructive text-xs">{fe.customerId}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="sv-name">Nombre *</Label>
          <Input id="sv-name" name="name" defaultValue={server?.name} required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sv-hostname">Hostname</Label>
          <Input id="sv-hostname" name="hostname" defaultValue={server?.hostname ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sv-ip">IP</Label>
          <Input id="sv-ip" name="ipAddress" defaultValue={server?.ipAddress ?? ""} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sv-provider">Proveedor</Label>
          <Input id="sv-provider" name="provider" defaultValue={server?.provider ?? ""} placeholder="AWS, DO, OnPrem…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sv-location">Ubicación</Label>
          <Input id="sv-location" name="location" defaultValue={server?.location ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sv-os">Sistema operativo</Label>
        <Input id="sv-os" name="os" defaultValue={server?.os ?? ""} placeholder="Ubuntu 22.04…" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sv-cpu">CPU (cores)</Label>
          <Input id="sv-cpu" name="cpuCores" type="number" min={1} defaultValue={server?.cpuCores ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sv-mem">RAM (GB)</Label>
          <Input id="sv-mem" name="memoryGb" type="number" step="0.5" min={0} defaultValue={server?.memoryGb ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sv-disk">Disco (GB)</Label>
          <Input id="sv-disk" name="diskGb" type="number" step={1} min={0} defaultValue={server?.diskGb ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sv-notes">Notas</Label>
        <Textarea id="sv-notes" name="notes" defaultValue={server?.notes ?? ""} rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onDone()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar" : "Crear servidor"}
        </Button>
      </div>
    </form>
  )
}
