"use client"

import { useActionState, useState, useTransition } from "react"
import { Plus, Trash2, Star, Mail, Phone, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createContact, deleteContact } from "../actions"
import type { ActionResult } from "@/lib/action-result"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Contact = {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  isPrimary: boolean
}

export function ContactsManager({
  customerId,
  contacts,
}: {
  customerId: string
  contacts: Contact[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between pb-4">
          <p className="text-muted-foreground text-sm">
            {contacts.length} contacto{contacts.length === 1 ? "" : "s"}
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" />
                Agregar contacto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo contacto</DialogTitle>
              </DialogHeader>
              <NewContactForm
                customerId={customerId}
                onDone={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {contacts.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            Sin contactos registrados.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {contacts.map((c) => (
              <ContactCard key={c.id} contact={c} customerId={customerId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ContactCard({ contact, customerId }: { contact: Contact; customerId: string }) {
  const [pending, start] = useTransition()
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{contact.name}</p>
          {contact.isPrimary && (
            <Badge variant="outline" className="text-amber-600">
              <Star className="size-3" />
              Principal
            </Badge>
          )}
        </div>
        {contact.role && (
          <p className="text-muted-foreground text-xs">{contact.role}</p>
        )}
        <div className="text-muted-foreground space-y-0.5 text-xs">
          {contact.email && (
            <p className="flex items-center gap-1">
              <Mail className="size-3" />
              {contact.email}
            </p>
          )}
          {contact.phone && (
            <p className="flex items-center gap-1">
              <Phone className="size-3" />
              {contact.phone}
            </p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await deleteContact(contact.id, customerId)
            toast.success("Contacto eliminado")
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  )
}

const initial: ActionResult = { ok: true }

function NewContactForm({
  customerId,
  onDone,
}: {
  customerId: string
  onDone: () => void
}) {
  const bound = createContact.bind(null, customerId)
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const result = await bound(prev, fd)
    if (result.ok) {
      toast.success("Contacto agregado")
      onDone()
    } else if (!result.fieldErrors) {
      toast.error(result.error)
    }
    return result
  }, initial)

  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="c-name">Nombre *</Label>
        <Input id="c-name" name="name" required aria-invalid={!!fe?.name} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-phone">Teléfono</Label>
          <Input id="c-phone" name="phone" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-role">Rol / Cargo</Label>
        <Input id="c-role" name="role" placeholder="ej: Gerente IT" />
      </div>
      <div className="flex items-center gap-2">
        <input id="c-primary" name="isPrimary" type="checkbox" className="size-4" />
        <Label htmlFor="c-primary" className="cursor-pointer">
          Contacto principal
        </Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Agregar
        </Button>
      </div>
    </form>
  )
}
