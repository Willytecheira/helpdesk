import type { Prisma, PrismaClient } from "@prisma/client"

type TxClient = PrismaClient | Prisma.TransactionClient

export async function generateTicketCode(
  tx: TxClient,
  type: "SUPPORT" | "IMPLEMENTATION"
): Promise<string> {
  const prefix = type === "IMPLEMENTATION" ? "IMP" : "TKT"

  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await tx.ticket.count({ where: { type } })
    const next = count + 1 + attempt
    const code = `${prefix}-${String(next).padStart(4, "0")}`
    const exists = await tx.ticket.findUnique({ where: { code } })
    if (!exists) return code
  }
  return `${prefix}-${Date.now()}`
}
