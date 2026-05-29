import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { streamText, stepCountIs, type ModelMessage } from "ai"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { searchRag } from "@/lib/rag"
import { getRequestIp, rateLimitResponse } from "@/lib/rate-limit"
import { getLanguageModel } from "@/lib/ai/providers"
import { resolveAgent } from "@/lib/ai/agents"
import { buildAgentTools } from "@/lib/ai/agent-tools"
import type { AiToolContext } from "@/lib/ai-tools"
import { aiLogger } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1),
  agentId: z.string().optional(),
})

const MAX_STEPS = 6

function ssePack(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const rl = rateLimitResponse(session.user.id, "ai-chat", 30, 60_000)
  if (rl) return rl

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 422 })
  }

  const { conversationId, message, agentId } = parsed.data
  const conv = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, title: true, agentId: true },
  })
  if (!conv || conv.userId !== session.user.id) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 })
  }

  // Resolver el agente: explícito → el de la conversación → default
  const agent = await resolveAgent(agentId ?? conv.agentId)
  if (!agent) {
    return NextResponse.json(
      { error: "Ningún proveedor de IA está configurado. Andá a Integraciones." },
      { status: 500 }
    )
  }

  const model = await getLanguageModel(agent.provider, agent.model)
  if (!model) {
    return NextResponse.json(
      { error: `El proveedor ${agent.provider} no está configurado.` },
      { status: 500 }
    )
  }

  const ctx: AiToolContext = {
    userId: session.user.id,
    role: session.user.role,
    customerId: session.user.customerId,
  }

  // Persistir mensaje del usuario + asociar agente a la conversación
  await prisma.aiMessage.create({
    data: { conversationId: conv.id, role: "USER", content: message },
  })
  if (agent.id && conv.agentId !== agent.id) {
    await prisma.aiConversation.update({ where: { id: conv.id }, data: { agentId: agent.id } })
  }

  const history = await prisma.aiMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  })

  // RAG opcional según el agente
  let ragBlock = ""
  if (agent.useRag) {
    const ragMatches = await searchRag(message, {
      topK: 5,
      customerId: ctx.role === "CLIENT" ? ctx.customerId : null,
    })
    if (ragMatches.length) {
      ragBlock =
        "\n\n<contexto>\nResultados relevantes de la base de conocimiento (usalos sólo si aplican):\n" +
        ragMatches
          .map(
            (m, i) =>
              `[${i + 1}] (${m.sourceType} · sim=${m.similarity.toFixed(2)})\n${m.content.slice(0, 700)}`
          )
          .join("\n\n") +
        "\n</contexto>"
    }
  }

  const messages: ModelMessage[] = history.slice(0, -1).map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }))
  messages.push({ role: "user", content: message + ragBlock })

  const tools = buildAgentTools(ctx, agent.tools)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(ssePack(event, data)))

      let fullText = ""

      try {
        const result = streamText({
          model,
          system: agent.systemPrompt,
          messages,
          tools,
          stopWhen: stepCountIs(MAX_STEPS),
          temperature: agent.temperature,
          maxOutputTokens: agent.maxTokens,
        })

        for await (const part of result.fullStream) {
          switch (part.type) {
            case "text-delta": {
              // v6: el delta de texto viene en `.text`
              const text = (part as { text?: string }).text ?? ""
              if (text) {
                fullText += text
                enqueue("text_delta", { text })
              }
              break
            }
            case "tool-call": {
              enqueue("tool_use_start", {
                id: part.toolCallId,
                name: part.toolName,
              })
              enqueue("tool_use_input", {
                id: part.toolCallId,
                input: (part as { input?: unknown }).input ?? {},
              })
              break
            }
            case "tool-result": {
              enqueue("tool_result", {
                id: part.toolCallId,
                name: part.toolName,
                result: (part as { output?: unknown }).output,
              })
              break
            }
            case "error": {
              const err = (part as { error?: unknown }).error
              enqueue("error", {
                message: err instanceof Error ? err.message : String(err),
              })
              break
            }
          }
        }

        enqueue("done", { agent: agent.name })

        if (fullText.trim()) {
          await prisma.aiMessage.create({
            data: {
              conversationId: conv.id,
              role: "ASSISTANT",
              content: fullText,
              model: `${agent.provider}:${agent.model}`,
            },
          })
        }

        if (!conv.title || conv.title === "Nueva conversación") {
          await prisma.aiConversation.update({
            where: { id: conv.id },
            data: { title: message.replace(/\s+/g, " ").trim().slice(0, 60) },
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown_error"
        aiLogger.error({ err: msg, agent: agent.name }, "ai_chat_error")
        enqueue("error", { message: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
