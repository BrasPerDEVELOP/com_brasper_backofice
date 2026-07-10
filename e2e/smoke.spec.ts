import { test, expect } from '@playwright/test'

// Smoke sin backend: la SPA arranca y muestra el formulario de login.
test.describe('smoke', () => {
  test('la app carga y muestra el login', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#login-username')).toBeVisible()
    await expect(page.locator('#login-password')).toBeVisible()
    await expect(page.getByRole('button', { name: /entrar al panel/i })).toBeVisible()
  })

  test('una ruta protegida sin sesión redirige a login', async ({ page }) => {
    await page.goto('/app/transacciones')
    await expect(page).toHaveURL(/\/$|\/#|\/login|\/$/)
    await expect(page.locator('#login-username')).toBeVisible()
  })
})
