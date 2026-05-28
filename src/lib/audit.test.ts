import { describe, it, expect } from "vitest"
import { diff } from "./audit"

describe("audit.diff", () => {
  it("detecta campos cambiados", () => {
    const before = { name: "Acme", status: "ACTIVE", phone: null }
    const after = { name: "Acme Inc", status: "ACTIVE", phone: "555-1234" }
    const d = diff(before, after)
    expect(d).toEqual({
      name: { from: "Acme", to: "Acme Inc" },
      phone: { from: null, to: "555-1234" },
    })
  })

  it("ignora updatedAt y createdAt", () => {
    const ts = new Date()
    const before = { name: "X", updatedAt: ts, createdAt: ts }
    const after = { name: "Y", updatedAt: new Date(), createdAt: ts }
    const d = diff(before, after)
    expect(d).toEqual({ name: { from: "X", to: "Y" } })
  })

  it("retorna objeto vacío si no hay cambios", () => {
    expect(diff({ a: 1 }, { a: 1 })).toEqual({})
  })

  it("detecta agregados y removidos", () => {
    const d = diff({ a: 1 }, { a: 1, b: 2 })
    expect(d).toEqual({ b: { from: null, to: 2 } })
    const d2 = diff({ a: 1, b: 2 }, { a: 1 })
    expect(d2).toEqual({ b: { from: 2, to: null } })
  })

  it("compara arrays con JSON.stringify", () => {
    const d = diff({ tags: ["a"] }, { tags: ["a", "b"] })
    expect(d).toEqual({ tags: { from: ["a"], to: ["a", "b"] } })
    const d2 = diff({ tags: ["a"] }, { tags: ["a"] })
    expect(d2).toEqual({})
  })
})
