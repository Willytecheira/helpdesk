/** Convierte un valor a celda CSV escapada (RFC 4180). */
function cell(value: unknown): string {
  if (value === null || value === undefined) return ""
  let s: string
  if (value instanceof Date) s = value.toISOString()
  else if (typeof value === "object") s = JSON.stringify(value)
  else s = String(value)
  // Escapar si contiene coma, comilla o salto de línea
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const header = columns.map((c) => cell(c.header)).join(",")
  const lines = rows.map((row) => columns.map((c) => cell(row[c.key])).join(","))
  // BOM para que Excel detecte UTF-8
  return "﻿" + [header, ...lines].join("\r\n")
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
