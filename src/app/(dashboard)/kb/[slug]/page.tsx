import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Pencil, Calendar, User, EyeOff } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatRelative } from "@/lib/format"
import { PublishToggleButton, DeleteArticleButton } from "./actions-buttons"

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params
  const a = await prisma.kbArticle.findUnique({ where: { slug }, select: { title: true } })
  return { title: a?.title ?? "Artículo" }
}

export default async function ArticleDetailPage({ params }: { params: Params }) {
  const user = await requireUser()
  const { slug } = await params
  const isStaff = user.role !== "CLIENT"

  const article = await prisma.kbArticle.findUnique({
    where: { slug },
    include: {
      product: true,
      customer: true,
      system: true,
      createdBy: { select: { name: true, email: true } },
    },
  })

  if (!article) notFound()

  // Visibilidad para CLIENT
  if (!isStaff) {
    if (!article.published) redirect("/kb")
    if (article.customerId && article.customerId !== user.customerId) redirect("/kb")
  }

  return (
    <div>
      <PageHeader
        title={article.title}
        description={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {!article.published && (
              <Badge variant="outline">
                <EyeOff className="size-3" />
                Borrador
              </Badge>
            )}
            {article.product && (
              <Badge variant="outline">{article.product.name}</Badge>
            )}
            {article.customer && (
              <Badge variant="secondary">{article.customer.name}</Badge>
            )}
            {article.tags.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
            ))}
          </div>
        }
        actions={
          isStaff && (
            <div className="flex items-center gap-2">
              <PublishToggleButton id={article.id} published={article.published} />
              <Link href={`/kb/${article.slug}/edit`}>
                <Button variant="outline">
                  <Pencil className="size-4" />
                  Editar
                </Button>
              </Link>
              <DeleteArticleButton id={article.id} title={article.title} />
            </div>
          )
        }
      />

      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <Card>
          <CardContent className="markdown-body text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.body}</ReactMarkdown>
          </CardContent>
        </Card>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {article.createdBy && (
            <span className="flex items-center gap-1">
              <User className="size-3" />
              {article.createdBy.name ?? article.createdBy.email}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            Creado {formatDate(article.createdAt)}
          </span>
          <span>Actualizado {formatRelative(article.updatedAt)}</span>
        </div>

        {article.system && isStaff && (
          <Card>
            <CardContent className="text-sm">
              <p className="text-muted-foreground text-xs">Sistema relacionado</p>
              <Link
                href={`/systems/${article.system.id}`}
                className="text-primary hover:underline"
              >
                {article.system.name}
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
