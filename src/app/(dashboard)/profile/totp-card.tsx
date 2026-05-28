"use client"

import { useActionState, useState, useTransition } from "react"
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react"
import QRCode from "qrcode"
import { toast } from "sonner"
import {
  startTotpSetup,
  confirmTotp,
  disableTotp,
} from "./totp-actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const initial: ActionResult = { ok: true }

export function TotpCard({ enabled }: { enabled: boolean }) {
  const [step, setStep] = useState<"idle" | "setup" | "confirmed" | "disable">("idle")
  const [setupInfo, setSetupInfo] = useState<{ secret: string; qr: string } | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [starting, startSetup] = useTransition()

  const [confirmState, confirmAction, confirming] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await confirmTotp(prev, fd)
    if (r.ok) {
      const data = (r as { ok: true; data?: { recoveryCodes: string[] } }).data
      if (data?.recoveryCodes) {
        setRecoveryCodes(data.recoveryCodes)
        setStep("confirmed")
        toast.success("2FA activado")
      }
    } else {
      toast.error(r.error)
    }
    return r
  }, initial)

  const [_disableState, disableAction, disabling] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await disableTotp(prev, fd)
    if (r.ok) {
      toast.success("2FA desactivado")
      setStep("idle")
    } else {
      toast.error(r.error)
    }
    return r
  }, initial)

  async function beginSetup() {
    startSetup(async () => {
      const r = await startTotpSetup()
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const data = (r as { ok: true; data?: { secret: string; otpauthUrl: string } }).data
      if (!data) return
      const qr = await QRCode.toDataURL(data.otpauthUrl, { margin: 1, width: 220 })
      setSetupInfo({ secret: data.secret, qr })
      setStep("setup")
    })
  }

  if (enabled && step !== "disable") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="text-emerald-600 size-5" />
            Verificación en dos pasos (2FA)
          </CardTitle>
          <CardDescription>
            Tu cuenta tiene 2FA activado. Al iniciar sesión vas a necesitar el código de tu app autenticadora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setStep("disable")}>
            <ShieldOff className="size-4" />
            Desactivar 2FA
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === "disable") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desactivar 2FA</CardTitle>
          <CardDescription>
            Ingresá un código actual de tu app (o un código de recuperación) para confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={disableAction} className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="disable-code">Código</Label>
              <Input id="disable-code" name="code" placeholder="123456" autoComplete="one-time-code" />
            </div>
            <Button type="button" variant="ghost" onClick={() => setStep("idle")}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={disabling}>
              {disabling && <Loader2 className="size-4 animate-spin" />}
              Desactivar
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  if (step === "confirmed" && recoveryCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="text-emerald-600 size-5" />
            2FA activado
          </CardTitle>
          <CardDescription>
            Guardá estos códigos de recuperación en un lugar seguro. Los vas a necesitar si perdés acceso a tu app autenticadora.
            <strong className="block mt-1">No los volveremos a mostrar.</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted grid grid-cols-2 gap-1.5 rounded-md p-3 font-mono text-xs">
            {recoveryCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(recoveryCodes.join("\n"))
              toast.success("Códigos copiados")
            }}
          >
            <Copy className="size-4" />
            Copiar todos
          </Button>
          <Button size="sm" onClick={() => { setStep("idle"); setRecoveryCodes(null) }}>
            Listo
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === "setup" && setupInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurar 2FA</CardTitle>
          <CardDescription>
            1. Escaneá este QR con tu app autenticadora (Google Authenticator, Authy, 1Password…).<br />
            2. Ingresá el código de 6 dígitos que muestra la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <img src={setupInfo.qr} alt="QR 2FA" className="rounded-md border bg-white p-2" />
            <div className="flex-1 space-y-1">
              <Label className="text-xs">O ingresar manualmente este secret:</Label>
              <code className="bg-muted block rounded-md p-2 font-mono text-xs break-all">
                {setupInfo.secret}
              </code>
            </div>
          </div>
          <form action={confirmAction} className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="totp-code">Código de la app</Label>
              <Input
                id="totp-code"
                name="code"
                placeholder="123456"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-invalid={!confirmState.ok}
              />
            </div>
            <Button type="button" variant="ghost" onClick={() => setStep("idle")}>Cancelar</Button>
            <Button type="submit" disabled={confirming}>
              {confirming && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="size-5" />
          Verificación en dos pasos (2FA)
        </CardTitle>
        <CardDescription>
          Agregá una capa extra de seguridad usando una app autenticadora.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={beginSetup} disabled={starting}>
          {starting && <Loader2 className="size-4 animate-spin" />}
          Activar 2FA
        </Button>
      </CardContent>
    </Card>
  )
}
