"use client"

import { useActionState, useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { linkSystemToServer } from "../actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const initial: ActionResult = { ok: true }

type Option = { id: string; name: string }

export function LinkServerToSystem({
  systemId,
  availableServers,
}: {
  systemId: string
  availableServers: Option[]
}) {
  const [open, setOpen] = useState(false)
  const bound = linkSystemToServer.bind(null, systemId)

  const [_state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success("Servidor vinculado")
      setOpen(false)
    } else {
      toast.error(r.error)
    }
    return r
  }, initial)

  if (availableServers.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Todos los servidores del cliente ya están vinculados.
      </p>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          Vincular servidor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular servidor al sistema</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ls-server">Servidor</Label>
            <Select name="serverId">
              <SelectTrigger id="ls-server" className="w-full">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {availableServers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ls-role">Rol (opcional)</Label>
            <Input id="ls-role" name="role" placeholder="ej: web, db, worker" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Vincular
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
