"use client"

import { useState, useTransition } from "react"
import {
  Plus,
  Pencil,
  ShieldOff,
  MoreVertical,
  Mail,
  Loader2,
  Copy,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { revokeUserSessions, resendInvite } from "./actions"
import { Button } from "@/components/ui/button"
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
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelative } from "@/lib/format"
import { UserForm } from "./user-form"

type UserRow = {
  id: string
  email: string
  name: string | null
  role: "ADMIN" | "AGENT" | "CLIENT"
  customerId: string | null
  customerName: string | null
  active: boolean
  hasPassword: boolean
  twoFactorEnabled: boolean
  createdAt: string
}

type Option = { id: string; name: string }

const roleLabel = { ADMIN: "Administrador", AGENT: "Técnico", CLIENT: "Cliente" } as const
const roleVariant = { ADMIN: "default", AGENT: "secondary", CLIENT: "outline" } as const

export function UsersTable({
  users,
  customers,
  emailEnabled,
  currentUserId,
}: {
  users: UserRow[]
  customers: Option[]
  emailEnabled: boolean
  currentUserId: string
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-muted-foreground text-sm">
          {users.length} usuario{users.length === 1 ? "" : "s"}
        </p>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="size-4" />
          Invitar usuario
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id} className={!u.active ? "opacity-50" : ""}>
              <TableCell>
                <div className="font-medium">{u.name ?? "—"}</div>
                <div className="text-muted-foreground text-xs">{u.email}</div>
              </TableCell>
              <TableCell>
                <Badge variant={roleVariant[u.role]}>{roleLabel[u.role]}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {u.customerName ?? "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  {!u.active && <Badge variant="outline">Inactivo</Badge>}
                  {!u.hasPassword && (
                    <Badge variant="outline" className="text-amber-600">
                      Pendiente activación
                    </Badge>
                  )}
                  {u.twoFactorEnabled && (
                    <Badge variant="outline" className="text-emerald-600">2FA</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatRelative(u.createdAt)}
              </TableCell>
              <TableCell>
                <UserActions
                  user={u}
                  isSelf={u.id === currentUserId}
                  emailEnabled={emailEnabled}
                  onEdit={() => setEditing(u)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
            <DialogDescription>
              Se enviará un email (si Resend está configurado) con link para activar la cuenta.
            </DialogDescription>
          </DialogHeader>
          <UserForm
            customers={customers}
            emailEnabled={emailEnabled}
            onDone={(_id, url) => {
              setNewOpen(false)
              if (url) {
                setInviteUrl(url)
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          {editing && (
            <UserForm
              user={editing}
              customers={customers}
              emailEnabled={emailEnabled}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!inviteUrl} onOpenChange={(o) => !o && setInviteUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de invitación</DialogTitle>
            <DialogDescription>
              {emailEnabled
                ? "También enviamos un email al usuario. Si no lo recibe, podés copiar este link manualmente."
                : "Compartile este link al usuario para que active la cuenta (válido 7 días):"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
              {inviteUrl}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  if (!inviteUrl) return
                  await navigator.clipboard.writeText(inviteUrl)
                  setCopied(true)
                  toast.success("Link copiado")
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                Copiar link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function UserActions({
  user,
  isSelf,
  emailEnabled,
  onEdit,
}: {
  user: UserRow
  isSelf: boolean
  emailEnabled: boolean
  onEdit: () => void
}) {
  const [pending, start] = useTransition()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          Editar
        </DropdownMenuItem>
        {!user.hasPassword && emailEnabled && (
          <DropdownMenuItem
            onClick={() =>
              start(async () => {
                const r = await resendInvite(user.id)
                if (r.ok) toast.success("Invitación re-enviada")
                else toast.error(r.error)
              })
            }
          >
            <Mail className="size-4" />
            Re-enviar invitación
          </DropdownMenuItem>
        )}
        {!isSelf && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() =>
              start(async () => {
                if (!confirm(`¿Cerrar todas las sesiones de ${user.email}?`)) return
                const r = await revokeUserSessions(user.id)
                if (r.ok) toast.success("Sesiones cerradas")
                else toast.error(r.error)
              })
            }
          >
            <ShieldOff className="size-4" />
            Cerrar sus sesiones
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
