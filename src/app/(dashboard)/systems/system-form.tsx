"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { System } from "@prisma/client"
import { createSystem, updateSystem } from "./actions"
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

export function SystemForm({
  system,
  customers,
  products,
  defaultCustomerId,
  onDone,
}: {
  system?: System
  customers: Option[]
  products: Option[]
  defaultCustomerId?: string
  onDone: (id?: string) => void
}) {
  const isEdit = !!system
  const bound = isEdit ? updateSystem.bind(null, system!.id) : createSystem
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success(isEdit ? "Sistema actualizado" : "Sistema creado")
      const data = (r as { ok: true; data?: { id: string } }).data
      onDone(data?.id)
    } else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  const installedDefault = system?.installedAt
    ? new Date(system.installedAt).toISOString().slice(0, 10)
    : ""

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="s-name">Nombre *</Label>
        <Input id="s-name" name="name" defaultValue={system?.name} required aria-invalid={!!fe?.name} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="s-customer">Cliente *</Label>
          <Select name="customerId" defaultValue={system?.customerId ?? defaultCustomerId}>
            <SelectTrigger id="s-customer" className="w-full" aria-invalid={!!fe?.customerId}>
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fe?.customerId && <p className="text-destructive text-xs">{fe.customerId}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="s-product">Producto *</Label>
          <Select name="productId" defaultValue={system?.productId}>
            <SelectTrigger id="s-product" className="w-full" aria-invalid={!!fe?.productId}>
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fe?.productId && <p className="text-destructive text-xs">{fe.productId}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="s-env">Entorno</Label>
          <Select name="environment" defaultValue={system?.environment ?? "PRODUCTION"}>
            <SelectTrigger id="s-env" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRODUCTION">Producción</SelectItem>
              <SelectItem value="STAGING">Staging</SelectItem>
              <SelectItem value="DEVELOPMENT">Desarrollo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-status">Estado</Label>
          <Select name="status" defaultValue={system?.status ?? "ACTIVE"}>
            <SelectTrigger id="s-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Activo</SelectItem>
              <SelectItem value="PAUSED">Pausado</SelectItem>
              <SelectItem value="ARCHIVED">Archivado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="s-url">URL del sistema</Label>
          <Input id="s-url" name="url" defaultValue={system?.url ?? ""} placeholder="https://..." />
          {fe?.url && <p className="text-destructive text-xs">{fe.url}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-installed">Instalado el</Label>
          <Input id="s-installed" name="installedAt" type="date" defaultValue={installedDefault} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="s-notes">Notas</Label>
        <Textarea id="s-notes" name="notes" defaultValue={system?.notes ?? ""} rows={3} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onDone()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar" : "Crear sistema"}
        </Button>
      </div>
    </form>
  )
}
