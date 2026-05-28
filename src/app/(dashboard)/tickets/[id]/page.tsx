import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  Calendar,
  Clock,
  User,
  Building2,
  Boxes,
  Server as ServerIcon,
  MessageSquare,
  Lock,
  Sparkles,
  Bot,
  Cog,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  ticketStatusLabel,
  ticketStatusVariant,
  priorityLabel,
  priorityVariant,
  ticketTypeLabel,
} from "@/lib/ticket-ui"
import { formatDate, formatDateTime, formatRelative, formatCurrency } from "@/lib/format"
import { StatusControl, PriorityControl, AssignControl } from "./status-control"
import { CommentForm } from "./comment-form"
import { DeleteTicketButton } from "./delete-ticket-button"
import { PhasesManager } from "./phases-manager"
import { ImplementationProgress } from "@/components/implementation-progress"
import { AttachmentsSection } from "./attachments-section"

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  const t = await prisma.ticket.findUnique({ where: { id }, select: { code: true, title: true } })
  return { title: t ? `${t.code} · ${t.title}` : "Ticket" }
}

function initials(name: string | null | undefined, fallback: string) {
  const src = name?.trim() || fallback
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?"
}

export default async function TicketDetailPage({ params }: { params: Params }) {
  const user = await requireUser()
  const { id } = await params

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      customer: true,
      system: true,
      server: true,
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
      },
      phases: { orderBy: { order: "asc" } },
      attachments: {
        orderBy: { createdAt: "asc" },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      },
    },
  })

  if (!ticket) notFound()

  const isClient = user.role === "CLIENT"
  if (isClient && ticket.customerId !== user.customerId) {
    redirect("/tickets")
  }

  const visibleComments = isClient
    ? ticket.comments.filter((c) => !c.isInternal)
    : ticket.comments

  const agents = isClient
    ? []
    : await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "AGENT"] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      })

  const agentsOpt = agents.map((a) => ({ id: a.id, name: a.name ?? a.email }))

  return (
    <div>
      <PageHeader
        title={
          <>
            <span className="text-muted-foreground font-mono text-base">{ticket.code}</span>
            <span className="ml-3">{ticket.title}</span>
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{ticketTypeLabel[ticket.type]}</Badge>
            <Badge variant={ticketStatusVariant[ticket.status]}>
              {ticketStatusLabel[ticket.status]}
            </Badge>
            <Badge variant={priorityVariant[ticket.priority]}>
              {priorityLabel[ticket.priority]}
            </Badge>
            {ticket.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </span>
        }
        actions={!isClient && <DeleteTicketButton id={ticket.id} code={ticket.code} />}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Columna principal */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap">{ticket.description}</div>
              </CardContent>
            </Card>

            {ticket.type === "IMPLEMENTATION" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Implementación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <ImplementationProgress
                    ticket={{
                      estimatedHours: ticket.estimatedHours,
                      actualHours: ticket.actualHours,
                      budgetAmount: ticket.budgetAmount?.toString() ?? null,
                      budgetCurrency: ticket.budgetCurrency,
                      phases: ticket.phases.map((p) => ({
                        status: p.status,
                        estimatedHours: p.estimatedHours,
                        actualHours: p.actualHours,
                        budgetAmount: p.budgetAmount ? Number(p.budgetAmount) : null,
                      })),
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <Metric label="Inicio" value={formatDate(ticket.startDate)} />
                    <Metric label="Fin estimado" value={formatDate(ticket.endDate)} />
                  </div>
                  {!isClient && (
                    <PhasesManager
                      ticketId={ticket.id}
                      currency={ticket.budgetCurrency ?? "USD"}
                      phases={ticket.phases.map((p) => ({
                        id: p.id,
                        ticketId: ticket.id,
                        name: p.name,
                        description: p.description,
                        order: p.order,
                        status: p.status,
                        estimatedHours: p.estimatedHours,
                        actualHours: p.actualHours,
                        budgetAmount: p.budgetAmount ? p.budgetAmount.toString() : null,
                        startDate: p.startDate,
                        endDate: p.endDate,
                      }))}
                    />
                  )}
                  {isClient && ticket.phases.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        Fases
                      </p>
                      <ul className="space-y-1.5">
                        {ticket.phases.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between rounded-md border p-2 text-sm"
                          >
                            <span>
                              <span className="font-mono text-xs text-muted-foreground">#{p.order}</span>{" "}
                              {p.name}
                            </span>
                            <Badge variant={p.status === "COMPLETED" ? "default" : "secondary"}>
                              {p.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare className="size-4" />
                  Conversación ({visibleComments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleComments.length === 0 ? (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    Sin comentarios todavía. Sé el primero en responder.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {visibleComments.map((c) => {
                      const isSystem = c.source === "SYSTEM"
                      const isAi = c.source === "AI"
                      const author = c.author
                      return (
                        <li
                          key={c.id}
                          className={
                            "flex gap-3 rounded-md border p-3 " +
                            (c.isInternal ? "bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/40" : "")
                          }
                        >
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs">
                              {isSystem ? <Cog className="size-4" /> :
                               isAi ? <Bot className="size-4" /> :
                               initials(author?.name, author?.email ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-medium">
                                {isSystem ? "Sistema" :
                                 isAi ? "Asistente IA" :
                                 author?.name ?? author?.email ?? "Anónimo"}
                              </span>
                              {author?.role === "CLIENT" && (
                                <Badge variant="outline" className="text-[10px]">
                                  Cliente
                                </Badge>
                              )}
                              {c.isInternal && (
                                <Badge variant="outline" className="text-[10px] text-amber-600">
                                  <Lock className="size-3" />
                                  Interno
                                </Badge>
                              )}
                              <span className="text-muted-foreground">
                                {formatRelative(c.createdAt)}
                              </span>
                            </div>
                            <div
                              className={
                                "text-sm whitespace-pre-wrap " +
                                (isSystem ? "text-muted-foreground italic" : "")
                              }
                            >
                              {c.body}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <Separator />

                <CommentForm ticketId={ticket.id} canMarkInternal={!isClient} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <AttachmentsSection
              ticketId={ticket.id}
              currentUserId={user.id}
              canDeleteAll={!isClient}
              attachments={ticket.attachments.map((a) => ({
                id: a.id,
                filename: a.filename,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
                uploadedById: a.uploadedById,
                uploadedByName: a.uploadedBy?.name ?? a.uploadedBy?.email ?? null,
                createdAt: a.createdAt.toISOString(),
              }))}
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Acciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Estado</span>
                  <StatusControl ticketId={ticket.id} value={ticket.status} />
                </div>
                {!isClient && (
                  <>
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">Prioridad</span>
                      <PriorityControl ticketId={ticket.id} value={ticket.priority} />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">Asignado a</span>
                      <AssignControl
                        ticketId={ticket.id}
                        value={ticket.assignedToId}
                        agents={agentsOpt}
                      />
                    </div>
                  </>
                )}
                <div className="bg-muted/50 mt-2 rounded-md p-2 text-xs text-muted-foreground flex items-center gap-2">
                  <Sparkles className="size-3.5" />
                  El asistente IA aparece en Fase 4.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Detalles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow icon={Building2} label="Cliente">
                  {!isClient ? (
                    <Link href={`/customers/${ticket.customer.id}`} className="hover:underline">
                      {ticket.customer.name}
                    </Link>
                  ) : (
                    ticket.customer.name
                  )}
                </DetailRow>
                {ticket.system && (
                  <DetailRow icon={Boxes} label="Sistema">
                    {!isClient ? (
                      <Link href={`/systems/${ticket.system.id}`} className="hover:underline">
                        {ticket.system.name}
                      </Link>
                    ) : (
                      ticket.system.name
                    )}
                  </DetailRow>
                )}
                {ticket.server && !isClient && (
                  <DetailRow icon={ServerIcon} label="Servidor">
                    <Link href={`/infrastructure/${ticket.server.id}`} className="hover:underline">
                      {ticket.server.name}
                    </Link>
                  </DetailRow>
                )}
                <Separator />
                <DetailRow icon={User} label="Creado por">
                  {ticket.createdBy?.name ?? ticket.createdBy?.email ?? "—"}
                </DetailRow>
                <DetailRow icon={Calendar} label="Creado">
                  {formatDateTime(ticket.createdAt)}
                </DetailRow>
                {ticket.resolvedAt && (
                  <DetailRow icon={Clock} label="Resuelto">
                    {formatDateTime(ticket.resolvedAt)}
                  </DetailRow>
                )}
                {ticket.closedAt && (
                  <DetailRow icon={Clock} label="Cerrado">
                    {formatDateTime(ticket.closedAt)}
                  </DetailRow>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground text-[11px] uppercase tracking-wider">{label}</div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}
