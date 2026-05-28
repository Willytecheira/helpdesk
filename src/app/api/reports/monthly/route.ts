import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/auth"
import { buildMonthlyReportData, renderReportPdf } from "@/lib/report"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const now = new Date()
  const year = parseInt(sp.get("year") ?? String(now.getFullYear()), 10)
  const month = parseInt(sp.get("month") ?? String(now.getMonth() + 1), 10)

  let customerId = sp.get("customerId")

  // CLIENT sólo puede pedir el reporte de su propio cliente
  if (session.user.role === "CLIENT") {
    if (!session.user.customerId) {
      return NextResponse.json({ error: "no_customer" }, { status: 403 })
    }
    customerId = session.user.customerId
  }

  if (!customerId) {
    return NextResponse.json({ error: "customerId_required" }, { status: 400 })
  }
  if (
    isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2000 || year > 3000
  ) {
    return NextResponse.json({ error: "invalid_period" }, { status: 400 })
  }

  const data = await buildMonthlyReportData(customerId, year, month)
  if (!data) {
    return NextResponse.json({ error: "customer_not_found" }, { status: 404 })
  }

  const pdf = await renderReportPdf(data, year, month)
  const filename = `reporte-${data.customerName.replace(/[^\w]+/g, "_")}-${year}-${String(month).padStart(2, "0")}.pdf`

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
