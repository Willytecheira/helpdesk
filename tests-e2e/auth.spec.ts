import { test, expect } from "@playwright/test"
import { login, logout } from "./helpers"

test.describe("Autenticación", () => {
  test("muestra el login y redirige protected → login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole("heading", { name: /bienvenido/i })).toBeVisible()
  })

  test("admin puede iniciar sesión y ver dashboard", async ({ page }) => {
    await login(page)
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible()
    // KPIs visibles
    await expect(page.getByText(/clientes activos/i)).toBeVisible()
    await expect(page.getByText(/tickets abiertos/i)).toBeVisible()
  })

  test("credenciales inválidas muestran error", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("admin@helpdesk.local")
    await page.getByLabel("Contraseña").fill("wrong-password")
    await page.getByRole("button", { name: /iniciar sesión/i }).click()
    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible({ timeout: 10_000 })
  })

  test("logout cierra la sesión", async ({ page }) => {
    await login(page)
    await logout(page)
  })

  test("link a forgot-password funciona", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("link", { name: /olvidaste tu contraseña/i }).click()
    await expect(page).toHaveURL(/\/forgot-password/)
    await expect(page.getByRole("heading", { name: /recuperar acceso/i })).toBeVisible()
  })
})
