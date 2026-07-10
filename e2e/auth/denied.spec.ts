import { test, expect } from '@playwright/test'

// Denegación sin backend: sin sesión, cualquier ruta del backoffice
// vuelve al login (guard requiresAuth del router).
test.describe('auth denied', () => {
  const protectedRoutes = ['/app/transacciones', '/app/usuarios', '/app/cuentas', '/app/dashboard']

  for (const route of protectedRoutes) {
    test(`sin sesión, ${route} redirige al login`, async ({ page }) => {
      await page.goto(route)
      await expect(page.locator('#login-username')).toBeVisible()
    })
  }
})
