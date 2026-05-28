"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Bell, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

type N = {
  id: string
  kind: string
  title: string
  body: string | null
  url: string | null
  readAt: string | null
  createdAt: string
}

const POLL_MS = 30_000

export function NotificationsBell() {
  const [items, setItems] = useState<N[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  async function fetchNotifications() {
    try {
      const r = await fetch("/api/notifications")
      if (!r.ok) return
      const j = await r.json()
      setItems(j.items ?? [])
      setUnread(j.unread ?? 0)
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (!cancelled) void fetchNotifications()
    }
    tick()
    const t = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  // Refrescar cuando el tab vuelve al foco
  useEffect(() => {
    const onFocus = () => fetchNotifications()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [])

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) fetchNotifications() }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await fetch("/api/notifications", { method: "POST" })
                  await fetchNotifications()
                })
              }
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            >
              <CheckCheck className="size-3" />
              Marcar todas
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              Sin notificaciones
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  onRead={async (id) => {
                    await fetch(`/api/notifications?id=${id}`, { method: "POST" })
                    await fetchNotifications()
                  }}
                  onClose={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationItem({
  n,
  onRead,
  onClose,
}: {
  n: N
  onRead: (id: string) => Promise<void>
  onClose: () => void
}) {
  const Wrap = n.url ? Link : ("div" as React.ElementType)
  return (
    <li>
      <Wrap
        href={n.url ?? "#"}
        onClick={() => {
          if (!n.readAt) onRead(n.id)
          onClose()
        }}
        className={cn(
          "hover:bg-muted/50 block px-3 py-2.5 transition-colors",
          !n.readAt && "bg-primary/5"
        )}
      >
        <div className="flex items-start gap-2">
          {!n.readAt && (
            <span className="bg-primary mt-1.5 inline-block size-1.5 shrink-0 rounded-full" />
          )}
          <div className={cn("min-w-0 flex-1 space-y-0.5", n.readAt && "pl-3.5")}>
            <p className="truncate text-sm font-medium">{n.title}</p>
            {n.body && (
              <p className="text-muted-foreground line-clamp-2 text-xs">{n.body}</p>
            )}
            <p className="text-muted-foreground text-[11px]">
              {formatRelative(n.createdAt)}
            </p>
          </div>
        </div>
      </Wrap>
    </li>
  )
}
