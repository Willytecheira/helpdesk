import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { fileExists, openReadStream } from "@/lib/storage"
import type { ReadStream } from "fs"

export const runtime = "nodejs"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await ctx.params

  const att = await prisma.ticketAttachment.findUnique({
    where: { id },
    include: { ticket: { select: { customerId: true } } },
  })
  if (!att) return NextResponse.json({ error: "not_found" }, { status: 404 })

  // Aislamiento por cliente
  if (session.user.role === "CLIENT" && att.ticket.customerId !== session.user.customerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  if (!(await fileExists(att.url))) {
    return NextResponse.json({ error: "file_missing" }, { status: 404 })
  }

  const stream = openReadStream(att.url)
  const webStream = nodeToWebStream(stream)

  const headers = new Headers()
  if (att.mimeType) headers.set("Content-Type", att.mimeType)
  else headers.set("Content-Type", "application/octet-stream")
  if (att.sizeBytes) headers.set("Content-Length", String(att.sizeBytes))
  const safe = att.filename.replace(/[^\w.\-]+/g, "_")
  headers.set("Content-Disposition", `inline; filename="${safe}"`)
  headers.set("Cache-Control", "private, max-age=300")

  return new Response(webStream, { headers })
}

function nodeToWebStream(nodeStream: ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk
        controller.enqueue(new Uint8Array(buf))
      })
      nodeStream.on("end", () => controller.close())
      nodeStream.on("error", (err) => controller.error(err))
    },
    cancel() {
      nodeStream.destroy()
    },
  })
}
