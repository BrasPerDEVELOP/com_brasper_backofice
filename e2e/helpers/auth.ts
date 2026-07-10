import { expect, type Page } from '@playwright/test'

/**
 * Credenciales E2E desde el entorno (nunca hardcodear). En CI se inyectan como
 * secrets. Localmente: `E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e`.
 */
export const adminCredentials = {
  email: process.env.E2E_ADMIN_EMAIL ?? '',
  password: process.env.E2E_ADMIN_PASSWORD ?? ''
}

/** true si hay credenciales de admin para specs que requieren backend real. */
export function hasAdminCredentials(): boolean {
  return Boolean(adminCredentials.email && adminCredentials.password)
}

/** Inicia sesión con el formulario real de `login_view.vue` y espera el backoffice. */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/')
  await page.fill('#login-username', email)
  await page.fill('#login-password', password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/app\//, { timeout: 15_000 })
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, adminCredentials.email, adminCredentials.password)
}
