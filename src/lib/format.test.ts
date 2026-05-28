import { describe, it, expect } from "vitest"
import { slugify, formatCurrency, formatRelative, formatDate } from "./format"

describe("format", () => {
  describe("slugify", () => {
    it("convierte a slug url-safe", () => {
      expect(slugify("Hola Mundo")).toBe("hola-mundo")
      expect(slugify("  ¡Buenos días!  ")).toBe("buenos-dias")
      expect(slugify("Cliente #1 — Acme S.A.")).toBe("cliente-1-acme-s-a")
    })
    it("colapsa múltiples separadores", () => {
      expect(slugify("a  b   c")).toBe("a-b-c")
      expect(slugify("a---b___c")).toBe("a-b-c")
    })
    it("limita a 60 caracteres", () => {
      const long = "a".repeat(100)
      expect(slugify(long).length).toBeLessThanOrEqual(60)
    })
    it("string vacío devuelve string vacío", () => {
      expect(slugify("")).toBe("")
      expect(slugify("   ")).toBe("")
    })
  })

  describe("formatCurrency", () => {
    it("formatea USD correctamente", () => {
      const r = formatCurrency(1234.5, "USD")
      // Intl puede usar "USD", "US$" o "$" según la locale; verificamos presencia del monto
      expect(r).toMatch(/1.234/)
      expect(r).toMatch(/US|\$/)
    })
    it("acepta strings", () => {
      expect(formatCurrency("100", "USD")).toMatch(/100/)
    })
    it("null/undefined devuelven em-dash", () => {
      expect(formatCurrency(null)).toBe("—")
      expect(formatCurrency(undefined)).toBe("—")
    })
    it("NaN devuelve em-dash", () => {
      expect(formatCurrency("not-a-number")).toBe("—")
    })
  })

  describe("formatRelative", () => {
    it("null devuelve em-dash", () => {
      expect(formatRelative(null)).toBe("—")
      expect(formatRelative(undefined)).toBe("—")
    })
    it("acepta Date y string ISO", () => {
      const d = new Date(Date.now() - 60_000)
      expect(formatRelative(d)).toMatch(/minuto|segundo/i)
      expect(formatRelative(d.toISOString())).toMatch(/minuto|segundo/i)
    })
  })

  describe("formatDate", () => {
    it("formatea fechas en español", () => {
      const d = new Date("2026-03-15T10:00:00Z")
      const r = formatDate(d)
      expect(r).toMatch(/2026/)
      expect(r).toMatch(/mar/i)
    })
    it("null devuelve em-dash", () => {
      expect(formatDate(null)).toBe("—")
    })
  })
})
