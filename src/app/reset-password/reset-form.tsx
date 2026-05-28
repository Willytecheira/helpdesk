"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { resetPassword } from "./actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial: ActionResult = { ok: true }

export function ResetForm({ token }: { token: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await resetPassword(prev, fd)
    if (r.ok) {
      toast.success("Contraseña actualizada. Iniciá sesión.")
      setTimeout(() => router.push("/login"), 1200)
    } else if (!r.fieldErrors) {
      toast.error(r.error)
    }
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  if (state.ok && Object.prototype.hasOwnProperty.call(state, "data")) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 className="text-emerald-600 size-8" />
        <p className="text-sm">Contraseña actualizada. Redirigiendo al login…</p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          aria-invalid={!!fe?.password}
        />
        {fe?.password && <p className="text-destructive text-xs">{fe.password}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="passwordConfirm">Confirmar contraseña</Label>
        <Input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          aria-invalid={!!fe?.passwordConfirm}
        />
        {fe?.passwordConfirm && (
          <p className="text-destructive text-xs">{fe.passwordConfirm}</p>
        )}
      </div>

      {!state.ok && !state.fieldErrors && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {state.error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Establecer contraseña
      </Button>
    </form>
  )
}
