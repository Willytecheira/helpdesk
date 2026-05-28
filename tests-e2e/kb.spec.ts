import { test, expect } from "@playwright/test"
import { login } from "./helpers"

test.describe("Base de conocimiento", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("muestra los artículos publicados", async ({ page }) => {
    await page.goto("/kb")
    await expect(page.getByText(/timeouts en reportes/i).first()).toBeVisible()
  })

  test("búsqueda en KB filtra resultados", async ({ page }) => {
    await page.goto("/kb")
    await page.getByPlaceholder(/buscar por título/i).fill("timeout")
    await page.getByRole("button", { name: /^buscar$/i }).click()
    await expect(page.getByText(/timeouts en reportes/i).first()).toBeVisible()
  })

  test("crear y publicar un artículo nuevo", async ({ page }) => {
    await page.goto("/kb/new")
    const title = `Test KB ${Date.now()}`
    await page.getByLabel(/título/i).fill(title)
    await page
      .getByPlaceholder(/escribí el artículo usando markdown/i)
      .fill("# Título\n\nContenido de **prueba** con *Markdown*.")
    await page.getByRole("button", { name: /crear artículo/i }).click()
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 10_000,
    })
    // Verificamos que el Markdown se renderizó
    await expect(page.locator("strong").filter({ hasText: "prueba" })).toBeVisible()
  })
})
