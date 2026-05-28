import { describe, it, expect } from "vitest"
import { authenticator } from "otplib"
import {
  generateSetup,
  verifyTotp,
  generateRecoveryCodes,
  hashRecovery,
} from "./totp"

describe("totp", () => {
  it("generateSetup retorna secret y otpauth url", () => {
    const s = generateSetup("user@test.com")
    expect(s.secret).toMatch(/^[A-Z2-7]+$/) // base32
    expect(s.otpauthUrl).toMatch(/^otpauth:\/\/totp/)
    // El email aparece url-encoded en el otpauth url
    expect(s.otpauthUrl).toContain("user%40test.com")
    expect(s.otpauthUrl).toContain("Helpdesk")
  })

  it("verifyTotp acepta un código generado con el mismo secret", () => {
    const { secret } = generateSetup("test@x.com")
    const code = authenticator.generate(secret)
    expect(verifyTotp(secret, code)).toBe(true)
  })

  it("verifyTotp rechaza código vacío", () => {
    const { secret } = generateSetup("test@x.com")
    expect(verifyTotp(secret, "")).toBe(false)
    expect(verifyTotp(secret, "000000")).toBe(false)
  })

  it("verifyTotp tolera espacios en el código", () => {
    const { secret } = generateSetup("test@x.com")
    const code = authenticator.generate(secret)
    const codeWithSpaces = `${code.slice(0, 3)} ${code.slice(3)}`
    expect(verifyTotp(secret, codeWithSpaces)).toBe(true)
  })

  describe("recovery codes", () => {
    it("generateRecoveryCodes produce 10 códigos únicos con formato XXXXX-XXXXX", () => {
      const codes = generateRecoveryCodes()
      expect(codes).toHaveLength(10)
      expect(new Set(codes).size).toBe(10)
      for (const c of codes) {
        expect(c).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/)
      }
    })

    it("hashRecovery es determinístico y case-insensitive", () => {
      expect(hashRecovery("abcde-fghij")).toBe(hashRecovery("ABCDE-FGHIJ"))
      expect(hashRecovery("abcde-fghij")).toBe(hashRecovery("abcdefghij"))
    })
  })
})
