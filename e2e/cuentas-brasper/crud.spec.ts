import { test, expect } from '@playwright/test'

test('admin abre y edita una cuenta Brasper desde su sección propia', async ({ page }) => {
  const admin = {
    id: 'admin-company-e2e',
    email: 'admin-company@e2e.test',
    names: 'Admin',
    lastnames: 'Empresa',
    role: 'admin',
    permissions: []
  }
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'e2e-token')
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, admin)

  await page.route(/\/user\/admin-company-e2e\/?(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(admin) })
  )
  let savedBody: Record<string, unknown> | null = null
  await page.route(/\/transactions\/banks\/?(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'PUT') {
      savedBody = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'company-account-e2e',
          bank: 'BCP',
          company: 'Brasper Perú SAC',
          currency: 'PEN',
          country: 'pe',
          account: '191234567890'
        })
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'company-account-e2e',
          bank: 'BCP',
          company: 'Brasper 21 SAC',
          currency: 'PEN',
          country: 'pe',
          account: '191234567890'
        }
      ])
    })
  })

  await page.goto('/app/cuentas-brasper')
  await expect(page.getByRole('heading', { name: 'Cuentas Brasper' })).toBeVisible()
  const companyInput = page.getByPlaceholder('Ej. Brasper 21 SAC')
  await expect(companyInput).toHaveValue('Brasper 21 SAC')
  await companyInput.fill('Brasper Perú SAC')
  await page.getByTitle('Guardar cambios').click()
  await expect(page.getByText('Las cuentas operativas de Brasper se actualizaron correctamente.')).toBeVisible()
  expect(savedBody).toMatchObject({ id: 'company-account-e2e', company: 'Brasper Perú SAC' })
})
