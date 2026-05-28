"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth-helpers"
import { actionError, actionOk, type ActionResult } from "@/lib/action-result"
import { slugify } from "@/lib/format"
import { logActivity } from "@/lib/audit"

const customerSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Sólo minúsculas, números y guiones")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().url("URL inválida").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("ACTIVE"),
})

type CustomerInput = z.infer<typeof customerSchema>

function clean(input: CustomerInput) {
  return {
    name: input.name.trim(),
    slug: (input.slug || slugify(input.name)).trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    status: input.status,
  }
}

function parseFormData(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    website: formData.get("website") || undefined,
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
    status: formData.get("status") || undefined,
  })
}

function fieldErrors(parsed: z.ZodSafeParseError<CustomerInput>) {
  const errors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0])
    if (!errors[key]) errors[key] = issue.message
  }
  return errors
}

export async function createCustomer(_prev: ActionResult, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireStaff()
  const parsed = parseFormData(formData)
  if (!parsed.success) {
    return actionError("Revisá los campos", fieldErrors(parsed))
  }

  const data = clean(parsed.data)
  try {
    const created = await prisma.customer.create({ data })
    revalidatePath("/customers")
    logActivity({
      userId: user.id,
      entityType: "customer",
      entityId: created.id,
      action: "create",
      diff: { name: data.name, slug: data.slug },
    })
    return actionOk({ id: created.id })
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Ya existe un cliente con ese slug", { slug: "Ya en uso" })
    }
    return actionError("No se pudo crear el cliente")
  }
}

export async function updateCustomer(
  id: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireStaff()
  const parsed = parseFormData(formData)
  if (!parsed.success) {
    return actionError("Revisá los campos", fieldErrors(parsed))
  }
  const data = clean(parsed.data)
  try {
    await prisma.customer.update({ where: { id }, data })
    revalidatePath("/customers")
    revalidatePath(`/customers/${id}`)
    return actionOk()
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return actionError("Slug ya en uso", { slug: "Ya en uso" })
    }
    return actionError("No se pudo actualizar el cliente")
  }
}

export async function deleteCustomer(id: string) {
  const user = await requireStaff()
  const customer = await prisma.customer.findUnique({ where: { id }, select: { name: true, slug: true } })
  try {
    await prisma.customer.delete({ where: { id } })
  } catch {
    return actionError("No se pudo eliminar (puede tener tickets o sistemas asociados)")
  }
  logActivity({
    userId: user.id,
    entityType: "customer",
    entityId: id,
    action: "delete",
    diff: customer,
  })
  revalidatePath("/customers")
  redirect("/customers")
}

// Contactos

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  role: z.string().optional().or(z.literal("")),
  isPrimary: z.coerce.boolean().optional(),
})

export async function createContact(
  customerId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireStaff()
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    role: formData.get("role") || undefined,
    isPrimary: formData.get("isPrimary") === "on",
  })
  if (!parsed.success) {
    const errs: Record<string, string> = {}
    for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message
    return actionError("Datos inválidos", errs)
  }

  await prisma.contact.create({
    data: {
      customerId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      role: parsed.data.role || null,
      isPrimary: !!parsed.data.isPrimary,
    },
  })
  revalidatePath(`/customers/${customerId}`)
  return actionOk()
}

export async function deleteContact(id: string, customerId: string) {
  await requireStaff()
  await prisma.contact.delete({ where: { id } })
  revalidatePath(`/customers/${customerId}`)
}
