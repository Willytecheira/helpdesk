"use client"

import { useActionState, useTransition } from "react"
import { Loader2, ShieldOff } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  updateProfile,
  changePassword,
  revokeMySessions,
} from "./actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial: ActionResult = { ok: true }

type Me = { name: string | null; email: string }

export function ProfileInfoForm({ me }: { me: Me }) {
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await updateProfile(prev, fd)
    if (r.ok) toast.success("Perfil actualizado")
    else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pf-name">Nombre</Label>
          <Input id="pf-name" name="name" defaultValue={me.name ?? ""} required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-email">Email</Label>
          <Input id="pf-email" name="email" type="email" defaultValue={me.email} required aria-invalid={!!fe?.email} />
          {fe?.email && <p className="text-destructive text-xs">{fe.email}</p>}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </form>
  )
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await changePassword(prev, fd)
    if (r.ok) toast.success("Contraseña actualizada — otras sesiones cerradas")
    else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="cp-current">Contraseña actual</Label>
        <Input
          id="cp-current"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={!!fe?.currentPassword}
        />
        {fe?.currentPassword && <p className="text-destructive text-xs">{fe.currentPassword}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cp-new">Nueva contraseña</Label>
          <Input
            id="cp-new"
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={!!fe?.newPassword}
          />
          {fe?.newPassword && <p className="text-destructive text-xs">{fe.newPassword}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-confirm">Confirmar</Label>
          <Input
            id="cp-confirm"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={!!fe?.confirmPassword}
          />
          {fe?.confirmPassword && <p className="text-destructive text-xs">{fe.confirmPassword}</p>}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Cambiar contraseña
        </Button>
      </div>
    </form>
  )
}

export function RevokeSessionsButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!confirm("¿Cerrar todas tus sesiones (incluyendo esta)? Vas a tener que volver a entrar.")) return
          await revokeMySessions()
          toast.success("Sesiones cerradas")
          setTimeout(() => router.push("/login"), 800)
        })
      }
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      <ShieldOff className="size-4" />
      Cerrar todas las sesiones
    </Button>
  )
}
