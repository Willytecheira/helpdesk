import { prisma } from "@/lib/prisma"
import { PROVIDERS, type ProviderId, isProviderId, providerConfigured } from "@/lib/ai/providers"
import { ALL_TOOL_NAMES } from "@/lib/ai/agent-tools"

export type ResolvedAgent = {
  id: string | null
  name: string
  provider: ProviderId
  model: string
  systemPrompt: string
  tools: string[]
  temperature: number
  maxTokens: number
  useRag: boolean
}

export const DEFAULT_SYSTEM_PROMPT = [
  "Sos el asistente IA de un helpdesk técnico que gestiona soporte e implementaciones para múltiples clientes.",
  "Ayudás a resolver problemas, encontrar información en tickets pasados y la base de conocimiento, y crear o actualizar tickets cuando el usuario lo pide.",
  "",
  "Reglas:",
  "- Sé breve y directo. Respondé en el mismo idioma que el usuario (por defecto español).",
  "- Antes de proponer una solución, usá search_knowledge_base para ver si hay info relevante.",
  "- Para acciones que modifican datos (crear ticket, cambiar estado, comentar) confirmá con el usuario salvo que sea claramente lo que pidió.",
  "- Cuando referenciás un ticket usá su código (ej: TKT-0042).",
].join("\n")

/**
 * Resuelve la configuración del agente a usar:
 *  1. agentId explícito (si existe y está activo)
 *  2. agente marcado isDefault
 *  3. fallback: built-in sobre el primer proveedor configurado
 */
export async function resolveAgent(agentId?: string | null): Promise<ResolvedAgent | null> {
  // 1 / 2: buscar en DB
  const dbAgent = agentId
    ? await prisma.aiAgent.findFirst({ where: { id: agentId, active: true } })
    : await prisma.aiAgent.findFirst({ where: { isDefault: true, active: true } })

  if (dbAgent && isProviderId(dbAgent.provider)) {
    if (await providerConfigured(dbAgent.provider)) {
      return {
        id: dbAgent.id,
        name: dbAgent.name,
        provider: dbAgent.provider,
        model: dbAgent.model,
        systemPrompt: dbAgent.systemPrompt,
        tools: dbAgent.tools,
        temperature: dbAgent.temperature,
        maxTokens: dbAgent.maxTokens,
        useRag: dbAgent.useRag,
      }
    }
  }

  // 3: fallback al primer proveedor con key configurada
  for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
    if (await providerConfigured(id)) {
      return {
        id: null,
        name: "Asistente (default)",
        provider: id,
        model: PROVIDERS[id].defaultModel,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        tools: [...ALL_TOOL_NAMES],
        temperature: 0.7,
        maxTokens: 2048,
        useRag: true,
      }
    }
  }

  return null // ningún proveedor configurado
}
