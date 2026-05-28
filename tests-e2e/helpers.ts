import { type Page, expect } from "@playwright/test"

export async function login(
  page: Page,
  email = "admin@helpdesk.local",
  password = "admin123"
) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: /iniciar sesión/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

export async function logout(page: Page) {
  // Click en el avatar del header
  await page.getByLabel(/menú usuario/i).click()
  await page.getByRole("menuitem", { name: /cerrar sesión/i }).click()
  await expect(page).toHaveURL(/\/login/)
}
