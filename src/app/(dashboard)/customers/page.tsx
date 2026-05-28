import Link from "next/link"
import { Plus, Search, Users } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NewCustomerButton } from "./new-customer-button"
import { ExportButton } from "@/components/export-button"

export const metadata = { title: "Clientes" }

type Search = { q?: string; status?: string }

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

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  await requireStaff()
  const params = await searchParams
  const q = params.q?.trim() || ""

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { systems: true, tickets: true, servers: true },
      },
    },
  })

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Gestiona tus clientes y los sistemas que les das servicio."
        actions={
          <div className="flex items-center gap-2">
            <ExportButton endpoint="/api/export/customers" label="Exportar" includeSearchParams={false} />
            <NewCustomerButton />
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <form className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre, email o slug…"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>

        <Card>
          <CardContent className="p-0">
            {customers.length === 0 ? (
              <EmptyState
                icon={Users}
                title={q ? "Sin resultados" : "Aún no hay clientes"}
                description={
                  q
                    ? `No encontramos clientes que coincidan con "${q}".`
                    : "Creá tu primer cliente para comenzar."
                }
                action={!q && <NewCustomerButton />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Sistemas</TableHead>
                    <TableHead className="text-right">Servidores</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/customers/${c.id}`} className="block">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {c.slug}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/customers/${c.id}`} className="block">
                          <div className="text-sm">{c.email || "—"}</div>
                          <div className="text-muted-foreground text-xs">
                            {c.phone || ""}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[c.status]}>
                          {statusLabel[c.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c._count.systems}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c._count.servers}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c._count.tickets}
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
