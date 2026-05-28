"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/** Botón que descarga un CSV desde un endpoint, preservando los query params actuales. */
export function ExportButton({
  endpoint,
  label = "Exportar CSV",
  includeSearchParams = true,
}: {
  endpoint: string
  label?: string
  includeSearchParams?: boolean
}) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const url = new URL(endpoint, window.location.origin)
      if (includeSearchParams) {
        const current = new URLSearchParams(window.location.search)
        current.forEach((v, k) => url.searchParams.set(k, v))
      }
      const res = await fetch(url.toString())
      if (!res.ok) {
        toast.error("No se pudo exportar")
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = /filename="?([^"]+)"?/.exec(disposition)
      const filename = match?.[1] ?? "export.csv"

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success("Descarga iniciada")
    } catch {
      toast.error("Error al exportar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {label}
    </Button>
  )
}
