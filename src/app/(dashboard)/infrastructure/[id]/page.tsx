import Link from "next/link"
import { notFound } from "next/navigation"
import { Cpu, MemoryStick, HardDrive, Globe, Building2 } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRelative, formatDateTime } from "@/lib/format"
import { EditServerButton } from "./edit-server-button"
import { DeleteServerButton } from "./delete-server-button"
import { AgentTokenCard } from "./agent-token-card"
import { ContainersManager } from "./containers-manager"

type Params = Promise<{ id: string }>

const statusVariant = {
  ONLINE: "default",
  OFFLINE: "destructive",
  DEGRADED: "secondary",
  UNKNOWN: "outline",
} as const

const containerStatusVariant = {
  RUNNING: "default",
  PAUSED: "secondary",
  EXITED: "outline",
  RESTARTING: "secondary",
  CREATED: "outline",
  DEAD: "destructive",
  UNKNOWN: "outline",
} as const

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  const s = await prisma.server.findUnique({ where: { id }, select: { name: true } })
  return { title: s?.name ?? "Servidor" }
}

export default async function ServerDetailPage({ params }: { params: Params }) {
  await requireStaff()
  const { id } = await params

  const server = await prisma.server.findUnique({
    where: { id },
    include: {
      customer: true,
      containers: { orderBy: { name: "asc" }, include: { system: true } },
      serverSystems: { include: { system: true } },
      heartbeats: { take: 20, orderBy: { reportedAt: "desc" } },
    },
  })

  if (!server) notFound()

  const customers = await prisma.customer.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const customerSystems = await prisma.system.findMany({
    where: { customerId: server.customerId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const latest = server.heartbeats[0]

  return (
    <div>
      <PageHeader
        title={server.name}
        description={
          <span className="flex items-center gap-2 text-sm">
            <Building2 className="size-4" />
            <Link href={`/customers/${server.customer.id}`} className="hover:underline">
              {server.customer.name}
            </Link>
            <Badge variant={statusVariant[server.status]}>{server.status}</Badge>
            {server.lastSeenAt && (
              <span className="text-muted-foreground">
                Visto {formatRelative(server.lastSeenAt)}
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex gap-2">
            <EditServerButton server={server} customers={customers} />
            <DeleteServerButton id={server.id} name={server.name} />
          </div>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard
            icon={Globe}
            label="IP / Hostname"
            value={
              <span className="font-mono text-xs">
                {server.ipAddress || "—"}
                {server.hostname && (
                  <div className="text-muted-foreground">{server.hostname}</div>
                )}
              </span>
            }
          />
          <InfoCard
            icon={Cpu}
            label="CPU"
            value={
              <span>
                {server.cpuCores ?? "—"} cores
                {latest?.cpuPercent != null && (
                  <Badge variant="outline" className="ml-2">
                    {latest.cpuPercent.toFixed(0)}%
                  </Badge>
                )}
              </span>
            }
          />
          <InfoCard
            icon={MemoryStick}
            label="RAM"
            value={
              <span>
                {server.memoryGb ?? "—"} GB
                {latest?.memoryPercent != null && (
                  <Badge variant="outline" className="ml-2">
                    {latest.memoryPercent.toFixed(0)}%
                  </Badge>
                )}
              </span>
            }
          />
          <InfoCard
            icon={HardDrive}
            label="Disco"
            value={
              <span>
                {server.diskGb ?? "—"} GB
                {latest?.diskPercent != null && (
                  <Badge variant="outline" className="ml-2">
                    {latest.diskPercent.toFixed(0)}%
                  </Badge>
                )}
              </span>
            }
          />
        </div>

        <Tabs defaultValue="containers">
          <TabsList>
            <TabsTrigger value="containers">
              Contenedores ({server.containers.length})
            </TabsTrigger>
            <TabsTrigger value="systems">
              Sistemas ({server.serverSystems.length})
            </TabsTrigger>
            <TabsTrigger value="heartbeats">Heartbeats</TabsTrigger>
            <TabsTrigger value="agent">Agente</TabsTrigger>
          </TabsList>

          <TabsContent value="containers" className="mt-4">
            <Card>
              <CardContent>
                <ContainersManager
                  serverId={server.id}
                  systems={customerSystems}
                  containers={server.containers.map((c) => ({
                    id: c.id,
                    name: c.name,
                    image: c.image,
                    imageTag: c.imageTag,
                    status: c.status,
                    cpuPercent: c.cpuPercent,
                    memoryMb: c.memoryMb,
                    lastSeenAt: c.lastSeenAt,
                    system: c.system ? { id: c.system.id, name: c.system.name } : null,
                  }))}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="systems" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {server.serverSystems.length === 0 ? (
                  <div className="text-muted-foreground py-10 text-center text-sm">
                    Sin sistemas vinculados.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sistema</TableHead>
                        <TableHead>Rol</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {server.serverSystems.map((ss) => (
                        <TableRow key={ss.systemId}>
                          <TableCell>
                            <Link
                              href={`/systems/${ss.system.id}`}
                              className="font-medium hover:underline"
                            >
                              {ss.system.name}
                            </Link>
                          </TableCell>
                          <TableCell>{ss.role || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="heartbeats" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {server.heartbeats.length === 0 ? (
                  <div className="text-muted-foreground py-10 text-center text-sm">
                    El agente todavía no reportó datos. Configurá el agente en este servidor.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reportado</TableHead>
                        <TableHead className="text-right">CPU</TableHead>
                        <TableHead className="text-right">RAM</TableHead>
                        <TableHead className="text-right">Disco</TableHead>
                        <TableHead className="text-right">Load (1m / 5m / 15m)</TableHead>
                        <TableHead className="text-right">Uptime</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {server.heartbeats.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="text-muted-foreground text-xs">
                            {formatDateTime(h.reportedAt)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {h.cpuPercent != null ? `${h.cpuPercent.toFixed(1)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {h.memoryPercent != null ? `${h.memoryPercent.toFixed(1)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {h.diskPercent != null ? `${h.diskPercent.toFixed(1)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {h.loadAvg1?.toFixed(2) ?? "—"} / {h.loadAvg5?.toFixed(2) ?? "—"} /{" "}
                            {h.loadAvg15?.toFixed(2) ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {h.uptimeSeconds != null
                              ? formatUptime(h.uptimeSeconds)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent" className="mt-4">
            <AgentTokenCard serverId={server.id} token={server.agentToken} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Cpu
  label: string
  value: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Icon className="size-3.5" />
          {label}
        </div>
        <div className="text-sm font-medium">{value}</div>
      </CardContent>
    </Card>
  )
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}
