"use client"

import { useState, useTransition } from "react"
import { Copy, RefreshCw, Loader2, Check, KeyRound, Terminal, Download } from "lucide-react"
import { toast } from "sonner"
import { regenerateAgentToken } from "../actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const AGENT_REPO_RAW =
  "https://raw.githubusercontent.com/Willytecheira/helpdesk/main/agent"

export function AgentTokenCard({ serverId, token: initialToken }: { serverId: string; token: string }) {
  const [token, setToken] = useState(initialToken)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()

  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  const installCmd = `curl -fsSL ${AGENT_REPO_RAW}/install.sh | sudo bash -s -- \\
  --url ${baseUrl} \\
  --token ${token}`

  const cmd = `curl -X POST ${baseUrl}/api/agent/heartbeat \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"cpuPercent":12.4,"memoryPercent":48.2,"diskPercent":31.0,"uptimeSeconds":98765}'`

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success("Copiado al portapapeles")
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4" />
            Instalación en 1 comando
          </CardTitle>
          <CardDescription>
            Ejecutá esto <strong>en el servidor que querés monitorear</strong> (como root/sudo).
            Instala el agente, lo deja corriendo como servicio y empieza a reportar
            CPU, RAM, disco y contenedores Docker cada minuto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">{installCmd}</pre>
          <Button size="sm" onClick={() => copy(installCmd)}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copiar comando de instalación
          </Button>
          <p className="text-muted-foreground text-xs">
            Requiere <code>curl</code> y <code>jq</code> (los instala solo). Para Docker,
            el agente lee los contenedores del host. Para desinstalar:{" "}
            <code>curl -fsSL {AGENT_REPO_RAW}/uninstall.sh | sudo bash</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            Token del agente
          </CardTitle>
          <CardDescription>
            Este token autentica los reportes de este servidor. Ya está incluido en el
            comando de instalación de arriba. Si lo regenerás, tenés que reinstalar el agente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-xs break-all">
            {token}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(token)}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copiar token
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await regenerateAgentToken(serverId)
                  if (r.ok && r.data) {
                    setToken(r.data.token)
                    toast.success("Token regenerado")
                  } else if (!r.ok) {
                    toast.error(r.error)
                  }
                })
              }
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Regenerar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="size-4" />
            Test rápido con curl
          </CardTitle>
          <CardDescription>
            Verificá que el endpoint responde correctamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">{cmd}</pre>
          <Button variant="outline" size="sm" onClick={() => copy(cmd)}>
            <Copy className="size-4" />
            Copiar comando
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
