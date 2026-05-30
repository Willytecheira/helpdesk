"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import {
  Loader2,
  MessageCircle,
  QrCode,
  Plug,
  PlugZap,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Copy,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ActionResult } from "@/lib/action-result"
import {
  saveWhatsappConfig,
  testWhatsappConnection,
  connectWhatsapp,
  getWhatsappStatus,
  registerWhatsappWebhook,
  disconnectWhatsapp,
  clearWhatsapp,
} from "./actions"

type AgentOption = { id: string; name: string; provider: string; model: string }
type CustomerOption = { id: string; name: string }

type Props = {
  config: {
    apiUrl: string
    maskedKey: string
    hasKey: boolean
    instance: string
    agentId: string
    defaultCustomerId: string
    autoReply: boolean
    webhookUrl: string | null
    configured: boolean
    lastVerifiedAt: string | null
    lastVerifiedOk: boolean | null
    lastVerifyError: string | null
  }
  agents: AgentOption[]
  customers: CustomerOption[]
}

const initial: ActionResult = { ok: true }

function stateBadge(state: string) {
  if (state === "open")
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="mr-1 size-3" /> Conectado
      </Badge>
    )
  if (state === "connecting")
    return (
      <Badge variant="secondary">
        <Loader2 className="mr-1 size-3 animate-spin" /> Conectando…
      </Badge>
    )
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <XCircle className="mr-1 size-3" /> Desconectado
    </Badge>
  )
}

