import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { ArticleEditor } from "../article-editor"

export const metadata = { title: "Nuevo artículo" }

export default async function NewArticlePage() {
  await requireStaff()
  const [products, customers, systems] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.system.findMany({
      select: { id: true, name: true, customerId: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div>
      <PageHeader
        title="Nuevo artículo"
        description="Documentá una solución, procedimiento o guía. Se indexa para que la IA pueda usarlo."
      />
      <div className="p-4 md:p-6">
        <ArticleEditor products={products} customers={customers} systems={systems} />
      </div>
    </div>
  )
}
