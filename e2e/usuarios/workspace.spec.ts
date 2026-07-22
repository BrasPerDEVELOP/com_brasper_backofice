import { test, expect, type Page } from '@playwright/test'

const adminSession = {
  id: 'admin-e2e',
  email: 'admin@e2e.test',
  names: 'Admin',
  lastnames: 'E2E',
  role: 'admin',
  permissions: []
}

const client = {
  id: 'client-e2e',
  email: 'cliente@e2e.test',
  names: 'Cliente',
  lastnames: 'Prueba',
  role: 'client',
  phone: 987654321,
  code_phone: '+51',
  identifications: [
    { document_type: 'DNI', document_number: '12345678', is_primary: true }
  ]
}

async function mockWorkspaceApi(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'e2e-token')
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, adminSession)

  await page.route(/\/user\/?(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([client]) })
  )
  await page.route(/\/user\/admin-e2e\/?(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminSession) })
  )
  await page.route(/\/transactions\/bank-accounts\/?(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'account-e2e',
          user_id: client.id,
          bank_id: 'bank-e2e',
          account_flow: 'destination',
          account_holder_type: 'naturalPerson',
          bank_country: 'pe',
          holder_names: 'Cliente',
          holder_surnames: 'Prueba',
          account_number: '0011223344'
        }
      ])
    })
  )
  await page.route(/\/transactions\/banks\/?(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'bank-e2e', bank: 'BCP', currency: 'PEN', country: 'pe' }])
    })
  )
}

test.describe('workspace unificado de usuarios y cuentas', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkspaceApi(page)
  })

  test('selecciona un cliente, conserva la selección en URL y muestra sus cuentas', async ({ page }) => {
    await page.goto('/app/usuarios')
    await expect(page.getByRole('heading', { name: 'Usuarios y cuentas' })).toBeVisible()
    const search = page.getByRole('searchbox')
    await search.fill('Cliente')
    await expect(page).toHaveURL(/search=Cliente/)
    await page.getByText('Cliente Prueba', { exact: true }).first().click()
    await expect(page).toHaveURL(/user=client-e2e/)
    await page.getByRole('button', { name: 'Cuentas bancarias' }).click()
    await expect(page).toHaveURL(/tab=accounts/)
    await expect(page.getByText('0011223344')).toBeVisible()
    await expect(page.getByText('BCP (PEN)')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('searchbox')).toHaveValue('Cliente')
    await expect(page.getByText('0011223344')).toBeVisible()
  })

  test('la ruta antigua redirige al workspace y conserva el usuario', async ({ page }) => {
    await page.goto('/app/cuentas?user=client-e2e')
    await expect(page).toHaveURL(/\/app\/usuarios\?.*user=client-e2e.*tab=accounts|\/app\/usuarios\?.*tab=accounts.*user=client-e2e/)
    await expect(page.getByText('0011223344')).toBeVisible()
  })
})
