import Link from "next/link"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/format"

export const metadata = { title: "Auditoría" }

const PAGE_SIZE = 50

const actionLabel: Record<string, string> = {
  create: "Creó",
  update: "Actualizó",
  delete: "Eliminó",
  publish: "Publicó",
  unpublish: "Despublicó",
  login: "Inició sesión",
  logout: "Cerró sesión",
  login_failed: "Login fallido",
  status_change: "Cambió estado",
  assign: "Asignó",
  ai_action: "Acción IA",
  integration_update: "Actualizó integración",
  integration_clear: "Borró integración",
  integration_test: "Probó integración",
  rate_limited: "Rate limit",
}

const actionVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
  login_failed: "destructive",
  status_change: "secondary",
  integration_update: "outline",
}

const entityLabel: Record<string, string> = {
  user: "Usuario",
  customer: "Cliente",
  product: "Producto",
  system: "Sistema",
  server: "Servidor",
  container: "Contenedor",
  ticket: "Ticket",
  ticket_comment: "Comentario",
  phase: "Fase",
  kb_article: "Artículo KB",
  integration: "Integración",
  session: "Sesión",
  agent: "Agente",
}

type Search = { page?: string; entity?: string; action?: string }

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin()
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)

  const where: Prisma.ActivityLogWhereInput = {}
  if (params.entity) where.entityType = params.entity
  if (params.action) where.action = params.action

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.activityLog.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const entities = Object.keys(entityLabel)

  const buildUrl = (overrides: Partial<Search>) => {
    const sp = new URLSearchParams()
    const merged = { ...params, ...overrides }
    if (merged.entity) sp.set("entity", merged.entity)
    if (merged.action) sp.set("action", merged.action)
    if (merged.page) sp.set("page", String(merged.page))
    return `/settings/audit?${sp.toString()}`
  }

  return (
    <div>
      <PageHeader
        title="Auditoría"
        description="Registro de acciones críticas en el sistema. Sólo lectura."
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap gap-1">
          <Link href={buildUrl({ entity: undefined, page: undefined })}>
            <Badge variant={!params.entity ? "default" : "outline"} className="cursor-pointer">
              Todas
            </Badge>
          </Link>
          {entities.map((e) => (
            <Link key={e} href={buildUrl({ entity: e, page: undefined })}>
              <Badge
                variant={params.entity === e ? "default" : "outline"}
                className="cursor-pointer"
              >
                {entityLabel[e]}
              </Badge>
            </Link>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="Sin registros"
                description="Todavía no hay actividad registrada con estos filtros."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.user?.name ?? log.user?.email ?? (
                          <span className="text-muted-foreground italic">sistema/anónimo</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionVariant[log.action] ?? "secondary"}>
                          {actionLabel[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entityLabel[log.entityType] ?? log.entityType}
                        <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                          {log.entityId.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md">
                        {log.diff ? (
                          <code className="text-muted-foreground line-clamp-1 text-xs">
                            {JSON.stringify(log.diff)}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {total} registros · página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              >
                <Button variant="outline" size="sm" disabled={page <= 1}>
                  <ChevronLeft className="size-4" />
                  Anterior
                </Button>
              </Link>
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
              >
                <Button variant="outline" size="sm" disabled={page >= totalPages}>
                  Siguiente
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
