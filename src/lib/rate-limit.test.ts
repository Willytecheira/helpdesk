import { describe, it, expect, beforeEach } from "vitest"
import { checkRateLimit, getRequestIp } from "./rate-limit"

describe("rate-limit", () => {
  beforeEach(() => {
    // Keys aleatorios para no interferir entre tests
  })

  it("permite hasta el límite", () => {
    const key = `test-allow-${Math.random()}`
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key, 5, 60_000)
      expect(r.ok).toBe(true)
    }
    const r = checkRateLimit(key, 5, 60_000)
    expect(r.ok).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it("devuelve remaining correcto", () => {
    const key = `test-remaining-${Math.random()}`
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(2)
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(1)
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(0)
    expect(checkRateLimit(key, 3, 60_000).ok).toBe(false)
  })

  it("resetAt está en el futuro cuando se bloquea", () => {
    const key = `test-reset-${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000)
    const r = checkRateLimit(key, 3, 60_000)
    expect(r.ok).toBe(false)
    expect(r.resetAt).toBeGreaterThan(Date.now())
  })

  describe("getRequestIp", () => {
    it("prefiere cf-connecting-ip", () => {
      const h = new Headers({
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      })
      expect(getRequestIp(h)).toBe("1.1.1.1")
    })
    it("usa x-real-ip si no hay cf", () => {
      const h = new Headers({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" })
      expect(getRequestIp(h)).toBe("2.2.2.2")
    })
    it("extrae el primer IP de x-forwarded-for", () => {
      const h = new Headers({ "x-forwarded-for": "3.3.3.3, 4.4.4.4, 5.5.5.5" })
      expect(getRequestIp(h)).toBe("3.3.3.3")
    })
    it("devuelve 'anon' si no hay headers", () => {
      expect(getRequestIp(new Headers())).toBe("anon")
    })
  })
})
