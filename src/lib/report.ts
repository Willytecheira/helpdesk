import PDFDocument from "pdfkit"
import { prisma } from "@/lib/prisma"

export type MonthlyReportData = {
  customerName: string
  period: { from: Date; to: Date }
  ticketsCreated: number
  ticketsResolved: number
  byStatus: { status: string; count: number }[]
  byPriority: { priority: string; count: number }[]
  avgResolutionHours: number | null
  implementations: {
    code: string
    title: string
    status: string
    estimatedHours: number | null
    actualHours: number | null
  }[]
  topTickets: { code: string; title: string; status: string; createdAt: Date }[]
}

export async function buildMonthlyReportData(
  customerId: string,
  year: number,
  month: number // 1-12
): Promise<MonthlyReportData | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true },
  })
  if (!customer) return null

  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 1)

  const [created, resolved, byStatusRaw, byPriorityRaw, resolvedTickets, impl, topTickets] =
    await Promise.all([
      prisma.ticket.count({ where: { customerId, createdAt: { gte: from, lt: to } } }),
      prisma.ticket.count({
        where: { customerId, resolvedAt: { gte: from, lt: to } },
      }),
      prisma.ticket.groupBy({
        by: ["status"],
        where: { customerId, createdAt: { gte: from, lt: to } },
        _count: { _all: true },
      }),
      prisma.ticket.groupBy({
        by: ["priority"],
        where: { customerId, createdAt: { gte: from, lt: to } },
        _count: { _all: true },
      }),
      prisma.ticket.findMany({
        where: { customerId, resolvedAt: { gte: from, lt: to }, type: "SUPPORT" },
        select: { createdAt: true, resolvedAt: true },
      }),
      prisma.ticket.findMany({
        where: { customerId, type: "IMPLEMENTATION" },
        select: { code: true, title: true, status: true, estimatedHours: true, actualHours: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.ticket.findMany({
        where: { customerId, createdAt: { gte: from, lt: to } },
        select: { code: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ])

  let avgResolutionHours: number | null = null
  if (resolvedTickets.length > 0) {
    const totalMs = resolvedTickets.reduce(
      (acc, t) => acc + ((t.resolvedAt as Date).getTime() - t.createdAt.getTime()),
      0
    )
    avgResolutionHours = totalMs / resolvedTickets.length / 1000 / 3600
  }

  return {
    customerName: customer.name,
    period: { from, to: new Date(to.getTime() - 1) },
    ticketsCreated: created,
    ticketsResolved: resolved,
    byStatus: byStatusRaw.map((s) => ({ status: s.status, count: s._count._all })),
    byPriority: byPriorityRaw.map((p) => ({ priority: p.priority, count: p._count._all })),
    avgResolutionHours,
    implementations: impl,
    topTickets,
  }
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export function renderReportPdf(data: MonthlyReportData, year: number, month: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    const chunks: Buffer[] = []
    doc.on("data", (c) => chunks.push(c as Buffer))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const ink = "#0f172a"
    const muted = "#64748b"

    // Header
    doc.fillColor(ink).fontSize(22).text("Reporte mensual de soporte", { continued: false })
    doc.moveDown(0.2)
    doc.fillColor(muted).fontSize(12).text(`${data.customerName}`)
    doc.fillColor(muted).fontSize(11).text(`${MONTHS[month - 1]} ${year}`)
    doc.moveDown(1)

    // Línea separadora
    doc.strokeColor("#e2e8f0").moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(1)

    // KPIs
    doc.fillColor(ink).fontSize(14).text("Resumen del mes")
    doc.moveDown(0.5)
    const kpis: [string, string][] = [
      ["Tickets creados", String(data.ticketsCreated)],
      ["Tickets resueltos", String(data.ticketsResolved)],
      [
        "Tiempo medio de resolución",
        data.avgResolutionHours != null ? `${data.avgResolutionHours.toFixed(1)} horas` : "—",
      ],
    ]
    doc.fontSize(11)
    for (const [label, value] of kpis) {
      doc.fillColor(muted).text(label, { continued: true })
      doc.fillColor(ink).text(`   ${value}`)
    }
    doc.moveDown(1)

    // Por estado
    if (data.byStatus.length > 0) {
      doc.fillColor(ink).fontSize(14).text("Tickets por estado")
      doc.moveDown(0.3)
      doc.fontSize(11)
      for (const s of data.byStatus) {
        doc.fillColor(muted).text(`• ${s.status.replace("_", " ")}: `, { continued: true })
        doc.fillColor(ink).text(String(s.count))
      }
      doc.moveDown(1)
    }

    // Por prioridad
    if (data.byPriority.length > 0) {
      doc.fillColor(ink).fontSize(14).text("Tickets por prioridad")
      doc.moveDown(0.3)
      doc.fontSize(11)
      for (const p of data.byPriority) {
        doc.fillColor(muted).text(`• ${p.priority}: `, { continued: true })
        doc.fillColor(ink).text(String(p.count))
      }
      doc.moveDown(1)
    }

    // Implementaciones
    if (data.implementations.length > 0) {
      doc.fillColor(ink).fontSize(14).text("Implementaciones")
      doc.moveDown(0.3)
      doc.fontSize(10)
      for (const i of data.implementations) {
        doc.fillColor(ink).text(`${i.code} — ${i.title}`, { continued: false })
        doc
          .fillColor(muted)
          .fontSize(9)
          .text(
            `   Estado: ${i.status} · Horas: ${i.actualHours ?? "?"}/${i.estimatedHours ?? "?"}`
          )
        doc.fontSize(10)
      }
      doc.moveDown(1)
    }

    // Detalle de tickets
    if (data.topTickets.length > 0) {
      if (doc.y > 680) doc.addPage()
      doc.fillColor(ink).fontSize(14).text("Detalle de tickets del mes")
      doc.moveDown(0.3)
      doc.fontSize(9)
      for (const t of data.topTickets) {
        if (doc.y > 760) doc.addPage()
        doc.fillColor(ink).text(`${t.code}`, { continued: true })
        doc.fillColor(muted).text(`  ${t.status.replace("_", " ")}  `, { continued: true })
        doc.fillColor(ink).text(t.title.slice(0, 70))
      }
    }

    // Footer
    doc.moveDown(2)
    doc
      .fillColor(muted)
      .fontSize(8)
      .text(
        `Generado el ${new Date().toLocaleString("es-AR")} · Helpdesk`,
        50,
        780,
        { align: "center", width: 495 }
      )

    doc.end()
  })
}
