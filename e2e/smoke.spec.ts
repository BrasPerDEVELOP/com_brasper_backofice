import { test } from '@playwright/test'

test.describe('smoke', () => {
  test.skip('app carga login', async ({ page }) => {
    await page.goto('/')
    // Fase D
  })
})
