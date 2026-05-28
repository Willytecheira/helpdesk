"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertOctagon, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // En cliente: registrar en consola para devtools. En server-side errors,
    // pino ya capturó el detalle.
    // eslint-disable-next-line no-console
    console.error("[error-boundary]", error)
  }, [error])

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="bg-destructive/10 text-destructive mx-auto flex size-16 items-center justify-center rounded-full">
          <AlertOctagon className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Algo salió mal</h1>
          <p className="text-muted-foreground text-sm">
            Ocurrió un error inesperado. Podés reintentar o volver al inicio.
          </p>
          {error.digest && (
            <p className="text-muted-foreground font-mono text-xs">
              ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>
            <RefreshCw className="size-4" />
            Reintentar
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">
              <Home className="size-4" />
              Volver al dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
