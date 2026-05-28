"use client"

import { useActionState } from "react"
import { Loader2, CheckCircle2 } from "lucide-react"
import { requestPasswordReset } from "./actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial: ActionResult = { ok: true }

export function ForgotForm() {
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    return requestPasswordReset(prev, fd)
  }, initial)

  // Si se envió con éxito (sin error), mostrar mensaje neutro
  const submitted = state.ok && Object.prototype.hasOwnProperty.call(state, "data")

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 className="text-emerald-600 size-8" />
        <p className="text-sm">
          Si existe una cuenta con ese email, te enviamos un link para restablecer la contraseña.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      {!state.ok && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {state.error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Enviar link
      </Button>
    </form>
  )
}
