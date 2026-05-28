import { Sparkles, MessageSquare, Search, FileText, Server, Plus } from "lucide-react"
import { createConversation } from "./actions"

const suggestions = [
  {
    icon: Search,
    title: "Buscar soluciones",
    text: "¿Cómo resolver timeouts en reportes del ERP?",
  },
  {
    icon: FileText,
    title: "Resumen de un cliente",
    text: "Dame un resumen del estado de Acme Industrial",
  },
  {
    icon: Server,
    title: "Estado de servidor",
    text: "¿Cómo está el servidor acme-prod-01?",
  },
  {
    icon: Plus,
    title: "Crear ticket",
    text: "Abrime un ticket para Acme sobre lentitud en el módulo de ventas",
  },
]

export default function AiHome() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="bg-primary text-primary-foreground mb-4 flex size-12 items-center justify-center rounded-full">
        <Sparkles className="size-6" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">Asistente IA</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Conversá con Claude sobre tus clientes, sistemas y tickets. La IA tiene
        contexto de tu base de conocimiento (RAG) y puede crear tickets o cambiar
        estados cuando se lo pidas.
      </p>

      <form
        action={async () => {
          "use server"
          await createConversation()
        }}
        className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2"
      >
        {suggestions.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.title}
              type="submit"
              className="hover:bg-accent rounded-lg border p-4 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4" />
                <span className="text-sm font-medium">{s.title}</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{s.text}</p>
            </button>
          )
        })}
      </form>

      <form
        action={async () => {
          "use server"
          await createConversation()
        }}
        className="mt-6"
      >
        <button type="submit" className="text-primary text-sm hover:underline">
          O empezá una conversación vacía →
        </button>
      </form>
    </div>
  )
}
