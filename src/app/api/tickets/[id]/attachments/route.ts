import { NextResponse, type NextRequest } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ALLOWED_MIME, MAX_FILE_SIZE, saveBuffer } from "@/lib/storage"

export const runtime = "nodejs"

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await ctx.params

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, customerId: true },
  })
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (session.user.role === "CLIENT" && ticket.customerId !== session.user.customerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "file_too_large", limit: MAX_FILE_SIZE },
      { status: 413 }
    )
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "mime_not_allowed", mime: file.type }, { status: 415 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const stored = await saveBuffer(`tickets/${ticket.id}`, file.name, buf)

  const attachment = await prisma.ticketAttachment.create({
    data: {
      ticketId: ticket.id,
      filename: file.name.slice(0, 200),
      url: stored.storageKey, // guardamos el path interno; el GET se autentica
      mimeType: file.type || null,
      sizeBytes: stored.size,
      uploadedById: session.user.id,
    },
  })

  revalidatePath(`/tickets/${ticket.id}`)
  return NextResponse.json({
    id: attachment.id,
    filename: attachment.filename,
    sizeBytes: attachment.sizeBytes,
    mimeType: attachment.mimeType,
  })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await ctx.params
  const url = new URL(req.url)
  const attachmentId = url.searchParams.get("attachmentId")
  if (!attachmentId) {
    return NextResponse.json({ error: "attachmentId_required" }, { status: 400 })
  }

  const att = await prisma.ticketAttachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: { select: { id: true, customerId: true } } },
  })
  if (!att || att.ticketId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  // CLIENT solo puede borrar adjuntos de sus tickets que ellos mismos subieron
  if (session.user.role === "CLIENT") {
    if (att.ticket.customerId !== session.user.customerId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
    if (att.uploadedById !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
  }

  const { deleteStored } = await import("@/lib/storage")
  await deleteStored(att.url)
  await prisma.ticketAttachment.delete({ where: { id: att.id } })

  revalidatePath(`/tickets/${id}`)
  return NextResponse.json({ ok: true })
}
