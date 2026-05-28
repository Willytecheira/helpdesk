import { test, expect } from "@playwright/test"
import { login } from "./helpers"

test.describe("Navegación", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("sidebar contiene los enlaces principales", async ({ page }) => {
    await expect(page.getByRole("link", { name: /^dashboard$/i }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: /^tickets$/i }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: /^clientes$/i }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: /asistente ia/i }).first()).toBeVisible()
  })

  test("puede navegar a tickets", async ({ page }) => {
    await page.getByRole("link", { name: /^tickets$/i }).first().click()
    await expect(page).toHaveURL(/\/tickets/)
    await expect(page.getByRole("heading", { name: /tickets/i }).first()).toBeVisible()
  })

  test("puede navegar a clientes y ver la lista", async ({ page }) => {
    await page.getByRole("link", { name: /^clientes$/i }).first().click()
    await expect(page).toHaveURL(/\/customers/)
    // Hay al menos el cliente Acme del seed
    await expect(page.getByText(/Acme/i).first()).toBeVisible()
  })

  test("Cmd+K abre el command palette", async ({ page }) => {
    await page.keyboard.press("Meta+K")
    await expect(page.getByPlaceholder(/buscar tickets, clientes, kb/i)).toBeVisible()
    await page.keyboard.press("Escape")
  })

  test("atajo g+t navega a tickets", async ({ page }) => {
    await page.keyboard.press("g")
    await page.keyboard.press("t")
    await expect(page).toHaveURL(/\/tickets/)
  })
})
