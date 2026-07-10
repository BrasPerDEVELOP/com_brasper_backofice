import { test, expect } from '@playwright/test'
import { loginAsAdmin, hasAdminCredentials } from '../helpers/auth'

test.describe('auth login', () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), 'requiere E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD')
  })

  test('admin puede ingresar al backoffice', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/app\//)
    // El formulario de login ya no debe estar presente.
    await expect(page.locator('#login-username')).toHaveCount(0)
  })
})
