import Link from "next/link"
import { Plus, MessageSquare, Sparkles } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { Button } from "@/components/ui/button"
import { formatRelative } from "@/lib/format"
import { createConversation } from "./actions"
import { getAnthropicConfig } from "@/lib/integrations"

export const metadata = { title: "Asistente IA" }

export default async function AiLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  const [conversations, anthropic] = await Promise.all([
    prisma.aiConversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    getAnthropicConfig(),
  ])

  const hasKey = !!anthropic.apiKey
  const isAdmin = user.role === "ADMIN"

  return (
    <div className="flex h-[calc(100svh-3.5rem)]">
      <aside className="bg-muted/30 hidden w-72 shrink-0 flex-col border-r md:flex">
        <div className="border-b p-3">
          <form
            action={async () => {
              "use server"
              await createConversation()
            }}
          >
            <Button type="submit" className="w-full" disabled={!hasKey}>
              <Plus className="size-4" />
              Nueva conversación
            </Button>
          </form>
        </div>

        {!hasKey && (
          <div className="border-b bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium flex items-center gap-1">
              <Sparkles className="size-3.5" />
              IA deshabilitada
            </p>
            <p className="mt-1">
              {isAdmin ? (
                <>
                  Configurala en{" "}
                  <Link href="/settings/integrations" className="underline font-medium">
                    Integraciones
                  </Link>{" "}
                  para activar el chat.
                </>
              ) : (
                "Pedile al administrador que configure la integración."
              )}
            </p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="text-muted-foreground p-3 text-xs">
              Aún no tenés conversaciones.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/ai/${c.id}`}
                    className="hover:bg-accent block rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="truncate text-sm font-medium">
                        {c.title || "Sin título"}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-[11px] pl-5">
                      {formatRelative(c.updatedAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
