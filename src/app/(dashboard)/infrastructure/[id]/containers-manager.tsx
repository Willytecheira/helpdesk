"use client"

import { useActionState, useState, useTransition } from "react"
import { Plus, Trash2, Loader2, Box } from "lucide-react"
import { toast } from "sonner"
import { createContainer, deleteContainer } from "../actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { formatRelative } from "@/lib/format"

type ContainerView = {
  id: string
  name: string
  image: string
  imageTag: string | null
  status:
    | "RUNNING"
    | "PAUSED"
    | "EXITED"
    | "RESTARTING"
    | "CREATED"
    | "DEAD"
    | "UNKNOWN"
  cpuPercent: number | null
  memoryMb: number | null
  lastSeenAt: Date | null
  system: { id: string; name: string } | null
}

const statusVariant = {
  RUNNING: "default",
  PAUSED: "secondary",
  EXITED: "outline",
  RESTARTING: "secondary",
  CREATED: "outline",
  DEAD: "destructive",
  UNKNOWN: "outline",
} as const

export function ContainersManager({
  serverId,
  systems,
  containers,
}: {
  serverId: string
  systems: { id: string; name: string }[]
  containers: ContainerView[]
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<ContainerView | null>(null)
  const [pending, start] = useTransition()

  return (
    <>
      <div className="flex items-center justify-between pb-3">
        <p className="text-muted-foreground text-sm">
          {containers.length} contenedor{containers.length === 1 ? "" : "es"}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Agregar contenedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo contenedor</DialogTitle>
            </DialogHeader>
            <NewContainerForm
              serverId={serverId}
              systems={systems}
              onDone={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {containers.length === 0 ? (
        <EmptyState
          icon={Box}
          title="Sin contenedores"
          description="Agregalos manualmente o esperá a que el agente los reporte."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Imagen</TableHead>
              <TableHead>Sistema</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">CPU</TableHead>
              <TableHead className="text-right">RAM (MB)</TableHead>
              <TableHead>Visto</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {c.image}
                  {c.imageTag && `:${c.imageTag}`}
                </TableCell>
                <TableCell>{c.system?.name || "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status]}>{c.status}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.cpuPercent != null ? `${c.cpuPercent.toFixed(1)}%` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.memoryMb != null ? c.memoryMb.toFixed(0) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatRelative(c.lastSeenAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar {deleting?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Si el agente sigue reportando este contenedor, volverá a aparecer en el próximo
            heartbeat.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!deleting) return
                start(async () => {
                  await deleteContainer(deleting.id, serverId)
                  toast.success("Contenedor eliminado")
                  setDeleting(null)
                })
              }}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

const initial: ActionResult = { ok: true }

function NewContainerForm({
  serverId,
  systems,
  onDone,
}: {
  serverId: string
  systems: { id: string; name: string }[]
  onDone: () => void
}) {
  const bound = createContainer.bind(null, serverId)
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success("Contenedor creado")
      onDone()
    } else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ct-name">Nombre *</Label>
          <Input id="ct-name" name="name" required aria-invalid={!!fe?.name} />
        </div>
        <div className="space-y-2">
          <Label>Sistema</Label>
          <Select name="systemId">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              {systems.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ct-image">Imagen *</Label>
          <Input id="ct-image" name="image" required placeholder="postgres" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ct-tag">Tag</Label>
          <Input id="ct-tag" name="imageTag" placeholder="16" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Estado</Label>
        <Select name="status" defaultValue="UNKNOWN">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="RUNNING">RUNNING</SelectItem>
            <SelectItem value="PAUSED">PAUSED</SelectItem>
            <SelectItem value="EXITED">EXITED</SelectItem>
            <SelectItem value="RESTARTING">RESTARTING</SelectItem>
            <SelectItem value="CREATED">CREATED</SelectItem>
            <SelectItem value="DEAD">DEAD</SelectItem>
            <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Crear
        </Button>
      </div>
    </form>
  )
}
