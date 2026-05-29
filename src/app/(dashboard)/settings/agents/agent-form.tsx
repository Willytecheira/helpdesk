"use client"

import { useActionState, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createAgent, updateAgent } from "./actions"
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

const initial: ActionResult = { ok: true }

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

export function AgentForm({
  agent,
  providers,
  toolsCatalog,
  onDone,
}: {
  agent?: AgentView
  providers: ProviderInfo[]
  toolsCatalog: ToolInfo[]
  onDone: () => void
}) {
  const isEdit = !!agent
  const [provider, setProvider] = useState(agent?.provider ?? providers.find((p) => p.configured)?.id ?? providers[0]?.id ?? "anthropic")
  const [model, setModel] = useState(agent?.model ?? "")

  const bound = isEdit ? updateAgent.bind(null, agent!.id) : createAgent
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await bound(prev, fd)
    if (r.ok) {
      toast.success(isEdit ? "Agente actualizado" : "Agente creado")
      onDone()
    } else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  const currentProvider = providers.find((p) => p.id === provider)
  const models = currentProvider?.models ?? []
  const effectiveModel = model || models[0] || ""

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ag-name">Nombre *</Label>
          <Input id="ag-name" name="name" defaultValue={agent?.name} required placeholder="ej: Soporte N1" aria-invalid={!!fe?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ag-desc">Descripción</Label>
          <Input id="ag-desc" name="description" defaultValue={agent?.description ?? ""} placeholder="Para qué sirve este agente" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Proveedor *</Label>
          <Select name="provider" value={provider} onValueChange={(v) => { setProvider(v); setModel("") }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={!p.configured}>
                  {p.label}{!p.configured ? " (sin API key)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modelo *</Label>
          <Select name="model" value={effectiveModel} onValueChange={setModel}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Elegí un modelo" /></SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ag-prompt">System prompt *</Label>
        <Textarea
          id="ag-prompt"
          name="systemPrompt"
          defaultValue={agent?.systemPrompt}
          rows={6}
          required
          placeholder="Definí la personalidad, alcance y reglas del agente…"
          aria-invalid={!!fe?.systemPrompt}
        />
        {fe?.systemPrompt && <p className="text-destructive text-xs">{fe.systemPrompt}</p>}
      </div>

      <div className="space-y-2">
        <Label>Herramientas habilitadas</Label>
        <div className="grid gap-1.5 rounded-md border p-3 sm:grid-cols-2">
          {toolsCatalog.map((t) => (
            <label key={t.name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tools"
                value={t.name}
                defaultChecked={agent ? agent.tools.includes(t.name) : !t.mutates}
                className="size-4"
              />
              <span>{t.label}</span>
              {t.mutates && (
                <span className="text-amber-600 text-[10px] uppercase">modifica datos</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ag-temp">Temperature (0–2)</Label>
          <Input id="ag-temp" name="temperature" type="number" step="0.1" min={0} max={2} defaultValue={agent?.temperature ?? 0.7} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ag-tokens">Max tokens de salida</Label>
          <Input id="ag-tokens" name="maxTokens" type="number" min={256} max={32000} step={256} defaultValue={agent?.maxTokens ?? 2048} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="useRag" defaultChecked={agent?.useRag ?? true} className="size-4" />
          Usar RAG (busca en KB/tickets antes de responder)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isDefault" defaultChecked={agent?.isDefault ?? false} className="size-4" />
          Agente por defecto
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={agent?.active ?? true} className="size-4" />
          Activo
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>Cancelar</Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar" : "Crear agente"}
        </Button>
      </div>
    </form>
  )
}
