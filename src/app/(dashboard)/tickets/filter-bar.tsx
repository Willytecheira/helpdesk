"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  ticketStatusLabel,
  priorityLabel,
} from "@/lib/ticket-ui"

type Option = { id: string; name: string }

const ANY = "ALL"

export function TicketFilterBar({
  customers,
  showCustomer,
}: {
  customers: Option[]
  showCustomer: boolean
}) {
  const router = useRouter()
  const params = useSearchParams()

  const update = (key: string, value: string | null) => {
    const sp = new URLSearchParams(params.toString())
    if (!value || value === ANY) sp.delete(key)
    else sp.set(key, value)
    router.push(`/tickets?${sp.toString()}`)
  }

  const has =
    !!params.get("q") ||
    !!params.get("status") ||
    !!params.get("priority") ||
    !!params.get("type") ||
    !!params.get("customerId")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const q = String(fd.get("q") ?? "")
        update("q", q || null)
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <div className="relative max-w-sm flex-1 min-w-[200px]">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Buscar por título o código…"
          className="pl-9"
        />
      </div>

      <Select
        value={params.get("status") ?? ANY}
        onValueChange={(v) => update("status", v === ANY ? null : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Cualquier estado</SelectItem>
          {TICKET_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {ticketStatusLabel[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("priority") ?? ANY}
        onValueChange={(v) => update("priority", v === ANY ? null : v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Prioridad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Cualquier prioridad</SelectItem>
          {TICKET_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {priorityLabel[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("type") ?? ANY}
        onValueChange={(v) => update("type", v === ANY ? null : v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Todos los tipos</SelectItem>
          <SelectItem value="SUPPORT">Soporte</SelectItem>
          <SelectItem value="IMPLEMENTATION">Implementación</SelectItem>
        </SelectContent>
      </Select>

      {showCustomer && (
        <Select
          value={params.get("customerId") ?? ANY}
          onValueChange={(v) => update("customerId", v === ANY ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos los clientes</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Button type="submit" variant="outline" size="sm">
        Buscar
      </Button>

      {has && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/tickets")}
        >
          <X className="size-4" />
          Limpiar
        </Button>
      )}
    </form>
  )
}
