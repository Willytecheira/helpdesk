import Link from "next/link"
import { Plus, Search, BookOpen, FileText, EyeOff } from "lucide-react"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatRelative } from "@/lib/format"

export const metadata = { title: "Base de conocimiento" }

type Search = { q?: string; productId?: string; mode?: string }

export default async function KbPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser()
  const isStaff = user.role !== "CLIENT"
  const params = await searchParams
  const q = params.q?.trim() || ""
  const mode = params.mode === "drafts" ? "drafts" : "published"

  const where: Prisma.KbArticleWhereInput = {}

  if (isStaff) {
    where.published = mode === "drafts" ? false : true
  } else {
    where.published = true
    if (user.customerId) {
      where.OR = [{ customerId: null }, { customerId: user.customerId }]
    } else {
      where.customerId = null
    }
  }

  if (q) {
    const search = { contains: q, mode: "insensitive" as const }
    const existing = (where.OR ?? []) as Prisma.KbArticleWhereInput[]
    const searchClause = [
      { title: search },
      { body: search },
      { tags: { has: q.toLowerCase() } },
    ]
    if (existing.length > 0) {
      delete where.OR
      where.AND = [{ OR: existing }, { OR: searchClause }]
    } else {
      where.OR = searchClause
    }
  }

  if (params.productId) where.productId = params.productId

  const [articles, products, draftsCount] = await Promise.all([
    prisma.kbArticle.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        product: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    isStaff
      ? prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    isStaff ? prisma.kbArticle.count({ where: { published: false } }) : Promise.resolve(0),
  ])

  return (
    <div>
      <PageHeader
        title="Base de conocimiento"
        description={
          isStaff
            ? "Artículos y soluciones. El asistente IA los usa para responder a tus clientes."
            : "Documentación y soluciones para tus sistemas."
        }
        actions={
          isStaff && (
            <Link href="/kb/new">
              <Button>
                <Plus className="size-4" />
                Nuevo artículo
              </Button>
            </Link>
          )
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        {isStaff && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/kb?mode=published" className={tabClass(mode === "published")}>
              <FileText className="size-3.5" />
              Publicados
            </Link>
            <Link href="/kb?mode=drafts" className={tabClass(mode === "drafts")}>
              <EyeOff className="size-3.5" />
              Borradores
              {draftsCount > 0 && <Badge variant="secondary" className="ml-1">{draftsCount}</Badge>}
            </Link>
          </div>
        )}

        <form className="flex flex-wrap gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar por título, contenido o tag…"
              className="pl-9"
            />
          </div>
          {isStaff && products.length > 0 && (
            <select
              name="productId"
              defaultValue={params.productId ?? ""}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">Todos los productos</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {isStaff && <input type="hidden" name="mode" value={mode} />}
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
          {(q || params.productId) && (
            <Link href={`/kb${isStaff ? `?mode=${mode}` : ""}`}>
              <Button type="button" variant="ghost" size="sm">Limpiar</Button>
            </Link>
          )}
        </form>

        {articles.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={BookOpen}
                title={q ? "Sin resultados" : "Aún no hay artículos"}
                description={
                  q
                    ? `No encontramos artículos para "${q}".`
                    : isStaff
                      ? "Empezá creando el primer artículo de conocimiento."
                      : "Aún no se publicaron artículos."
                }
                action={
                  isStaff && !q && (
                    <Link href="/kb/new">
                      <Button>
                        <Plus className="size-4" />
                        Crear artículo
                      </Button>
                    </Link>
                  )
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Link key={a.id} href={`/kb/${a.slug}`} className="group block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="space-y-2">
                    <div className="flex items-start gap-2">
                      <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <h3 className="line-clamp-2 flex-1 font-medium leading-snug group-hover:underline">
                        {a.title}
                      </h3>
                      {!a.published && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">Borrador</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {a.body.slice(0, 200)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {a.product && (
                        <Badge variant="outline" className="text-[10px]">
                          {a.product.name}
                        </Badge>
                      )}
                      {a.customer && (
                        <Badge variant="secondary" className="text-[10px]">
                          {a.customer.name}
                        </Badge>
                      )}
                      {a.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Actualizado {formatRelative(a.updatedAt)}
                      {a.createdBy?.name && ` · ${a.createdBy.name}`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function tabClass(active: boolean) {
  return [
    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs transition-colors",
    active
      ? "bg-primary text-primary-foreground border-primary"
      : "hover:bg-accent",
  ].join(" ")
}
