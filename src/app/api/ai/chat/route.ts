import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import type Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getAnthropic, getAnthropicModel } from "@/lib/anthropic"
import { AI_TOOLS, TOOL_HANDLERS, type AiToolContext } from "@/lib/ai-tools"
import { searchRag } from "@/lib/rag"
import { getRequestIp, rateLimitResponse } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1),
})

const MAX_TOOL_TURNS = 5

function systemPrompt(ctx: AiToolContext) {
  const isClient = ctx.role === "CLIENT"
  return [
    "Sos el asistente IA de un helpdesk técnico que gestiona soporte e implementaciones para múltiples clientes.",
    "Tu rol es ayudar a resolver problemas, encontrar información en tickets pasados/KB, y opcionalmente crear o actualizar tickets cuando el usuario lo pide.",
    "",
    "Reglas:",
    "- Sé breve y directo. Respondé en el mismo idioma que el usuario (por defecto español).",
    "- Antes de proponer una solución, usá search_knowledge_base para ver si hay tickets/KB con info relevante.",
    "- Para acciones que modifican datos (crear ticket, cambiar estado, comentar) confirmá con el usuario antes a menos que sea claramente lo que pidió.",
    "- Si no podés resolver algo, ofrecé crear un ticket con el contexto recolectado.",
    "- Cuando referenciás un ticket usá su código (ej: TKT-0042).",
    "",
    isClient
      ? `Estás conversando con un CLIENTE. Sólo podés ver datos de su empresa.`
      : `Estás conversando con un técnico/admin del helpdesk con permisos amplios.`,
  ].join("\n")
}

function ssePack(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Rate limit: 30 mensajes por minuto por usuario (la IA consume tokens, no es gratis)
  const rl = rateLimitResponse(session.user.id, "ai-chat", 30, 60_000)
  if (rl) return rl

  const anthropic = await getAnthropic()
  if (!anthropic) {
    return NextResponse.json(
      { error: "Anthropic no configurado. Configurálo en /settings/integrations" },
      { status: 500 }
    )
  }
  const model = await getAnthropicModel()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 422 })
  }

  const { conversationId, message } = parsed.data
  const conv = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, title: true },
  })
  if (!conv || conv.userId !== session.user.id) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 })
  }

  const ctx: AiToolContext = {
    userId: session.user.id,
    role: session.user.role,
    customerId: session.user.customerId,
  }

  // 1. Persistir mensaje del usuario
  await prisma.aiMessage.create({
    data: {
      conversationId: conv.id,
      role: "USER",
      content: message,
    },
  })

  // 2. Cargar historial previo (sin contar el que acabamos de agregar)
  const history = await prisma.aiMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  })

  // 3. RAG: traer top resultados relacionados con el mensaje del usuario
  const ragMatches = await searchRag(message, {
    topK: 5,
    customerId: ctx.role === "CLIENT" ? ctx.customerId : null,
  })

  const ragBlock = ragMatches.length
    ? `\n\n<context>\nResultados relevantes de la base de conocimiento (usalos sólo si aplican):\n${ragMatches
        .map(
          (m, i) =>
            `[${i + 1}] (${m.sourceType} · sim=${m.similarity.toFixed(2)})\n${m.content.slice(0, 700)}`
        )
        .join("\n\n")}\n</context>`
    : ""

  // 4. Construir messages para Claude. El último user message incluye el ragBlock como contexto.
  const messages: Anthropic.Messages.MessageParam[] = history.slice(0, -1).map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }))
  messages.push({ role: "user", content: message + ragBlock })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(ssePack(event, data)))

      let fullAssistantText = ""

      try {
        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
          enqueue("turn_start", { turn })

          const stream = anthropic.messages.stream({
            model: model,
            max_tokens: 2048,
            system: systemPrompt(ctx),
            tools: AI_TOOLS,
            messages,
          })

          const blocks: Anthropic.Messages.ContentBlock[] = []
          let currentBlock: Anthropic.Messages.ContentBlock | null = null
          let currentToolJson = ""

          for await (const event of stream) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "text") {
                // Usamos el bloque del SDK directamente (trae todos los campos requeridos)
                currentBlock = { ...event.content_block, text: "" }
                enqueue("text_start", {})
              } else if (event.content_block.type === "tool_use") {
                currentBlock = { ...event.content_block, input: {} }
                currentToolJson = ""
                enqueue("tool_use_start", {
                  id: event.content_block.id,
                  name: event.content_block.name,
                })
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta" && currentBlock?.type === "text") {
                currentBlock.text += event.delta.text
                fullAssistantText += event.delta.text
                enqueue("text_delta", { text: event.delta.text })
              } else if (event.delta.type === "input_json_delta") {
                currentToolJson += event.delta.partial_json
              }
            } else if (event.type === "content_block_stop") {
              if (currentBlock?.type === "tool_use") {
                try {
                  currentBlock.input = currentToolJson ? JSON.parse(currentToolJson) : {}
                } catch {
                  currentBlock.input = {}
                }
                enqueue("tool_use_input", {
                  id: currentBlock.id,
                  input: currentBlock.input,
                })
              }
              if (currentBlock) blocks.push(currentBlock)
              currentBlock = null
            }
          }

          const finalMessage = await stream.finalMessage()
          const stopReason = finalMessage.stop_reason

          if (stopReason !== "tool_use") {
            // Respuesta final lista
            enqueue("done", { stop_reason: stopReason })
            break
          }

          // Hay tool_use: agregar el assistant turn al historial...
          messages.push({ role: "assistant", content: blocks })

          // ...ejecutar cada tool...
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
          for (const b of blocks) {
            if (b.type !== "tool_use") continue
            const handler = TOOL_HANDLERS[b.name]
            let result: unknown
            let isError = false
            try {
              if (!handler) throw new Error(`Tool ${b.name} desconocida`)
              result = await handler(b.input as Record<string, unknown>, ctx)
            } catch (e) {
              isError = true
              result = { error: e instanceof Error ? e.message : "tool_error" }
            }
            enqueue("tool_result", {
              id: b.id,
              name: b.name,
              is_error: isError,
              result,
            })
            toolResults.push({
              type: "tool_result",
              tool_use_id: b.id,
              content: JSON.stringify(result).slice(0, 50_000),
              is_error: isError,
            })
          }

          // ...y agregar los resultados como user turn
          messages.push({ role: "user", content: toolResults })
        }

        // Persistir mensaje del asistente con su texto final
        if (fullAssistantText.trim()) {
          await prisma.aiMessage.create({
            data: {
              conversationId: conv.id,
              role: "ASSISTANT",
              content: fullAssistantText,
              model: model,
            },
          })
        }

        // Si la conversación no tiene título, generamos uno simple usando el primer mensaje
        if (!conv.title || conv.title === "Nueva conversación") {
          const newTitle = message.replace(/\s+/g, " ").trim().slice(0, 60)
          await prisma.aiConversation.update({
            where: { id: conv.id },
            data: { title: newTitle },
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown_error"
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
