"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { KbArticle } from "@prisma/client"
import { createArticle, updateArticle } from "./actions"
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
import { cn } from "@/lib/utils"

const NONE = "__none__"
const initial: ActionResult = { ok: true }

type Option = { id: string; name: string }
type SystemOpt = Option & { customerId: string }

type Props = {
  article?: KbArticle
  products: Option[]
  customers: Option[]
  systems: SystemOpt[]
}

export function ArticleEditor({ article, products, customers, systems }: Props) {
  const router = useRouter()
  const isEdit = !!article
  const [showPreview, setShowPreview] = useState(true)
  const [body, setBody] = useState(article?.body ?? "")
  const [customerId, setCustomerId] = useState<string | null>(article?.customerId ?? null)

  const filteredSystems = customerId
    ? systems.filter((s) => s.customerId === customerId)
    : systems

  const bound = isEdit ? updateArticle.bind(null, article!.id) : createArticle

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success(isEdit ? "Artículo actualizado" : "Artículo creado")
      const data = (r as { ok: true; data?: { slug: string } }).data
      if (data?.slug) router.push(`/kb/${data.slug}`)
    } else if (!r.fieldErrors) {
      toast.error(r.error)
    }
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kb-title">Título *</Label>
          <Input
            id="kb-title"
            name="title"
            defaultValue={article?.title}
            required
            minLength={3}
            placeholder="ej: Cómo resolver timeouts en reportes del ERP"
            aria-invalid={!!fe?.title}
          />
          {fe?.title && <p className="text-destructive text-xs">{fe.title}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="kb-slug">Slug</Label>
          <Input
            id="kb-slug"
            name="slug"
            defaultValue={article?.slug}
            placeholder="auto-generado si vacío"
            aria-invalid={!!fe?.slug}
          />
          {fe?.slug && <p className="text-destructive text-xs">{fe.slug}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Producto</Label>
          <Select name="productId" defaultValue={article?.productId ?? NONE}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Ninguno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cliente (opcional)</Label>
          <Select
            name="customerId"
            value={customerId ?? NONE}
            onValueChange={(v) => setCustomerId(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Visible para todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Visible para todos</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sistema</Label>
          <Select name="systemId" defaultValue={article?.systemId ?? NONE} key={customerId ?? "all"}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {filteredSystems.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="kb-tags">Tags (separados por coma)</Label>
        <Input
          id="kb-tags"
          name="tags"
          defaultValue={article?.tags.join(", ")}
          placeholder="erp, reporting, performance"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="kb-body">Contenido (Markdown) *</Label>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
          >
            {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showPreview ? "Ocultar preview" : "Mostrar preview"}
          </button>
        </div>
        <div className={cn("grid gap-3", showPreview && "lg:grid-cols-2")}>
          <Textarea
            id="kb-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            required
            aria-invalid={!!fe?.body}
            placeholder="# Título&#10;&#10;Escribí el artículo usando Markdown…&#10;&#10;- Listas&#10;- **Negrita**&#10;- `código`&#10;&#10;```bash&#10;comando ejemplo&#10;```"
            className="font-mono text-sm"
          />
          {showPreview && (
            <div className="bg-muted/20 max-h-[480px] overflow-y-auto rounded-md border p-4">
              {body.trim() ? (
                <div className="markdown-body text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  El preview aparecerá acá mientras escribís.
                </p>
              )}
            </div>
          )}
        </div>
        {fe?.body && <p className="text-destructive text-xs">{fe.body}</p>}
      </div>

      <div className="flex items-center gap-2 rounded-md border p-3">
        <input
          id="kb-pub"
          name="published"
          type="checkbox"
          defaultChecked={article?.published ?? true}
          className="size-4"
        />
        <Label htmlFor="kb-pub" className="cursor-pointer text-sm">
          Publicar (visible para clientes y usado por la IA en RAG)
        </Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar cambios" : "Crear artículo"}
        </Button>
      </div>
    </form>
  )
}
