/**
 * Ejecuta un agente IA de forma NO-streaming y devuelve el texto final.
 * Se usa para canales asíncronos (WhatsApp) donde no hay UI que consuma el stream.
 */
import { generateText, stepCountIs, type ModelMessage } from "ai"
import { resolveAgent } from "@/lib/ai/agents"
import { getLanguageModel } from "@/lib/ai/providers"
import { buildAgentTools } from "@/lib/ai/agent-tools"
import type { AiToolContext } from "@/lib/ai-tools"
import { aiLogger } from "@/lib/logger"

// Tools permitidas para canales asíncronos (WhatsApp): consultar + resolver/actualizar
// el ticket. NO incluye create_ticket (lo maneja el webhook → evita duplicados) ni
// add_ticket_comment (la respuesta del agente ya se guarda como comentario).
export const WHATSAPP_TOOLS = [
  "search_knowledge_base",
  "get_ticket_by_code",
  "list_recent_tickets",
  "get_customer_overview",
  "get_server_status",
  "update_ticket_status",
]

const MAX_STEPS = 5

export async function runAgentReply(opts: {
  agentId?: string | null
  ctx: AiToolContext
  messages: ModelMessage[]
  /** Si se pasa, limita las tools del agente a las de esta lista (intersección con las suyas). */
  toolAllowlist?: string[]
  extraSystem?: string
}): Promise<{ text: string; agentName: string; provider: string; model: string } | null> {
  const agent = await resolveAgent(opts.agentId)
  if (!agent) return null

  const model = await getLanguageModel(agent.provider, agent.model)
  if (!model) return null

  const toolNames = opts.toolAllowlist
    ? agent.tools.filter((t) => opts.toolAllowlist!.includes(t))
    : agent.tools
  const tools = buildAgentTools(opts.ctx, toolNames)

  const system = opts.extraSystem
    ? `${agent.systemPrompt}\n\n${opts.extraSystem}`
    : agent.systemPrompt

  try {
    const result = await generateText({
      model,
      system,
      messages: opts.messages,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      temperature: agent.temperature,
      maxOutputTokens: agent.maxTokens,
    })
    return {
      text: result.text.trim(),
      agentName: agent.name,
      provider: agent.provider,
      model: agent.model,
    }
  } catch (e) {
    aiLogger.error({ err: String(e), agent: agent.name }, "run_agent_reply_error")
    return null
  }
}
