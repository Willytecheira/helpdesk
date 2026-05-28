"use client"

import { useActionState, useTransition, useState } from "react"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  KeyRound,
  TestTube,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react"
import { toast } from "sonner"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const initial: ActionResult = { ok: true }

type ModelOption = { value: string; label: string }

type Props = {
  title: string
  description: string
  icon?: React.ReactNode
  hasKey: boolean
  maskedKey?: string | null
  modelLabel?: string
  modelValue?: string
  modelDefault: string
  modelOptions?: ModelOption[]
  envFallback?: boolean
  lastVerifiedAt?: Date | null
  lastVerifiedOk?: boolean | null
  lastVerifyError?: string | null
  envHint?: string
  saveAction: (prev: ActionResult, fd: FormData) => Promise<ActionResult>
  testAction: () => Promise<ActionResult>
  clearAction: () => Promise<ActionResult>
}

export function IntegrationCard(props: Props) {
  const {
    title,
    description,
    icon,
    hasKey,
    maskedKey,
    modelLabel = "Modelo",
    modelValue,
    modelDefault,
    modelOptions,
    envFallback,
    lastVerifiedAt,
    lastVerifiedOk,
    lastVerifyError,
    envHint,
    saveAction,
    testAction,
    clearAction,
  } = props

  const [reveal, setReveal] = useState(false)
  const [keyValue, setKeyValue] = useState(maskedKey ?? "")

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await saveAction(prev, fd)
    if (r.ok) toast.success("Guardado")
    else if (!r.fieldErrors) toast.error(r.error)
    return r
  }, initial)
  const fe = !state.ok ? state.fieldErrors : undefined

  const [testing, startTest] = useTransition()
  const [clearing, startClear] = useTransition()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <StatusBadge hasKey={hasKey} ok={lastVerifiedOk} envFallback={!!envFallback} />
        </div>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-1.5">
              <KeyRound className="size-3.5" /> API Key
            </Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                name="apiKey"
                type={reveal ? "text" : "password"}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder={hasKey ? "Dejá vacío para mantener la actual" : "sk-..."}
                aria-invalid={!!fe?.apiKey}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setReveal((v) => !v)}
                tabIndex={-1}
              >
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            {fe?.apiKey && <p className="text-destructive text-xs">{fe.apiKey}</p>}
            {hasKey && envFallback && (
              <p className="text-muted-foreground text-xs">
                Actualmente se está usando la variable de entorno {envHint}.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">{modelLabel}</Label>
            {modelOptions ? (
              <ModelSelect
                name={modelOptions === undefined ? "model" : "model"}
                defaultValue={modelValue || modelDefault}
                options={modelOptions}
              />
            ) : (
              <Input
                id="model"
                name="model"
                defaultValue={modelValue || modelDefault}
                placeholder={modelDefault}
              />
            )}
            <p className="text-muted-foreground text-xs">Default: {modelDefault}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="text-muted-foreground text-xs">
              {lastVerifiedAt ? (
                <span className="flex items-center gap-1.5">
                  Última prueba: {formatRelative(lastVerifiedAt)}
                  {lastVerifyError && (
                    <span className="text-destructive max-w-xs truncate" title={lastVerifyError}>
                      · {lastVerifyError}
                    </span>
                  )}
                </span>
              ) : (
                <span>Sin pruebas todavía</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasKey && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={clearing}
                  onClick={() =>
                    startClear(async () => {
                      if (!confirm(`¿Borrar la configuración de ${title}?`)) return
                      const r = await clearAction()
                      if (r.ok) {
                        toast.success("Configuración borrada")
                        setKeyValue("")
                      } else toast.error(r.error)
                    })
                  }
                >
                  {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  Borrar
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testing || !hasKey}
                onClick={() =>
                  startTest(async () => {
                    const r = await testAction()
                    if (r.ok) toast.success(`${title}: conexión OK`)
                    else toast.error(r.error)
                  })
                }
              >
                {testing ? <Loader2 className="size-3.5 animate-spin" /> : <TestTube className="size-3.5" />}
                Probar
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function StatusBadge({
  hasKey,
  ok,
  envFallback,
}: {
  hasKey: boolean
  ok: boolean | null | undefined
  envFallback: boolean
}) {
  if (!hasKey) return <Badge variant="outline">No configurado</Badge>
  if (ok === true)
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="size-3" />
        OK
      </Badge>
    )
  if (ok === false)
    return (
      <Badge variant="destructive">
        <XCircle className="size-3" />
        Falló
      </Badge>
    )
  if (envFallback) return <Badge variant="outline">Desde .env</Badge>
  return <Badge variant="secondary">Sin probar</Badge>
}

function ModelSelect({
  name,
  defaultValue,
  options,
}: {
  name: string
  defaultValue: string
  options: ModelOption[]
}) {
  const isCustom = !options.find((o) => o.value === defaultValue)
  const [mode, setMode] = useState<"preset" | "custom">(isCustom ? "custom" : "preset")
  const [val, setVal] = useState(defaultValue)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setMode("preset")
              setVal(o.value)
            }}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              mode === "preset" && val === o.value
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent"
            )}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={cn(
            "rounded-md border px-2 py-1 text-xs",
            mode === "custom"
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-accent"
          )}
        >
          Custom…
        </button>
      </div>
      <Input
        name={name}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        readOnly={mode === "preset"}
        className={mode === "preset" ? "bg-muted/40" : ""}
      />
    </div>
  )
}
