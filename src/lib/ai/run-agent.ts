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

// Tools de sólo lectura: el agente puede consultar pero no mutar datos.
// (En WhatsApp, la creación/actualización del ticket la maneja el webhook.)
const READONLY_TOOLS = [
  "search_knowledge_base",
  "get_ticket_by_code",
  "list_recent_tickets",
  "get_customer_overview",
  "get_server_status",
]

const MAX_STEPS = 5

export async function runAgentReply(opts: {
  agentId?: string | null
  ctx: AiToolContext
  messages: ModelMessage[]
  readOnly?: boolean
  extraSystem?: string
}): Promise<{ text: string; agentName: string; provider: string; model: string } | null> {
  const agent = await resolveAgent(opts.agentId)
  if (!agent) return null

  const model = await getLanguageModel(agent.provider, agent.model)
  if (!model) return null

  const toolNames =
    opts.readOnly === false
      ? agent.tools
      : agent.tools.filter((t) => READONLY_TOOLS.includes(t))
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
