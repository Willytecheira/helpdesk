"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, Star, Loader2, Bot } from "lucide-react"
import { toast } from "sonner"
import { deleteAgent, setDefaultAgent } from "./actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { AgentForm } from "./agent-form"

type ProviderInfo = { id: string; label: string; models: string[]; configured: boolean }
type ToolInfo = { name: string; label: string; mutates: boolean }
type AgentView = {
  id: string
  name: string
  description: string | null
  provider: string
  model: string
  systemPrompt: string
  tools: string[]
  temperature: number
  maxTokens: number
  useRag: boolean
  isDefault: boolean
  active: boolean
}

export function AgentsManager({
  agents,
  providers,
  toolsCatalog,
}: {
  agents: AgentView[]
  providers: ProviderInfo[]
  toolsCatalog: ToolInfo[]
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<AgentView | null>(null)
  const [pending, start] = useTransition()

  const anyConfigured = providers.some((p) => p.configured)
  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? id

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-muted-foreground text-sm">
          {agents.length} agente{agents.length === 1 ? "" : "s"}
        </p>
        <Button onClick={() => setNewOpen(true)} disabled={!anyConfigured}>
          <Plus className="size-4" />
          Nuevo agente
        </Button>
      </div>

      {!anyConfigured && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Configurá al menos un proveedor de IA en{" "}
          <a href="/settings/integrations" className="font-medium underline">Integraciones</a>{" "}
          antes de crear agentes.
        </div>
      )}

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="Sin agentes"
          description="Creá agentes especializados (soporte N1, ventas, técnico…) con su propio modelo, prompt y herramientas."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((a) => (
            <Card key={a.id} className={!a.active ? "opacity-60" : ""}>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{a.name}</p>
                      {a.isDefault && (
                        <Badge variant="default" className="gap-1 text-[10px]">
                          <Star className="size-3" /> Default
                        </Badge>
                      )}
                      {!a.active && <Badge variant="outline">Inactivo</Badge>}
                    </div>
                    {a.description && (
                      <p className="text-muted-foreground line-clamp-1 text-xs">{a.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">{providerLabel(a.provider)}</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">{a.model}</Badge>
                  {a.useRag && <Badge variant="outline" className="text-[10px]">RAG</Badge>}
                  <Badge variant="outline" className="text-[10px]">{a.tools.length} tools</Badge>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                  {!a.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await setDefaultAgent(a.id)
                          if (r.ok) toast.success("Marcado como default")
                          else toast.error(r.error)
                        })
                      }
                    >
                      <Star className="size-3.5" /> Default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive ml-auto"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        if (!confirm(`¿Eliminar el agente "${a.name}"?`)) return
                        const r = await deleteAgent(a.id)
                        if (r.ok) toast.success("Eliminado")
                        else toast.error(r.error)
                      })
                    }
                  >
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo agente</DialogTitle>
            <DialogDescription>Definí proveedor, modelo, prompt y herramientas.</DialogDescription>
          </DialogHeader>
          <AgentForm providers={providers} toolsCatalog={toolsCatalog} onDone={() => setNewOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar agente</DialogTitle>
          </DialogHeader>
          {editing && (
            <AgentForm
              agent={editing}
              providers={providers}
              toolsCatalog={toolsCatalog}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
