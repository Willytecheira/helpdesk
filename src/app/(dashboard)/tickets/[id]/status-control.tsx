"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { setTicketStatus, setTicketPriority, assignTicket } from "../actions"
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

const UNASSIGNED = "__unassigned__"

export function StatusControl({
  ticketId,
  value,
  disabled,
}: {
  ticketId: string
  value: (typeof TICKET_STATUSES)[number]
  disabled?: boolean
}) {
  const [pending, start] = useTransition()
  return (
    <Select
      disabled={disabled || pending}
      value={value}
      onValueChange={(v) => {
        start(async () => {
          const r = await setTicketStatus(ticketId, v as (typeof TICKET_STATUSES)[number])
          if (!r.ok) toast.error(r.error)
          else toast.success("Estado actualizado")
        })
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TICKET_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {ticketStatusLabel[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function PriorityControl({
  ticketId,
  value,
}: {
  ticketId: string
  value: (typeof TICKET_PRIORITIES)[number]
}) {
  const [pending, start] = useTransition()
  return (
    <Select
      disabled={pending}
      value={value}
      onValueChange={(v) => {
        start(async () => {
          const r = await setTicketPriority(
            ticketId,
            v as (typeof TICKET_PRIORITIES)[number]
          )
          if (!r.ok) toast.error(r.error)
          else toast.success("Prioridad actualizada")
        })
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TICKET_PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            {priorityLabel[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AssignControl({
  ticketId,
  value,
  agents,
}: {
  ticketId: string
  value: string | null
  agents: { id: string; name: string }[]
}) {
  const [pending, start] = useTransition()
  return (
    <Select
      disabled={pending}
      value={value ?? UNASSIGNED}
      onValueChange={(v) => {
        const newValue = v === UNASSIGNED ? null : v
        start(async () => {
          const r = await assignTicket(ticketId, newValue)
          if (!r.ok) toast.error(r.error)
          else toast.success(newValue ? "Asignado" : "Sin asignar")
        })
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Sin asignar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
        {agents.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
