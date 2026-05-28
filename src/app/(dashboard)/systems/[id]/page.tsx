import Link from "next/link"
import { notFound } from "next/navigation"
import { Boxes, ExternalLink, Calendar } from "lucide-react"
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
import { formatDate, formatRelative } from "@/lib/format"
import { EditSystemButton } from "./edit-system-button"
import { DeleteSystemButton } from "./delete-system-button"
import { LinkServerToSystem } from "./link-server"

type Params = Promise<{ id: string }>

const envLabel = {
  PRODUCTION: "Producción",
  STAGING: "Staging",
  DEVELOPMENT: "Desarrollo",
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
  const s = await prisma.system.findUnique({ where: { id }, select: { name: true } })
  return { title: s?.name ?? "Sistema" }
}

export default async function SystemDetailPage({ params }: { params: Params }) {
  await requireStaff()
  const { id } = await params

  const system = await prisma.system.findUnique({
    where: { id },
    include: {
      customer: true,
      product: true,
      serverSystems: { include: { server: true } },
      containers: { orderBy: { name: "asc" } },
      tickets: { take: 20, orderBy: { createdAt: "desc" } },
    },
  })

  if (!system) notFound()

  const linkedIds = new Set(system.serverSystems.map((ss) => ss.serverId))
  const availableServers = await prisma.server.findMany({
    where: { customerId: system.customerId, id: { notIn: [...linkedIds] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])

  return (
    <div>
      <PageHeader
        title={system.name}
        description={
          <span className="flex items-center gap-2 text-sm">
            <Link href={`/customers/${system.customer.id}`} className="hover:underline">
              {system.customer.name}
            </Link>
            <span>·</span>
            <span>{system.product.name}</span>
            <Badge variant="outline">{envLabel[system.environment]}</Badge>
            <Badge variant={system.status === "ACTIVE" ? "default" : "secondary"}>
              {system.status}
            </Badge>
          </span>
        }
        actions={
          <div className="flex gap-2">
            <EditSystemButton system={system} customers={customers} products={products} />
            <DeleteSystemButton id={system.id} name={system.name} />
          </div>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <ExternalLink className="size-3.5" /> URL
              </p>
              <p className="text-sm break-all">
                {system.url ? (
                  <a
                    href={system.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {system.url}
                  </a>
                ) : (
                  "—"
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Calendar className="size-3.5" /> Instalado
              </p>
              <p className="text-sm">{formatDate(system.installedAt)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Boxes className="size-3.5" /> Producto
              </p>
              <p className="text-sm">
                {system.product.name}
                {system.product.version && (
                  <Badge variant="outline" className="ml-2 font-mono text-xs">
                    {system.product.version}
                  </Badge>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {system.notes && (
          <Card>
            <CardContent className="text-sm whitespace-pre-wrap">{system.notes}</CardContent>
          </Card>
        )}

        <Tabs defaultValue="servers">
          <TabsList>
            <TabsTrigger value="servers">
              Servidores ({system.serverSystems.length})
            </TabsTrigger>
            <TabsTrigger value="containers">
              Contenedores ({system.containers.length})
            </TabsTrigger>
            <TabsTrigger value="tickets">Tickets ({system.tickets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="servers" className="mt-4">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between pb-3">
                  <p className="text-muted-foreground text-sm">
                    {system.serverSystems.length} servidor
                    {system.serverSystems.length === 1 ? "" : "es"} vinculado
                    {system.serverSystems.length === 1 ? "" : "s"}
                  </p>
                  <LinkServerToSystem
                    systemId={system.id}
                    availableServers={availableServers}
                  />
                </div>
                {system.serverSystems.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center text-sm">
                    Sin servidores vinculados.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Servidor</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {system.serverSystems.map((ss) => (
                        <TableRow key={ss.serverId}>
                          <TableCell>
                            <Link
                              href={`/infrastructure/${ss.server.id}`}
                              className="font-medium hover:underline"
                            >
                              {ss.server.name}
                            </Link>
                          </TableCell>
                          <TableCell>{ss.role || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {ss.server.ipAddress || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                ss.server.status === "ONLINE"
                                  ? "default"
                                  : ss.server.status === "OFFLINE"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {ss.server.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="containers" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {system.containers.length === 0 ? (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    Sin contenedores registrados. El agente los reportará automáticamente.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contenedor</TableHead>
                        <TableHead>Imagen</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">CPU</TableHead>
                        <TableHead className="text-right">RAM (MB)</TableHead>
                        <TableHead>Visto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {system.containers.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {c.image}
                            {c.imageTag && `:${c.imageTag}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant={containerStatusVariant[c.status]}>{c.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {c.cpuPercent != null ? `${c.cpuPercent.toFixed(1)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {c.memoryMb != null ? c.memoryMb.toFixed(0) : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatRelative(c.lastSeenAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {system.tickets.length === 0 ? (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    Sin tickets vinculados a este sistema.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Creado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {system.tickets.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs">{t.code}</TableCell>
                          <TableCell className="max-w-xs truncate">{t.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.type}</Badge>
                          </TableCell>
                          <TableCell>{t.status.replace("_", " ")}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatRelative(t.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
