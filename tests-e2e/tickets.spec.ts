import { test, expect } from "@playwright/test"
import { login } from "./helpers"

test.describe("Tickets", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/tickets")
  })

  test("muestra los tickets del seed", async ({ page }) => {
    await expect(page.getByText("TKT-0001").first()).toBeVisible()
    await expect(page.getByText("TKT-0002").first()).toBeVisible()
  })

  test("filtro por prioridad URGENT", async ({ page }) => {
    await page.goto("/tickets?priority=URGENT")
    // TKT-0002 es URGENT en el seed
    await expect(page.getByText("TKT-0002").first()).toBeVisible()
    // TKT-0001 es HIGH, no debe aparecer
    const tkt1Count = await page.getByText("TKT-0001").count()
    expect(tkt1Count).toBe(0)
  })

  test("abre el detalle de un ticket", async ({ page }) => {
    await page.getByText("TKT-0001").first().click()
    await expect(page).toHaveURL(/\/tickets\//)
    await expect(page.getByText(/error 500/i).first()).toBeVisible()
    // Sidebar de acciones visible
    await expect(page.getByText(/^acciones$/i)).toBeVisible()
  })

  test("agregar comentario al ticket", async ({ page }) => {
    await page.getByText("TKT-0001").first().click()
    const body = `Comentario E2E ${Date.now()}`
    await page.getByPlaceholder(/escribí tu mensaje/i).fill(body)
    await page.getByRole("button", { name: /^enviar$/i }).click()
    await expect(page.getByText(body)).toBeVisible({ timeout: 10_000 })
  })
})
