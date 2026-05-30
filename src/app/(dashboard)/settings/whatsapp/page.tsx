import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { INTEGRATION_KEYS, getEvolutionConfig } from "@/lib/integrations"
import { decryptString, maskSecret } from "@/lib/crypto"
import { Info } from "lucide-react"
import { WhatsappManager } from "./whatsapp-manager"
import { buildWebhookUrl } from "./actions"

export const metadata = { title: "WhatsApp" }

function decryptSafe(value: string | null, encrypted: boolean): string | null {
  if (!value) return null
  try {
    return encrypted ? decryptString(value) : value
  } catch {
    return null
  }
}

export default async function WhatsappSettingsPage() {
  await requireAdmin()

  const [cfg, keyRow, agents, customers, webhookUrl] = await Promise.all([
    getEvolutionConfig(),
    prisma.integrationSetting.findUnique({
      where: { key: INTEGRATION_KEYS.evolutionApiKey },
    }),
    prisma.aiAgent.findMany({
      where: { active: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, provider: true, model: true },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    buildWebhookUrl(),
  ])

  const plainKey = decryptSafe(keyRow?.value ?? null, keyRow?.encrypted ?? true)

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="Recibí tickets por WhatsApp y dejá que tu agente IA los atienda, vía Evolution API."
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="bg-muted/40 flex items-start gap-3 rounded-md border p-3 text-sm">
          <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p>
              Necesitás una instancia de <strong>Evolution API</strong> corriendo (es un
              servicio aparte, contenedor Docker). Acá conectás el helpdesk con ella.
            </p>
            <p className="text-muted-foreground text-xs">
              Flujo: 1) guardá URL + API key · 2) conectá el número escaneando el QR · 3)
              registrá el webhook. Los mensajes entrantes crean/actualizan tickets y, si
              activás la respuesta automática, el agente IA contesta por WhatsApp.
            </p>
          </div>
        </div>

        <WhatsappManager
          config={{
            apiUrl: cfg.apiUrl ?? "",
            maskedKey: plainKey ? maskSecret(plainKey) : "",
            hasKey: !!cfg.apiKey,
            instance: cfg.instance,
            agentId: cfg.agentId ?? "",
            defaultCustomerId: cfg.defaultCustomerId ?? "",
            autoReply: cfg.autoReply,
            webhookUrl,
            configured: cfg.configured,
            lastVerifiedAt: keyRow?.lastVerifiedAt?.toISOString() ?? null,
            lastVerifiedOk: keyRow?.lastVerifiedOk ?? null,
            lastVerifyError: keyRow?.lastVerifyError ?? null,
          }}
          agents={agents}
          customers={customers}
        />
      </div>
    </div>
  )
}
