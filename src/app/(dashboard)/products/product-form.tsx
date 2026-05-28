"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Product } from "@prisma/client"
import { createProduct, updateProduct } from "./actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const initial: ActionResult = { ok: true }

export function ProductForm({
  product,
  onDone,
}: {
  product?: Product
  onDone: () => void
}) {
  const isEdit = !!product
  const bound = isEdit ? updateProduct.bind(null, product!.id) : createProduct
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success(isEdit ? "Producto actualizado" : "Producto creado")
      onDone()
    } else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-name">Nombre *</Label>
          <Input id="p-name" name="name" defaultValue={product?.name} required aria-invalid={!!fe?.name} />
          {fe?.name && <p className="text-destructive text-xs">{fe.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-slug">Slug</Label>
          <Input
            id="p-slug"
            name="slug"
            defaultValue={product?.slug}
            placeholder="auto si vacío"
            aria-invalid={!!fe?.slug}
          />
          {fe?.slug && <p className="text-destructive text-xs">{fe.slug}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-version">Versión</Label>
        <Input id="p-version" name="version" defaultValue={product?.version ?? ""} placeholder="ej: 3.2.0" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-desc">Descripción</Label>
        <Textarea id="p-desc" name="description" defaultValue={product?.description ?? ""} rows={3} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
