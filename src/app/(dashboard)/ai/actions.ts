"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"

export async function createConversation(): Promise<string> {
  const user = await requireUser()
  const conv = await prisma.aiConversation.create({
    data: {
      userId: user.id,
      customerId: user.role === "CLIENT" ? user.customerId : null,
      title: "Nueva conversación",
    },
    select: { id: true },
  })
  revalidatePath("/ai")
  redirect(`/ai/${conv.id}`)
}

export async function deleteConversation(id: string) {
  const user = await requireUser()
  const conv = await prisma.aiConversation.findUnique({ where: { id }, select: { userId: true } })
  if (!conv || conv.userId !== user.id) return
  await prisma.aiConversation.delete({ where: { id } })
  revalidatePath("/ai")
  redirect("/ai")
}
