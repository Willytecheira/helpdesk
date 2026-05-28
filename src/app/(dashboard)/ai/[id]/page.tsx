import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { ChatView } from "./chat-view"

type Params = Promise<{ id: string }>

export default async function ConversationPage({ params }: { params: Params }) {
  const user = await requireUser()
  const { id } = await params

  const conv = await prisma.aiConversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  })

  if (!conv) notFound()
  if (conv.userId !== user.id) redirect("/ai")

  return (
    <ChatView
      conversationId={conv.id}
      title={conv.title ?? "Conversación"}
      initialMessages={conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  )
}
