"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { slugify } from "@/lib/format"
import { logActivity } from "@/lib/audit"
import { PROVIDER_IDS } from "@/lib/ai/providers"
import { ALL_TOOL_NAMES } from "@/lib/ai/agent-tools"

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional().or(z.literal("")),
  provider: z.enum(PROVIDER_IDS as [string, ...string[]]),
  model: z.string().min(1),
  systemPrompt: z.string().min(10),
  tools: z.array(z.string()).optional(),
  temperature: z.coerce.number().min(0).max(2),
  maxTokens: z.coerce.number().int().min(256).max(32000),
  useRag: z.coerce.boolean().optional(),
  isDefault: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
})

function parseForm(fd: FormData) {
  return schema.safeParse({
    name: fd.get("name"),
    description: fd.get("description") || undefined,
    provider: fd.get("provider"),
    model: fd.get("model"),
    systemPrompt: fd.get("systemPrompt"),
    tools: fd.getAll("tools").map(String).filter((t) => ALL_TOOL_NAMES.includes(t as never)),
    temperature: fd.get("temperature"),
    maxTokens: fd.get("maxTokens"),
    useRag: fd.get("useRag") === "on",
    isDefault: fd.get("isDefault") === "on",
    active: fd.get("active") === "on",
  })
}

function fieldErrors<T>(p: z.ZodSafeParseError<T>) {
  const e: Record<string, string> = {}
  for (const i of p.error.issues) e[String(i.path[0])] = i.message
  return e
}

async function clearOtherDefaults(exceptId?: string) {
  await prisma.aiAgent.updateMany({
    where: { isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isDefault: false },
  })
}

export async function createAgent(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireAdmin()
  const parsed = parseForm(fd)
  if (!parsed.success) return actionError("Revisá los campos", fieldErrors(parsed))
  const d = parsed.data

  const slug = slugify(d.name) || `agente-${Date.now()}`
  try {
    const agent = await prisma.aiAgent.create({
      data: {
        name: d.name.trim(),
        slug,
        description: d.description?.trim() || null,
        provider: d.provider,
        model: d.model.trim(),
        systemPrompt: d.systemPrompt.trim(),
        tools: d.tools ?? [],
        temperature: d.temperature,
        maxTokens: d.maxTokens,
        useRag: !!d.useRag,
        isDefault: !!d.isDefault,
        active: d.active ?? true,
        createdById: me.id,
      },
    })
    if (agent.isDefault) await clearOtherDefaults(agent.id)
    logActivity({
      userId: me.id,
      entityType: "integration",
      entityId: agent.id,
      action: "create",
      diff: { agent: d.name, provider: d.provider, model: d.model },
    })
    revalidatePath("/settings/agents")
    return actionOk()
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Ya existe un agente con ese nombre/slug")
    }
    return actionError("No se pudo crear el agente")
  }
}

export async function updateAgent(
  id: string,
  _p: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  const me = await requireAdmin()
  const parsed = parseForm(fd)
  if (!parsed.success) return actionError("Revisá los campos", fieldErrors(parsed))
  const d = parsed.data

  await prisma.aiAgent.update({
    where: { id },
    data: {
      name: d.name.trim(),
      description: d.description?.trim() || null,
      provider: d.provider,
      model: d.model.trim(),
      systemPrompt: d.systemPrompt.trim(),
      tools: d.tools ?? [],
      temperature: d.temperature,
      maxTokens: d.maxTokens,
      useRag: !!d.useRag,
      isDefault: !!d.isDefault,
      active: d.active ?? true,
    },
  })
  if (d.isDefault) await clearOtherDefaults(id)
  logActivity({
    userId: me.id,
    entityType: "integration",
    entityId: id,
    action: "update",
    diff: { agent: d.name },
  })
  revalidatePath("/settings/agents")
  return actionOk()
}

export async function deleteAgent(id: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.aiAgent.delete({ where: { id } })
  revalidatePath("/settings/agents")
  return actionOk()
}

export async function setDefaultAgent(id: string): Promise<ActionResult> {
  await requireAdmin()
  await clearOtherDefaults(id)
  await prisma.aiAgent.update({ where: { id }, data: { isDefault: true, active: true } })
  revalidatePath("/settings/agents")
  return actionOk()
}
