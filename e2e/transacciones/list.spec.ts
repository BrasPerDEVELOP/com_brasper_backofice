import { test, expect } from '@playwright/test'
import { loginAsAdmin, hasAdminCredentials } from '../helpers/auth'

test.describe('transacciones', () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), 'requiere E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD')
  })

  test('la lista de transacciones carga tras login', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/app/transacciones')
    await expect(page).toHaveURL(/\/app\/transacciones/)
    // Ya no estamos en login y hay contenido de la vista.
    await expect(page.locator('#login-username')).toHaveCount(0)
    await expect(page.locator('table, [role="table"]').first()).toBeVisible({ timeout: 15_000 })
  })
})
