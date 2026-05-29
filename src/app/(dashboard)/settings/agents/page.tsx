import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { PROVIDERS, PROVIDER_IDS, providerConfigured } from "@/lib/ai/providers"
import { TOOL_CATALOG } from "@/lib/ai/agent-tools"
import { AgentsManager } from "./agents-manager"

export const metadata = { title: "Agentes de IA" }

export default async function AgentsPage() {
  await requireAdmin()

  const [agents, ...configured] = await Promise.all([
    prisma.aiAgent.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    ...PROVIDER_IDS.map((id) => providerConfigured(id)),
  ])

  const providers = PROVIDER_IDS.map((id, i) => ({
    id,
    label: PROVIDERS[id].label,
    models: PROVIDERS[id].models,
    configured: configured[i],
  }))

  return (
    <div>
      <PageHeader
        title="Agentes de IA"
        description="Creá agentes especializados con su propio proveedor, modelo, prompt y herramientas. El chat usa el agente que elijas (o el default)."
      />
      <div className="p-4 md:p-6">
        <Card>
          <CardContent>
            <AgentsManager
              providers={providers}
              toolsCatalog={TOOL_CATALOG.map((t) => ({ name: t.name, label: t.label, mutates: t.mutates }))}
              agents={agents.map((a) => ({
                id: a.id,
                name: a.name,
                description: a.description,
                provider: a.provider,
                model: a.model,
                systemPrompt: a.systemPrompt,
                tools: a.tools,
                temperature: a.temperature,
                maxTokens: a.maxTokens,
                useRag: a.useRag,
                isDefault: a.isDefault,
                active: a.active,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
