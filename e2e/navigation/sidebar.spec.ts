import { test, expect } from '@playwright/test'
import { loginAsAdmin, hasAdminCredentials } from '../helpers/auth'

test.describe('navigation', () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), 'requiere E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD')
  })

  test('el admin ve enlaces de navegación del backoffice', async ({ page }) => {
    await loginAsAdmin(page)
    // El admin tiene todos los permisos: debe ver el enlace a Transacciones.
    await expect(page.getByRole('link', { name: /transacciones/i }).first()).toBeVisible({
      timeout: 15_000
    })
  })
})
