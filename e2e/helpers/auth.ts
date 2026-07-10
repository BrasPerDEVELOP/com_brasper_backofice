import { test, expect } from '@playwright/test'

/**
 * Fase D — Implementar helper real
 * @see docs/plans/FASE-D.md
 */
export async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/')
  // TODO: fill email/password, click ingresar
  await expect(page).toHaveURL(/\/app\//)
}

export async function loginAsAdmin(page: import('@playwright/test').Page) {
  // TODO: usar credenciales de .env.test
  await login(page, process.env.E2E_ADMIN_EMAIL ?? '', process.env.E2E_ADMIN_PASSWORD ?? '')
}
