import { describe, it, expect } from "vitest"
import { generateToken, hashToken } from "./tokens"

describe("tokens", () => {
  it("generateToken produce strings url-safe únicos", () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a.length).toBeGreaterThanOrEqual(40)
  })

  it("hashToken es determinístico", () => {
    expect(hashToken("hello")).toBe(hashToken("hello"))
    expect(hashToken("hello")).not.toBe(hashToken("hello!"))
  })

  it("hash produce 64 hex chars (SHA-256)", () => {
    const h = hashToken("anything")
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})
