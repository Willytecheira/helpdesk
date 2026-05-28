import { describe, it, expect } from "vitest"
import { encryptString, decryptString, maskSecret } from "./crypto"

describe("crypto", () => {
  it("encripta y desencripta texto", () => {
    const plain = "sk-ant-very-secret-key-1234567890"
    const enc = encryptString(plain)
    expect(enc).not.toContain("sk-ant")
    expect(enc.length).toBeGreaterThan(40)
    expect(decryptString(enc)).toBe(plain)
  })

  it("genera ciphertexts distintos en cada llamada (IV random)", () => {
    const a = encryptString("hello")
    const b = encryptString("hello")
    expect(a).not.toBe(b)
    expect(decryptString(a)).toBe("hello")
    expect(decryptString(b)).toBe("hello")
  })

  it("maneja strings con unicode", () => {
    const plain = "¿Qué pasa 🚀 — émile@français.fr"
    expect(decryptString(encryptString(plain))).toBe(plain)
  })

  it("falla al desencriptar un ciphertext corrupto", () => {
    const enc = encryptString("hello")
    const corrupted = enc.slice(0, -4) + "XXXX"
    expect(() => decryptString(corrupted)).toThrow()
  })

  it("falla con ciphertext demasiado corto", () => {
    expect(() => decryptString("short")).toThrow()
  })

  describe("maskSecret", () => {
    it("oculta valores largos mostrando prefijo y sufijo", () => {
      expect(maskSecret("sk-ant-abcdefghijklmnop")).toBe("sk-a…mnop")
    })
    it("censura completamente valores cortos", () => {
      expect(maskSecret("abc")).toBe("•••")
      expect(maskSecret("12345678")).toBe("••••••••")
    })
    it("string vacío devuelve string vacío", () => {
      expect(maskSecret("")).toBe("")
    })
  })
})
