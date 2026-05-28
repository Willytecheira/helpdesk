"use client"

import { useActionState, useRef } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { addTicketComment } from "../actions"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const initial: ActionResult = { ok: true }

export function CommentForm({
  ticketId,
  canMarkInternal,
}: {
  ticketId: string
  canMarkInternal: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const bound = addTicketComment.bind(null, ticketId)
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success("Comentario agregado")
      formRef.current?.reset()
    } else if (!r.fieldErrors) {
      toast.error(r.error)
    }
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="cmt-body" className="text-xs uppercase tracking-wider text-muted-foreground">
          Agregar comentario
        </Label>
        <Textarea
          id="cmt-body"
          name="body"
          rows={4}
          placeholder="Escribí tu mensaje…"
          aria-invalid={!!fe?.body}
        />
        {fe?.body && <p className="text-destructive text-xs">{fe.body}</p>}
      </div>
      <div className="flex items-center justify-between gap-2">
        {canMarkInternal ? (
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input type="checkbox" name="isInternal" className="size-4" />
            Nota interna (no visible al cliente)
          </label>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Enviar
        </Button>
      </div>
    </form>
  )
}
