"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { saveSlaConfig } from "@/lib/sla"
import { logActivity } from "@/lib/audit"

const schema = z.object({
  enabled: z.coerce.boolean(),
  urgent: z.coerce.number().positive().max(8760),
  high: z.coerce.number().positive().max(8760),
  medium: z.coerce.number().positive().max(8760),
  low: z.coerce.number().positive().max(8760),
})

export async function saveSla(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireAdmin()
  const parsed = schema.safeParse({
    enabled: fd.get("enabled") === "on",
    urgent: fd.get("urgent"),
    high: fd.get("high"),
    medium: fd.get("medium"),
    low: fd.get("low"),
  })
  if (!parsed.success) return actionError("Revisá los valores (horas positivas)")

  await saveSlaConfig(
    {
      enabled: parsed.data.enabled,
      hoursByPriority: {
        URGENT: parsed.data.urgent,
        HIGH: parsed.data.high,
        MEDIUM: parsed.data.medium,
        LOW: parsed.data.low,
      },
    },
    me.id
  )
  logActivity({
    userId: me.id,
    entityType: "integration",
    entityId: "sla",
    action: "integration_update",
    diff: { enabled: parsed.data.enabled },
  })
  revalidatePath("/settings/sla")
  return actionOk()
}
