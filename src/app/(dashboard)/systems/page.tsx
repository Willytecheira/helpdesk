import Link from "next/link"
import { Boxes } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
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
import { formatDate } from "@/lib/format"
import { NewSystemButton } from "./new-system-button"

export const metadata = { title: "Sistemas" }

const envLabel = {
  PRODUCTION: "Producción",
  STAGING: "Staging",
  DEVELOPMENT: "Desarrollo",
} as const

const statusVariant = {
  ACTIVE: "default",
  PAUSED: "secondary",
  ARCHIVED: "outline",
} as const

export default async function SystemsPage() {
  await requireStaff()

  const [systems, customers, products] = await Promise.all([
    prisma.system.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        _count: { select: { tickets: true, containers: true } },
      },
    }),
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])

  return (
    <div>
      <PageHeader
        title="Sistemas"
        description="Instancias de productos desplegadas en clientes."
        actions={<NewSystemButton customers={customers} products={products} />}
      />

      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="p-0">
            {systems.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="Aún no hay sistemas"
                description="Creá el primer sistema asignándolo a un cliente y producto."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sistema</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Entorno</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Contenedores</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                    <TableHead>Instalado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systems.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/systems/${s.id}`} className="font-medium hover:underline">
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/customers/${s.customer.id}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {s.customer.name}
                        </Link>
                      </TableCell>
                      <TableCell>{s.product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{envLabel[s.environment]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s._count.containers}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s._count.tickets}</TableCell>
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
      </div>
    </div>
  )
}
