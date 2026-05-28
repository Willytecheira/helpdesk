"use client"

import { useActionState, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { loginAction, type LoginState } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: LoginState = {}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState)
  const [email, setEmail] = useState("")
  const [showTotp, setShowTotp] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleEmailBlur() {
    if (!email || !email.includes("@")) return
    setChecking(true)
    try {
      const r = await fetch("/api/auth/check-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (r.ok) {
        const j = await r.json()
        setShowTotp(!!j.required)
      }
    } catch {
      /* silencioso */
    } finally {
      setChecking(false)
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@empresa.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleEmailBlur}
          aria-invalid={!!state.fieldErrors?.email}
        />
        {state.fieldErrors?.email && (
          <p className="text-destructive text-xs">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
        />
        {state.fieldErrors?.password && (
          <p className="text-destructive text-xs">{state.fieldErrors.password}</p>
        )}
      </div>

      {showTotp && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <Label htmlFor="totp" className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="text-primary size-3.5" />
            Código de verificación (2FA)
          </Label>
          <Input
            id="totp"
            name="totp"
            placeholder="123456 ó código de recuperación"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={15}
          />
        </div>
      )}

      {state.error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {state.error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending || checking}>
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Iniciar sesión
      </Button>
    </form>
  )
}
