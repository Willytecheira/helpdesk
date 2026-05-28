"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  Search,
  Ticket,
  Users,
  BookOpen,
  Plus,
  Sparkles,
  LayoutDashboard,
  ServerCog,
  Boxes,
  Package,
  Settings,
  CornerDownLeft,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Role = "ADMIN" | "AGENT" | "CLIENT"

type SearchResults = {
  tickets: Array<{ id: string; code: string; title: string; customer: { name: string } }>
  customers: Array<{ id: string; name: string; slug: string }>
  kb: Array<{ id: string; slug: string; title: string }>
}

const QUICK_LINKS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "AGENT", "CLIENT"] },
  { label: "Asistente IA", href: "/ai", icon: Sparkles, roles: ["ADMIN", "AGENT", "CLIENT"] },
  { label: "Tickets", href: "/tickets", icon: Ticket, roles: ["ADMIN", "AGENT", "CLIENT"] },
  { label: "Clientes", href: "/customers", icon: Users, roles: ["ADMIN", "AGENT"] },
  { label: "Productos", href: "/products", icon: Package, roles: ["ADMIN", "AGENT"] },
  { label: "Sistemas", href: "/systems", icon: Boxes, roles: ["ADMIN", "AGENT"] },
  { label: "Infraestructura", href: "/infrastructure", icon: ServerCog, roles: ["ADMIN", "AGENT"] },
  { label: "Base de conocimiento", href: "/kb", icon: BookOpen, roles: ["ADMIN", "AGENT", "CLIENT"] },
  { label: "Integraciones", href: "/settings/integrations", icon: Settings, roles: ["ADMIN"] },
  { label: "Usuarios", href: "/settings/users", icon: Users, roles: ["ADMIN"] },
] as const

export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)

  // Atajo de teclado global
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
      // Listener para abrir desde el botón global
      if (e.key === "/" && !isInputElement(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Listener para evento custom desde otros componentes
  useEffect(() => {
    const fn = () => setOpen(true)
    window.addEventListener("open-command-palette", fn)
    return () => window.removeEventListener("open-command-palette", fn)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      const handle = setTimeout(() => setResults(null), 0)
      return () => clearTimeout(handle)
    }
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (r.ok) setResults(await r.json())
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [query])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery("")
      router.push(href)
    },
    [router]
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Búsqueda y comandos</DialogTitle>
        <DialogDescription className="sr-only">
          Buscá tickets, clientes y artículos de KB, o saltá a una sección.
        </DialogDescription>
        <Command className="[&_[cmdk-input]]:placeholder:text-muted-foreground" loop>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar tickets, clientes, KB… o saltar a una sección"
              className="placeholder:text-muted-foreground flex h-12 w-full bg-transparent text-sm outline-none"
            />
            <kbd className="text-muted-foreground bg-muted hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">
              Esc
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-1">
            <Command.Empty className="text-muted-foreground py-6 text-center text-sm">
              {loading ? "Buscando…" : "Sin resultados."}
            </Command.Empty>

            {query.trim() === "" && (
              <Command.Group heading="Navegación" className={groupClass}>
                {QUICK_LINKS.filter((q) =>
                  (q.roles as readonly string[]).includes(role)
                ).map((q) => (
                  <Command.Item
                    key={q.href}
                    onSelect={() => go(q.href)}
                    className={itemClass}
                    value={q.label}
                  >
                    <q.icon className="size-4" />
                    <span>{q.label}</span>
                    <CornerDownLeft className="text-muted-foreground ml-auto size-3.5 opacity-0 [data-selected=true]_&]:opacity-100" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {query.trim() === "" && (role === "ADMIN" || role === "AGENT") && (
              <Command.Group heading="Acciones rápidas" className={groupClass}>
                <Command.Item
                  onSelect={() => go("/tickets?new=1")}
                  className={itemClass}
                  value="Nuevo ticket"
                >
                  <Plus className="size-4" />
                  Nuevo ticket
                </Command.Item>
                <Command.Item
                  onSelect={() => go("/kb/new")}
                  className={itemClass}
                  value="Nuevo artículo KB"
                >
                  <Plus className="size-4" />
                  Nuevo artículo de KB
                </Command.Item>
              </Command.Group>
            )}

            {results?.tickets && results.tickets.length > 0 && (
              <Command.Group heading="Tickets" className={groupClass}>
                {results.tickets.map((t) => (
                  <Command.Item
                    key={t.id}
                    onSelect={() => go(`/tickets/${t.id}`)}
                    className={itemClass}
                    value={`${t.code} ${t.title}`}
                  >
                    <Ticket className="size-4" />
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground font-mono text-xs">{t.code}</span> · {t.title}
                    </span>
                    <span className="text-muted-foreground ml-auto truncate text-xs">
                      {t.customer.name}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results?.customers && results.customers.length > 0 && (
              <Command.Group heading="Clientes" className={groupClass}>
                {results.customers.map((c) => (
                  <Command.Item
                    key={c.id}
                    onSelect={() => go(`/customers/${c.id}`)}
                    className={itemClass}
                    value={`${c.name} ${c.slug}`}
                  >
                    <Users className="size-4" />
                    <span>{c.name}</span>
                    <span className="text-muted-foreground ml-auto text-xs">{c.slug}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results?.kb && results.kb.length > 0 && (
              <Command.Group heading="Base de conocimiento" className={groupClass}>
                {results.kb.map((a) => (
                  <Command.Item
                    key={a.id}
                    onSelect={() => go(`/kb/${a.slug}`)}
                    className={itemClass}
                    value={a.title}
                  >
                    <BookOpen className="size-4" />
                    <span className="truncate">{a.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const groupClass = cn(
  "[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:font-medium"
)

const itemClass = cn(
  "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
)

function isInputElement(t: EventTarget | null) {
  if (!t || !(t instanceof Element)) return false
  const tag = t.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || (t as HTMLElement).isContentEditable
}

// Botón global en el header que abre el palette
export function CommandTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      className="bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-md border px-3 text-sm transition-colors"
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Buscar o navegar…</span>
      <kbd className="bg-background hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">
        ⌘K
      </kbd>
    </button>
  )
}
