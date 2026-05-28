"use client"

import { useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export function ReportButton({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(false)

  // Últimos 6 meses como opciones
  const options: { year: number; month: number; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    })
  }

  async function download(year: number, month: number) {
    setLoading(true)
    try {
      const url = `/api/reports/monthly?customerId=${customerId}&year=${year}&month=${month}`
      const res = await fetch(url)
      if (!res.ok) {
        toast.error("No se pudo generar el reporte")
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? "reporte.pdf"
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success("Reporte descargado")
    } catch {
      toast.error("Error al generar el reporte")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          Reporte PDF
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Reporte mensual</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuItem key={`${o.year}-${o.month}`} onClick={() => download(o.year, o.month)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
