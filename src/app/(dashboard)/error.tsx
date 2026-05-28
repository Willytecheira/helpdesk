"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[dashboard-error]", error)
  }, [error])

  return (
    <div className="p-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
            <AlertTriangle className="size-6" />
          </div>
          <h2 className="text-lg font-semibold">Esta sección tuvo un problema</h2>
          <p className="text-muted-foreground max-w-md text-sm">
            No pudimos cargar el contenido. Probá recargar o navegar a otra sección.
          </p>
          {error.digest && (
            <p className="text-muted-foreground font-mono text-xs">
              ID: {error.digest}
            </p>
          )}
          <Button onClick={reset} className="mt-2">
            <RefreshCw className="size-4" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
