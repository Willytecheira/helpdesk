import { test, expect } from "@playwright/test"

test.describe("APIs públicas", () => {
  test("/api/health responde 200", async ({ request }) => {
    const r = await request.get("/api/health")
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.status).toBe("ok")
    expect(body.checks.database.ok).toBe(true)
  })

  test("/api/agent/heartbeat sin token devuelve 401", async ({ request }) => {
    const r = await request.post("/api/agent/heartbeat", { data: {} })
    expect(r.status()).toBe(401)
  })

  test("/api/agent/heartbeat con token inválido devuelve 401", async ({ request }) => {
    const r = await request.post("/api/agent/heartbeat", {
      headers: { authorization: "Bearer fake-token" },
      data: {},
    })
    expect(r.status()).toBe(401)
  })

  test("/api/auth/check-2fa no expone si el email existe", async ({ request }) => {
    const r1 = await request.post("/api/auth/check-2fa", {
      data: { email: "admin@helpdesk.local" },
    })
    expect(r1.status()).toBe(200)
    const j1 = await r1.json()
    expect(j1.required).toBe(false) // admin no tiene 2FA por defecto

    const r2 = await request.post("/api/auth/check-2fa", {
      data: { email: "noexiste@x.com" },
    })
    expect(r2.status()).toBe(200)
    const j2 = await r2.json()
    expect(j2.required).toBe(false)
  })
})
