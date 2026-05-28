"use client"

import { useActionState, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { inviteUser, updateUser } from "./actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
type UserView = {
  id: string
  email: string
  name: string | null
  role: "ADMIN" | "AGENT" | "CLIENT"
  customerId: string | null
  active: boolean
}

type Props = {
  user?: UserView
  customers: Option[]
  emailEnabled: boolean
  onDone: (id?: string, inviteUrl?: string) => void
}

export function UserForm({ user, customers, emailEnabled, onDone }: Props) {
  const isEdit = !!user
  const [role, setRole] = useState<UserView["role"]>(user?.role ?? "AGENT")
  const [customerId, setCustomerId] = useState<string>(user?.customerId ?? "")

  const bound = isEdit ? updateUser.bind(null, user!.id) : inviteUser
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success(isEdit ? "Usuario actualizado" : "Usuario creado")
      const data = (r as { ok: true; data?: { id: string; setPasswordUrl?: string } }).data
      onDone(data?.id, data?.setPasswordUrl)
    } else if (!r.fieldErrors) {
      toast.error(r.error)
    }
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="u-name">Nombre *</Label>
          <Input
            id="u-name"
            name="name"
            defaultValue={user?.name ?? ""}
            required
            minLength={2}
            aria-invalid={!!fe?.name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="u-email">Email *</Label>
          <Input
            id="u-email"
            name="email"
            type="email"
            defaultValue={user?.email}
            required
            aria-invalid={!!fe?.email}
          />
          {fe?.email && <p className="text-destructive text-xs">{fe.email}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Rol *</Label>
          <Select name="role" value={role} onValueChange={(v) => setRole(v as UserView["role"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Administrador</SelectItem>
              <SelectItem value="AGENT">Técnico / Agente</SelectItem>
              <SelectItem value="CLIENT">Cliente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cliente {role === "CLIENT" && <span className="text-destructive">*</span>}</Label>
          <Select
            name="customerId"
            value={customerId || NONE}
            onValueChange={(v) => setCustomerId(v === NONE ? "" : v)}
            disabled={role !== "CLIENT"}
          >
            <SelectTrigger className="w-full" aria-invalid={!!fe?.customerId}>
              <SelectValue placeholder={role === "CLIENT" ? "Seleccionar…" : "Sólo para CLIENT"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin vincular</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fe?.customerId && <p className="text-destructive text-xs">{fe.customerId}</p>}
        </div>
      </div>

      {isEdit && (
        <div className="flex items-center gap-2 rounded-md border p-3">
          <input
            id="u-active"
            name="active"
            type="checkbox"
            defaultChecked={user?.active ?? true}
            className="size-4"
          />
          <Label htmlFor="u-active" className="cursor-pointer">
            Cuenta activa
          </Label>
        </div>
      )}

      {!isEdit && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
          <input
            id="u-send"
            name="sendInvite"
            type="checkbox"
            defaultChecked={emailEnabled}
            disabled={!emailEnabled}
            className="size-4"
          />
          <Label htmlFor="u-send" className="cursor-pointer text-sm">
            Enviar invitación por email
            {!emailEnabled && (
              <span className="text-muted-foreground ml-2 text-xs">
                (Resend no configurado — copiarás el link manualmente)
              </span>
            )}
          </Label>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onDone()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar" : "Crear e invitar"}
        </Button>
      </div>
    </form>
  )
}
