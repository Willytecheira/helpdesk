import Link from "next/link"
import { ServerCog, Activity } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRelative } from "@/lib/format"
import { NewServerButton } from "./new-server-button"

export const metadata = { title: "Infraestructura" }

const statusVariant = {
  ONLINE: "default",
  OFFLINE: "destructive",
  DEGRADED: "secondary",
  UNKNOWN: "outline",
} as const

export default async function InfraPage() {
  await requireStaff()

  const [servers, customers, totals] = await Promise.all([
    prisma.server.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { containers: true, serverSystems: true } },
      },
    }),
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.server.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ])

  const totalsByStatus: Record<string, number> = {}
  for (const t of totals) totalsByStatus[t.status] = t._count._all

  return (
    <div>
      <PageHeader
        title="Infraestructura"
        description="Servidores y contenedores Docker por cliente."
        actions={<NewServerButton customers={customers} />}
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <StatusCard label="En línea" value={totalsByStatus.ONLINE ?? 0} variant="default" />
          <StatusCard label="Degradados" value={totalsByStatus.DEGRADED ?? 0} variant="secondary" />
          <StatusCard label="Offline" value={totalsByStatus.OFFLINE ?? 0} variant="destructive" />
          <StatusCard label="Desconocidos" value={totalsByStatus.UNKNOWN ?? 0} variant="outline" />
        </div>

        <Card>
          <CardContent className="p-0">
            {servers.length === 0 ? (
              <EmptyState
                icon={ServerCog}
                title="Aún no hay servidores"
                description="Agregá tu primer servidor y configurá el agente para monitorearlo."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servidor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Sistemas</TableHead>
                    <TableHead className="text-right">Contenedores</TableHead>
                    <TableHead>Visto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/infrastructure/${s.id}`} className="font-medium hover:underline">
                          {s.name}
                        </Link>
                        <div className="text-muted-foreground text-xs">{s.hostname || ""}</div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/customers/${s.customer.id}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {s.customer.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.ipAddress || "—"}</TableCell>
                      <TableCell>{s.provider || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s._count.serverSystems}</TableCell>
                      <TableCell className="text-right tabular-nums">{s._count.containers}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatRelative(s.lastSeenAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: "default" | "secondary" | "destructive" | "outline"
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Activity className="size-3.5" />
          {label}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {value}
          <Badge variant={variant} className="ml-2 align-middle text-xs">
            {value === 1 ? "servidor" : "servidores"}
          </Badge>
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
