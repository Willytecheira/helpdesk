import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { ArticleEditor } from "../../article-editor"

type Params = Promise<{ slug: string }>

export default async function EditArticlePage({ params }: { params: Params }) {
  await requireStaff()
  const { slug } = await params

  const article = await prisma.kbArticle.findUnique({ where: { slug } })
  if (!article) notFound()

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
        title="Editar artículo"
        description={article.title}
      />
      <div className="p-4 md:p-6">
        <ArticleEditor
          article={article}
          products={products}
          customers={customers}
          systems={systems}
        />
      </div>
    </div>
  )
}
