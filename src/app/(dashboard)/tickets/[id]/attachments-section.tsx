"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Paperclip,
  Upload,
  Loader2,
  Trash2,
  FileImage,
  FileText,
  File as FileIcon,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/format"

type Attachment = {
  id: string
  filename: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedById: string | null
  uploadedByName: string | null
  createdAt: string
}

type Props = {
  ticketId: string
  attachments: Attachment[]
  currentUserId: string
  canDeleteAll: boolean
}

const MAX_SIZE_MB = 25

export function AttachmentsSection({
  ticketId,
  attachments: initial,
  currentUserId,
  canDeleteAll,
}: Props) {
  const router = useRouter()
  const [attachments, setAttachments] = useState(initial)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading(true)
    for (const file of list) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name}: supera ${MAX_SIZE_MB}MB`)
        continue
      }
      const fd = new FormData()
      fd.append("file", file)
      try {
        const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
          method: "POST",
          body: fd,
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error(`${file.name}: ${j.error ?? res.statusText}`)
          continue
        }
        const att = await res.json()
        setAttachments((a) => [
          ...a,
          {
            id: att.id,
            filename: att.filename,
            mimeType: att.mimeType,
            sizeBytes: att.sizeBytes,
            uploadedById: currentUserId,
            uploadedByName: "Vos",
            createdAt: new Date().toISOString(),
          },
        ])
        toast.success(`${file.name} subido`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al subir")
      }
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Paperclip className="size-4" />
          Adjuntos ({attachments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn(
            "rounded-md border-2 border-dashed p-4 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/20",
            uploading && "opacity-60"
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files) handleUpload(e.dataTransfer.files)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
          {uploading ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
              <Loader2 className="size-5 animate-spin" />
              Subiendo…
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="text-muted-foreground mx-auto size-5" />
              <p className="text-sm">
                Arrastrá archivos o{" "}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-primary font-medium underline"
                >
                  elegí del disco
                </button>
              </p>
              <p className="text-muted-foreground text-xs">
                Hasta {MAX_SIZE_MB}MB · imágenes, PDF, logs, zip
              </p>
            </div>
          )}
        </div>

        {attachments.length > 0 && (
          <ul className="space-y-1.5">
            {attachments.map((a) => (
              <AttachmentRow
                key={a.id}
                ticketId={ticketId}
                attachment={a}
                canDelete={canDeleteAll || a.uploadedById === currentUserId}
                onDeleted={() =>
                  setAttachments((x) => x.filter((y) => y.id !== a.id))
                }
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function AttachmentRow({
  ticketId,
  attachment,
  canDelete,
  onDeleted,
}: {
  ticketId: string
  attachment: Attachment
  canDelete: boolean
  onDeleted: () => void
}) {
  const [pending, start] = useTransition()
  return (
    <li className="hover:bg-muted/30 flex items-center gap-3 rounded-md border p-2 text-sm transition-colors">
      <AttachmentIcon mime={attachment.mimeType} />
      <a
        href={`/api/attachments/${attachment.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate hover:underline"
      >
        {attachment.filename}
      </a>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {formatSize(attachment.sizeBytes)}
      </span>
      <span className="text-muted-foreground hidden text-xs sm:inline">
        · {formatRelative(attachment.createdAt)}
      </span>
      <a
        href={`/api/attachments/${attachment.id}`}
        download={attachment.filename}
        className="text-muted-foreground hover:text-foreground"
        title="Descargar"
      >
        <Download className="size-4" />
      </a>
      {canDelete && (
        <button
          type="button"
          disabled={pending}
          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
          onClick={() => {
            if (!confirm(`¿Eliminar "${attachment.filename}"?`)) return
            start(async () => {
              const res = await fetch(
                `/api/tickets/${ticketId}/attachments?attachmentId=${attachment.id}`,
                { method: "DELETE" }
              )
              if (res.ok) {
                onDeleted()
                toast.success("Adjunto eliminado")
              } else {
                const j = await res.json().catch(() => ({}))
                toast.error(j.error ?? "Error al eliminar")
              }
            })
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      )}
    </li>
  )
}

function AttachmentIcon({ mime }: { mime: string | null }) {
  const className = "text-muted-foreground size-4 shrink-0"
  if (!mime) return <FileIcon className={className} />
  if (mime.startsWith("image/")) return <FileImage className={className} />
  if (mime === "application/pdf" || mime.startsWith("text/")) {
    return <FileText className={className} />
  }
  return <FileIcon className={className} />
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
