import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { ProductsTable } from "./products-table"

export const metadata = { title: "Productos" }

export default async function ProductsPage() {
  await requireStaff()
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { systems: true } } },
  })

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Catálogo de productos que ofreces a tus clientes."
      />
      <div className="p-4 md:p-6">
        <Card>
          <CardContent>
            <ProductsTable products={products} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
