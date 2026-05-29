import Link from "next/link"
import { Settings, KeyRound, Users2, ScrollText, Timer, Bot } from "lucide-react"
import { requireAdmin } from "@/lib/auth-helpers"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  return (
    <div className="flex min-h-full">
      <aside className="bg-muted/20 hidden w-56 shrink-0 border-r p-4 md:block">
        <p className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
          <Settings className="size-3.5" />
          Configuración
        </p>
        <nav className="space-y-0.5 text-sm">
          <Link
            href="/settings/users"
            className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5"
          >
            <Users2 className="size-3.5" />
            Usuarios
          </Link>
          <Link
            href="/settings/integrations"
            className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5"
          >
            <KeyRound className="size-3.5" />
            Integraciones
          </Link>
          <Link
            href="/settings/agents"
            className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5"
          >
            <Bot className="size-3.5" />
            Agentes de IA
          </Link>
          <Link
            href="/settings/sla"
            className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5"
          >
            <Timer className="size-3.5" />
            SLA
          </Link>
          <Link
            href="/settings/audit"
            className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5"
          >
            <ScrollText className="size-3.5" />
            Auditoría
          </Link>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
