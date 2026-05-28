import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"

export function formatRelative(date: Date | string | null | undefined) {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return formatDistanceToNow(d, { locale: es, addSuffix: true })
}

export function formatDate(date: Date | string | null | undefined, pattern = "dd MMM yyyy") {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return format(d, pattern, { locale: es })
}

export function formatDateTime(date: Date | string | null | undefined) {
  return formatDate(date, "dd MMM yyyy HH:mm")
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "USD"
) {
  if (amount === null || amount === undefined) return "—"
  const value = typeof amount === "string" ? Number(amount) : amount
  if (isNaN(value)) return "—"
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}
