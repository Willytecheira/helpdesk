"use client"

import { useActionState, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createTicket } from "./actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const initial: ActionResult = { ok: true }

type Option = { id: string; name: string }
type SystemOpt = Option & { customerId: string }
type ServerOpt = Option & { customerId: string }

type Props = {
  customers: Option[]
  systems: SystemOpt[]
  servers: ServerOpt[]
  agents: Option[]
  role: "ADMIN" | "AGENT" | "CLIENT"
  defaultCustomerId?: string | null
  onDone: (id?: string) => void
}

export function TicketForm({
  customers,
  systems,
  servers,
  agents,
  role,
  defaultCustomerId,
  onDone,
}: Props) {
  const isClient = role === "CLIENT"
  const [type, setType] = useState<"SUPPORT" | "IMPLEMENTATION">("SUPPORT")
  const [customerId, setCustomerId] = useState<string>(defaultCustomerId ?? "")

  const filteredSystems = useMemo(
    () => systems.filter((s) => !customerId || s.customerId === customerId),
    [systems, customerId]
  )
  const filteredServers = useMemo(
    () => servers.filter((s) => !customerId || s.customerId === customerId),
    [servers, customerId]
  )

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await createTicket(prev, fd)
    if (r.ok) {
      toast.success("Ticket creado")
      const data = (r as { ok: true; data?: { id: string } }).data
      onDone(data?.id)
    } else if (!r.fieldErrors) {
      toast.error(r.error)
    }
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-3">
      {!isClient && (
        <Tabs
          value={type}
          onValueChange={(v) => setType(v as "SUPPORT" | "IMPLEMENTATION")}
        >
          <TabsList>
            <TabsTrigger value="SUPPORT">Soporte</TabsTrigger>
            <TabsTrigger value="IMPLEMENTATION">Implementación</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <input type="hidden" name="type" value={type} />

      <div className="space-y-2">
        <Label htmlFor="t-title">Título *</Label>
        <Input
          id="t-title"
          name="title"
          required
          minLength={3}
          aria-invalid={!!fe?.title}
          placeholder={
            type === "IMPLEMENTATION"
              ? "ej: Integración del POS con e-commerce"
              : "ej: Error al generar reportes"
          }
        />
        {fe?.title && <p className="text-destructive text-xs">{fe.title}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="t-desc">Descripción *</Label>
        <Textarea
          id="t-desc"
          name="description"
          required
          rows={5}
          aria-invalid={!!fe?.description}
          placeholder="Detallá el problema, pasos para reproducir, mensajes de error…"
        />
        {fe?.description && (
          <p className="text-destructive text-xs">{fe.description}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Cliente *</Label>
          {isClient ? (
            <>
              <Input value={customers[0]?.name ?? ""} disabled />
              <input type="hidden" name="customerId" value={customers[0]?.id ?? ""} />
            </>
          ) : (
            <Select
              name="customerId"
              value={customerId}
              onValueChange={(v) => setCustomerId(v)}
            >
              <SelectTrigger className="w-full" aria-invalid={!!fe?.customerId}>
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {fe?.customerId && <p className="text-destructive text-xs">{fe.customerId}</p>}
        </div>

        <div className="space-y-2">
          <Label>Prioridad</Label>
          <Select name="priority" defaultValue="MEDIUM">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Baja</SelectItem>
              <SelectItem value="MEDIUM">Media</SelectItem>
              <SelectItem value="HIGH">Alta</SelectItem>
              <SelectItem value="URGENT">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Sistema (opcional)</Label>
          <Select name="systemId" key={`s-${customerId}`}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={customerId ? "Seleccionar…" : "Elegí un cliente primero"} />
            </SelectTrigger>
            <SelectContent>
              {filteredSystems.length === 0 && (
                <div className="text-muted-foreground px-3 py-2 text-xs">
                  Sin sistemas para este cliente
                </div>
              )}
              {filteredSystems.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Servidor (opcional)</Label>
          <Select name="serverId" key={`sv-${customerId}`}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={customerId ? "Seleccionar…" : "Elegí un cliente primero"} />
            </SelectTrigger>
            <SelectContent>
              {filteredServers.length === 0 && (
                <div className="text-muted-foreground px-3 py-2 text-xs">
                  Sin servidores para este cliente
                </div>
              )}
              {filteredServers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isClient && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Asignar a (opcional)</Label>
            <Select name="assignedToId">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-tags">Tags</Label>
            <Input id="t-tags" name="tags" placeholder="separados por coma" />
          </div>
        </div>
      )}

      {!isClient && type === "IMPLEMENTATION" && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Datos de implementación
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="t-budget">Presupuesto</Label>
              <Input id="t-budget" name="budgetAmount" type="number" step="0.01" min={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-curr">Moneda</Label>
              <Input id="t-curr" name="budgetCurrency" defaultValue="USD" maxLength={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-hours">Horas estimadas</Label>
              <Input id="t-hours" name="estimatedHours" type="number" step="0.5" min={0} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="t-start">Inicio</Label>
              <Input id="t-start" name="startDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-end">Fin estimado</Label>
              <Input id="t-end" name="endDate" type="date" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onDone()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Crear ticket
        </Button>
      </div>
    </form>
  )
}
