"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { bulkUpdateTickets } from "./actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SlaBadge } from "@/components/sla-badge"
import { formatRelative } from "@/lib/format"
import {
  ticketStatusLabel,
  ticketStatusVariant,
  priorityLabel,
  priorityVariant,
  ticketTypeLabel,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
} from "@/lib/ticket-ui"

type TicketRow = {
  id: string
  code: string
  title: string
  tags: string[]
  type: "SUPPORT" | "IMPLEMENTATION"
  status: (typeof TICKET_STATUSES)[number]
  priority: (typeof TICKET_PRIORITIES)[number]
  dueAt: string | null
  customer: { id: string; name: string }
  system: { name: string } | null
  assignedTo: { name: string | null; email: string } | null
  commentsCount: number
  createdAt: string
}

type Agent = { id: string; name: string }

export function TicketsTable({
  tickets,
  isClient,
  agents,
}: {
  tickets: TicketRow[]
  isClient: boolean
  agents: Agent[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()

  const allSelected = tickets.length > 0 && selected.size === tickets.length
  const canBulk = !isClient

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(tickets.map((t) => t.id)))
  }

  function runBulk(action: "status" | "priority" | "assign", value: string) {
    const ids = [...selected]
    start(async () => {
      const r = await bulkUpdateTickets({ ids, action, value })
      if (r.ok) {
        const data = (r as { ok: true; data?: { updated: number } }).data
        toast.success(`${data?.updated ?? ids.length} tickets actualizados`)
        setSelected(new Set())
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          <TableRow>
            {canBulk && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4"
                  aria-label="Seleccionar todos"
                />
              </TableHead>
            )}
            <TableHead>Código</TableHead>
            <TableHead>Título</TableHead>
            {!isClient && <TableHead>Cliente</TableHead>}
            <TableHead>Sistema</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Estado</TableHead>
            {!isClient && <TableHead>Asignado</TableHead>}
            <TableHead className="text-right">Coment.</TableHead>
            <TableHead>Creado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((t) => (
            <TableRow key={t.id} data-state={selected.has(t.id) ? "selected" : undefined}>
              {canBulk && (
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="size-4"
                    aria-label={`Seleccionar ${t.code}`}
                  />
                </TableCell>
              )}
              <TableCell className="font-mono text-xs">
                <Link href={`/tickets/${t.id}`} className="hover:underline">
                  {t.code}
                </Link>
              </TableCell>
              <TableCell className="max-w-xs">
                <Link href={`/tickets/${t.id}`} className="block truncate font-medium hover:underline">
                  {t.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <SlaBadge dueAt={t.dueAt} ticketStatus={t.status} />
                  {t.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              {!isClient && (
                <TableCell>
                  <Link
                    href={`/customers/${t.customer.id}`}
                    className="text-muted-foreground text-sm hover:text-foreground"
                  >
                    {t.customer.name}
                  </Link>
                </TableCell>
              )}
              <TableCell className="text-sm">
                {t.system?.name ?? <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {ticketTypeLabel[t.type]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={priorityVariant[t.priority]} className="text-xs">
                  {priorityLabel[t.priority]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={ticketStatusVariant[t.status]} className="text-xs">
                  {ticketStatusLabel[t.status]}
                </Badge>
              </TableCell>
              {!isClient && (
                <TableCell className="text-muted-foreground text-sm">
                  {t.assignedTo?.name ?? t.assignedTo?.email ?? "—"}
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">{t.commentsCount}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatRelative(t.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canBulk && selected.size > 0 && (
        <div className="bg-background fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border p-2 shadow-lg">
          <span className="px-2 text-sm font-medium">{selected.size} seleccionados</span>

          <Select onValueChange={(v) => runBulk("status", v)} disabled={pending}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder="Cambiar estado" />
            </SelectTrigger>
            <SelectContent>
              {TICKET_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{ticketStatusLabel[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={(v) => runBulk("priority", v)} disabled={pending}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              {TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{priorityLabel[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={(v) => runBulk("assign", v)} disabled={pending}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder="Asignar a" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassign__">Sin asignar</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {pending && <Loader2 className="size-4 animate-spin" />}

          <Button variant="ghost" size="icon" onClick={() => setSelected(new Set())}>
            <X className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