export function WhatsappManager({ config, agents, customers }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<string>("unknown")
  const [qr, setQr] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [saveState, saveAction, saving] = useActionState(
    async (prev: ActionResult, fd: FormData) => {
      const r = await saveWhatsappConfig(prev, fd)
      if (r.ok) {
        toast.success("Configuración guardada")
        router.refresh()
      } else {
        toast.error(r.error)
      }
      return r
    },
    initial
  )

  // Estado inicial de conexión
  useEffect(() => {
    if (!config.configured) return
    getWhatsappStatus().then((r) => {
      if (r.ok && r.data) setState(r.data.state)
    })
  }, [config.configured])

  // Polling mientras el QR está abierto
  useEffect(() => {
    if (!qrOpen) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(async () => {
      const r = await getWhatsappStatus()
      if (r.ok && r.data) {
        setState(r.data.state)
        if (r.data.state === "open") {
          toast.success("¡WhatsApp conectado!")
          setQrOpen(false)
          setQr(null)
          router.refresh()
        }
      }
    }, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [qrOpen, router])

  function handleTest() {
    startTransition(async () => {
      const r = await testWhatsappConnection()
      if (r.ok && r.data) {
        setState(r.data.state)
        toast.success(`Conexión OK · estado: ${r.data.state}`)
      } else if (!r.ok) {
        toast.error(r.error)
      }
    })
  }

  function handleRefresh() {
    startTransition(async () => {
      const r = await getWhatsappStatus()
      if (r.ok && r.data) {
        setState(r.data.state)
        toast.message(`Estado: ${r.data.state}`)
      } else if (!r.ok) toast.error(r.error)
    })
  }

  function handleConnect() {
    startTransition(async () => {
      const r = await connectWhatsapp()
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setState(r.data!.state)
      if (r.data!.state === "open") {
        toast.success("Ya está conectado")
        return
      }
      setQr(r.data!.qrBase64)
      setPairingCode(r.data!.pairingCode)
      setQrOpen(true)
    })
  }

  function handleRegisterWebhook() {
    startTransition(async () => {
      const r = await registerWhatsappWebhook()
      if (r.ok) toast.success("Webhook registrado en Evolution")
      else toast.error(r.error)
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      const r = await disconnectWhatsapp()
      if (r.ok) {
        setState("close")
        toast.success("Sesión cerrada")
        router.refresh()
      } else toast.error(r.error)
    })
  }

  function handleClear() {
    if (!confirm("¿Borrar toda la configuración de WhatsApp?")) return
    startTransition(async () => {
      const r = await clearWhatsapp()
      if (r.ok) {
        toast.success("Configuración eliminada")
        router.refresh()
      } else toast.error(r.error)
    })
  }

  const fieldErr = (k: string) =>
    !saveState.ok ? saveState.fieldErrors?.[k] : undefined

  return (
    <div className="space-y-4">
      {/* Configuración */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="text-emerald-600 size-5" />
              <CardTitle>Conexión con Evolution API</CardTitle>
            </div>
            {config.configured && stateBadge(state)}
          </div>
          <CardDescription>
            Evolution API es un servicio aparte (self-hosted) que conecta WhatsApp. Ingresá
            la URL y la API key global de tu instancia.
          </CardDescription>
        </CardHeader>
        <form action={saveAction}>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="apiUrl">URL de Evolution API</Label>
              <Input
                id="apiUrl"
                name="apiUrl"
                placeholder="https://evolution.tudominio.com"
                defaultValue={config.apiUrl}
              />
              {fieldErr("apiUrl") && (
                <p className="text-destructive text-xs">{fieldErr("apiUrl")}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="apiKey">API key global</Label>
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                placeholder={config.hasKey ? config.maskedKey : "AUTHENTICATION_API_KEY"}
                autoComplete="off"
              />
              <p className="text-muted-foreground text-xs">
                Es la <code>AUTHENTICATION_API_KEY</code> de tu Evolution API. Se guarda
                encriptada. Dejá vacío para mantener la actual.
              </p>
            </div>

            <div className="grid gap-1.5 sm:max-w-xs">
              <Label htmlFor="instance">Nombre de la instancia</Label>
              <Input
                id="instance"
                name="instance"
                placeholder="helpdesk"
                defaultValue={config.instance}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="agentId">Agente que responde</Label>
                <select
                  id="agentId"
                  name="agentId"
                  defaultValue={config.agentId}
                  className="border-input bg-transparent h-9 rounded-md border px-3 text-sm shadow-xs"
                >
                  <option value="">Agente por defecto</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.provider}/{a.model})
                    </option>
                  ))}
                </select>
                {agents.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    No hay agentes. Se usará el agente por defecto del sistema.
                  </p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="defaultCustomerId">Cliente por defecto</Label>
                <select
                  id="defaultCustomerId"
                  name="defaultCustomerId"
                  defaultValue={config.defaultCustomerId}
                  className="border-input bg-transparent h-9 rounded-md border px-3 text-sm shadow-xs"
                >
                  <option value="">— (ignorar números desconocidos)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-xs">
                  Para números que no coinciden con ningún contacto/cliente.
                </p>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="autoReply"
                defaultChecked={config.autoReply}
                className="size-4 rounded border"
              />
              Respuesta automática del agente IA a los mensajes entrantes
            </label>

            {config.lastVerifiedAt && (
              <p className="text-muted-foreground text-xs">
                Última verificación:{" "}
                {config.lastVerifiedOk ? (
                  <span className="text-emerald-600">OK</span>
                ) : (
                  <span className="text-destructive">
                    error{config.lastVerifyError ? ` — ${config.lastVerifyError}` : ""}
                  </span>
                )}{" "}
                ({new Date(config.lastVerifiedAt).toLocaleString()})
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={pending || !config.configured}
            >
              <Plug className="mr-1 size-4" /> Probar conexión
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Conexión del número */}
      {config.configured && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="size-5" />
              <CardTitle>Conectar número de WhatsApp</CardTitle>
            </div>
            <CardDescription>
              Escaneá el QR con WhatsApp (Dispositivos vinculados) para conectar el número a
              la instancia <code>{config.instance}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleConnect} disabled={pending}>
              <PlugZap className="mr-1 size-4" /> Conectar / ver QR
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              disabled={pending}
            >
              <RefreshCw className="mr-1 size-4" /> Actualizar estado
            </Button>
            {state === "open" && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDisconnect}
                disabled={pending}
                className="text-destructive"
              >
                Desconectar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Webhook */}
      {config.configured && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook entrante</CardTitle>
            <CardDescription>
              Evolution debe enviar los mensajes a esta URL. Tocá &quot;Registrar&quot; para
              configurarlo automáticamente, o pegalo a mano en tu Evolution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.webhookUrl ? (
              <div className="flex items-center gap-2">
                <code className="bg-muted flex-1 overflow-x-auto rounded px-2 py-1.5 text-xs">
                  {config.webhookUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(config.webhookUrl!)
                    toast.success("Copiado")
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Guardá la configuración para generar la URL del webhook (necesita
                <code> AUTH_URL</code> definida).
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleRegisterWebhook}
              disabled={pending || !config.webhookUrl}
            >
              Registrar webhook en Evolution
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Zona peligrosa */}
      {config.configured && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium">Eliminar configuración</p>
              <p className="text-muted-foreground text-xs">
                Borra la URL, la key y los ajustes de WhatsApp del sistema.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={pending}
              className="text-destructive"
            >
              <Trash2 className="mr-1 size-4" /> Borrar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* QR Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escaneá el código QR</DialogTitle>
            <DialogDescription>
              Abrí WhatsApp → Dispositivos vinculados → Vincular un dispositivo, y escaneá
              este código. La ventana se cierra sola al conectar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR de WhatsApp"
                className="size-64 rounded border bg-white p-2"
              />
            ) : (
              <div className="flex size-64 items-center justify-center rounded border">
                <Loader2 className="text-muted-foreground size-6 animate-spin" />
              </div>
            )}
            {pairingCode && (
              <p className="text-sm">
                ¿No podés escanear? Código de vinculación:{" "}
                <code className="bg-muted rounded px-1.5 py-0.5 font-mono">
                  {pairingCode}
                </code>
              </p>
            )}
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Loader2 className="size-3 animate-spin" /> Esperando conexión…
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
