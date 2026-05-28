"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Customer } from "@prisma/client"
import { createCustomer, updateCustomer } from "./actions"
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

const initialState: ActionResult = { ok: true }

type Props = {
  customer?: Customer
  onSuccess?: (id: string) => void
  onCancel?: () => void
}

export function CustomerForm({ customer, onSuccess, onCancel }: Props) {
  const isEdit = !!customer
  const boundAction = isEdit
    ? updateCustomer.bind(null, customer!.id)
    : createCustomer

  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await boundAction(prev, formData)
    if (result.ok) {
      toast.success(isEdit ? "Cliente actualizado" : "Cliente creado")
      const data = (result as { ok: true; data?: { id: string } }).data
      onSuccess?.(data?.id ?? customer?.id ?? "")
    } else if (!result.fieldErrors) {
      toast.error(result.error)
    }
    return result
  }, initialState)

  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={customer?.name}
            required
            aria-invalid={!!fe?.name}
          />
          {fe?.name && <p className="text-destructive text-xs">{fe.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={customer?.slug}
            placeholder="auto-generado si vacío"
            aria-invalid={!!fe?.slug}
          />
          {fe?.slug && <p className="text-destructive text-xs">{fe.slug}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            aria-invalid={!!fe?.email}
          />
          {fe?.email && <p className="text-destructive text-xs">{fe.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Sitio web</Label>
        <Input
          id="website"
          name="website"
          defaultValue={customer?.website ?? ""}
          placeholder="https://..."
          aria-invalid={!!fe?.website}
        />
        {fe?.website && <p className="text-destructive text-xs">{fe.website}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" name="address" defaultValue={customer?.address ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Estado</Label>
        <Select name="status" defaultValue={customer?.status ?? "ACTIVE"}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Activo</SelectItem>
            <SelectItem value="PROSPECT">Prospecto</SelectItem>
            <SelectItem value="INACTIVE">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" defaultValue={customer?.notes ?? ""} rows={3} />
      </div>

      {!state.ok && !state.fieldErrors && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {state.error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </div>
    </form>
  )
}
