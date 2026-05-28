"use client"

import { useEffect, useRef, useState } from "react"
import {
  Send,
  Loader2,
  Sparkles,
  Wrench,
  ChevronRight,
  Trash2,
  User as UserIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { deleteConversation } from "../actions"

type ToolCall = {
  id: string
  name: string
  input: Record<string, unknown> | null
  result?: unknown
  isError?: boolean
  status: "running" | "done" | "error"
}

type Message = {
  id: string
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL"
  content: string
  toolCalls?: ToolCall[]
  pending?: boolean
  createdAt: string
}

type Props = {
  conversationId: string
  title: string
  initialMessages: { id: string; role: string; content: string; createdAt: string }[]
}

export function ChatView({ conversationId, title, initialMessages }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role as Message["role"],
      content: m.content,
      createdAt: m.createdAt,
    }))
  )
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streaming])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput("")

    const userMsg: Message = {
      id: `tmp-${Date.now()}-u`,
      role: "USER",
      content: text,
      createdAt: new Date().toISOString(),
    }
    const aiMsg: Message = {
      id: `tmp-${Date.now()}-a`,
      role: "ASSISTANT",
      content: "",
      toolCalls: [],
      pending: true,
      createdAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, userMsg, aiMsg])
    setStreaming(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? "Error en el chat")
        setStreaming(false)
        setMessages((m) => m.filter((x) => x.id !== aiMsg.id))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          handleSseChunk(raw, aiMsg.id, setMessages)
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setStreaming(false)
      setMessages((m) =>
        m.map((x) => (x.id === aiMsg.id ? { ...x, pending: false } : x))
      )
      router.refresh()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" />
            <h2 className="truncate font-semibold">{title}</h2>
          </div>
        </div>
        <form
          action={async () => {
            await deleteConversation(conversationId)
          }}
        >
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            title="Eliminar conversación"
          >
            <Trash2 className="size-4" />
          </Button>
        </form>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="text-muted-foreground py-10 text-center text-sm">
              Escribí tu primer mensaje abajo.
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="border-t bg-background p-3 md:p-4"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Preguntale a la IA…  (Shift+Enter para nueva línea)"
            rows={1}
            className="min-h-10 max-h-40 resize-none"
            disabled={streaming}
          />
          <Button type="submit" disabled={streaming || !input.trim()}>
            {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "USER"
  const calls = message.toolCalls ?? []

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-xs">
          {isUser ? <UserIcon className="size-4" /> : <Sparkles className="size-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex max-w-[85%] flex-col gap-2", isUser && "items-end")}>
        {calls.length > 0 && (
          <div className="space-y-1.5">
            {calls.map((call) => (
              <ToolCallBlock key={call.id} call={call} />
            ))}
          </div>
        )}

        {(message.content || message.pending) && (
          <div
            className={cn(
              "rounded-lg px-4 py-2.5",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            {message.content ? (
              <div className="markdown-body text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                <Loader2 className="size-3 animate-spin" /> Pensando…
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallBlock({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border bg-muted/40 text-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <ChevronRight
          className={cn("text-muted-foreground size-3.5 transition-transform", open && "rotate-90")}
        />
        <Wrench className="text-muted-foreground size-3.5" />
        <span className="font-mono text-xs">{call.name}</span>
        {call.status === "running" && (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        )}
        {call.status === "done" && (
          <Badge variant="outline" className="text-[10px]">ok</Badge>
        )}
        {call.status === "error" && (
          <Badge variant="destructive" className="text-[10px]">error</Badge>
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t px-3 py-2 text-xs">
          {call.input && Object.keys(call.input).length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 font-medium">Input</p>
              <pre className="bg-background overflow-x-auto rounded p-2">
                {JSON.stringify(call.input, null, 2)}
              </pre>
            </div>
          )}
          {call.result !== undefined && (
            <div>
              <p className="text-muted-foreground mb-1 font-medium">Result</p>
              <pre className="bg-background max-h-64 overflow-auto rounded p-2">
                {typeof call.result === "string"
                  ? call.result
                  : JSON.stringify(call.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function handleSseChunk(
  raw: string,
  aiMsgId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) {
  const lines = raw.split("\n")
  let event = "message"
  let dataStr = ""
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim()
    else if (line.startsWith("data:")) dataStr += line.slice(5).trim()
  }
  if (!dataStr) return
  let data: unknown
  try {
    data = JSON.parse(dataStr)
  } catch {
    return
  }
  const d = data as Record<string, unknown>

  setMessages((all) =>
    all.map((m) => {
      if (m.id !== aiMsgId) return m
      const calls = [...(m.toolCalls ?? [])]
      switch (event) {
        case "text_delta": {
          return { ...m, content: m.content + String(d.text ?? "") }
        }
        case "tool_use_start": {
          calls.push({
            id: String(d.id),
            name: String(d.name),
            input: null,
            status: "running",
          })
          return { ...m, toolCalls: calls }
        }
        case "tool_use_input": {
          const idx = calls.findIndex((c) => c.id === d.id)
          if (idx !== -1) {
            calls[idx] = { ...calls[idx], input: (d.input as Record<string, unknown>) ?? {} }
          }
          return { ...m, toolCalls: calls }
        }
        case "tool_result": {
          const idx = calls.findIndex((c) => c.id === d.id)
          if (idx !== -1) {
            calls[idx] = {
              ...calls[idx],
              result: d.result,
              isError: !!d.is_error,
              status: d.is_error ? "error" : "done",
            }
          }
          return { ...m, toolCalls: calls }
        }
        case "done":
          return { ...m, pending: false }
        case "error":
          toast.error(String(d.message ?? "Error"))
          return m
        default:
          return m
      }
    })
  )
}
