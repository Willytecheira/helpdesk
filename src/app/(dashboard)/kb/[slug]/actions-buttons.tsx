"use client"

import { useState, useTransition } from "react"
import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { togglePublished, deleteArticle } from "../actions"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function PublishToggleButton({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await togglePublished(id)
          if (!r.ok) toast.error(r.error)
          else toast.success(published ? "Despublicado" : "Publicado")
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : published ? (
        <EyeOff className="size-4" />
      ) : (
        <Eye className="size-4" />
      )}
      {published ? "Despublicar" : "Publicar"}
    </Button>
  )
}

export function DeleteArticleButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="icon" className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar &quot;{title}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borrará el artículo y sus embeddings asociados. No se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => start(async () => { await deleteArticle(id) })}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Eliminar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
