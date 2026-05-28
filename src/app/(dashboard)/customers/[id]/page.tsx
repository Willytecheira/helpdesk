import Link from "next/link"
import { notFound } from "next/navigation"
import { Building2, Globe, Mail, Phone, MapPin, Pencil } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRelative, formatDate } from "@/lib/format"
import { EditCustomerButton } from "./edit-customer-button"
import { DeleteCustomerButton } from "./delete-customer-button"
import { ReportButton } from "./report-button"
import { ContactsManager } from "./contacts-manager"

type Params = Promise<{ id: string }>

const statusVariant = {
  ACTIVE: "default",
  INACTIVE: "secondary",
  PROSPECT: "outline",
} as const
const statusLabel = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  PROSPECT: "Prospecto",
} as const

const ticketStatusVariant = {
  OPEN: "destructive",
  IN_PROGRESS: "default",
  WAITING_CLIENT: "secondary",
  RESOLVED: "outline",
  CLOSED: "outline",
  CANCELLED: "outline",
} as const

const serverStatusVariant = {
  ONLINE: "default",
  OFFLINE: "destructive",
  DEGRADED: "secondary",
  UNKNOWN: "outline",
} as const

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  const c = await prisma.customer.findUnique({ where: { id }, select: { name: true } })
  return { title: c?.name ?? "Cliente" }
}

export default async function CustomerDetailPage({ params }: { params: Params }) {
  await requireStaff()
  const { id } = await params

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      systems: {
        include: { product: true },
        orderBy: { createdAt: "desc" },
      },
      servers: { orderBy: { name: "asc" } },
      tickets: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { system: true },
      },
    },
  })

  if (!customer) notFound()

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={
          <span className="flex items-center gap-2 text-sm">
            <Building2 className="size-4" /> {customer.slug}
            <Badge variant={statusVariant[customer.status]}>
              {statusLabel[customer.status]}
            </Badge>
          </span>
        }
        actions={
          <div className="flex gap-2">
            <ReportButton customerId={customer.id} />
            <EditCustomerButton customer={customer} />
            <DeleteCustomerButton id={customer.id} name={customer.name} />
          </div>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon={Mail} label="Email" value={customer.email || "—"} />
          <InfoCard icon={Phone} label="Teléfono" value={customer.phone || "—"} />
          <InfoCard
            icon={Globe}
            label="Sitio web"
            value={
              customer.website ? (
                <a
                  href={customer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {customer.website}
                </a>
              ) : (
                "—"
              )
            }
          />
          <InfoCard icon={MapPin} label="Dirección" value={customer.address || "—"} />
        </div>

        {customer.notes && (
          <Card>
            <CardContent className="text-sm whitespace-pre-wrap">{customer.notes}</CardContent>
          </Card>
        )}

        <Tabs defaultValue="systems">
          <TabsList>
            <TabsTrigger value="systems">
              Sistemas ({customer.systems.length})
            </TabsTrigger>
            <TabsTrigger value="servers">
              Servidores ({customer.servers.length})
            </TabsTrigger>
            <TabsTrigger value="contacts">
              Contactos ({customer.contacts.length})
            </TabsTrigger>
            <TabsTrigger value="tickets">
              Tickets ({customer.tickets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="systems" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {customer.systems.length === 0 ? (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    Sin sistemas asignados. Creá uno desde Sistemas.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sistema</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Entorno</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Instalado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.systems.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <Link
                              href={`/systems/${s.id}`}
                              className="font-medium hover:underline"
                            >
                              {s.name}
                            </Link>
                          </TableCell>
                          <TableCell>{s.product.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{s.environment}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(s.installedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="servers" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {customer.servers.length === 0 ? (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    Sin servidores. Agregalos desde Infraestructura.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Servidor</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Visto por última vez</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.servers.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <Link
                              href={`/infrastructure/${s.id}`}
                              className="font-medium hover:underline"
                            >
                              {s.name}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {s.ipAddress || "—"}
                          </TableCell>
                          <TableCell>{s.provider || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={serverStatusVariant[s.status]}>{s.status}</Badge>
                          </TableCell>
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
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <ContactsManager
              customerId={customer.id}
              contacts={customer.contacts.map((c) => ({
                id: c.id,
                name: c.name,
                email: c.email,
                phone: c.phone,
                role: c.role,
                isPrimary: c.isPrimary,
              }))}
            />
          </TabsContent>

          <TabsContent value="tickets" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {customer.tickets.length === 0 ? (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    Sin tickets registrados.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Sistema</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Creado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.tickets.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs">{t.code}</TableCell>
                          <TableCell className="max-w-xs truncate">{t.title}</TableCell>
                          <TableCell>{t.system?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={ticketStatusVariant[t.status]}>
                              {t.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
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

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
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
        <div className="text-sm font-medium break-all">{value}</div>
      </CardContent>
    </Card>
  )
}
