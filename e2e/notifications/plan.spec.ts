import { test, expect, type Page } from '@playwright/test'

async function mockPlan(
  page: Page,
  permissions = [
    'users.view',
    'users.update',
    'transactions.view',
    'roles.permissions.update',
    'notifications.view',
    'notifications.create'
  ]
) {
  const user = {
    id: 'actor',
    names: 'Operador',
    lastnames: 'Prueba',
    email: 'operator@example.test',
    role: 'sales',
    permissions
  }
  const staff = {
    id: 'staff',
    names: 'Ana',
    lastnames: 'Pérez',
    name: 'Ana Pérez',
    email: 'ana@example.test',
    role: 'sales',
    identifications: [],
    permissions_granted: [],
    permissions_revoked: []
  }
  let read = false
  await page.route(
    /\/(auth|notifications|user|roles|transactions|coin|metrics)\//,
    async (route) => {
      if (route.request().resourceType() === 'script') return route.continue()
      const path = new URL(route.request().url()).pathname.replace(/\/$/, '')
      let body: unknown = []
      if (path.endsWith('/auth/refresh')) body = { access_token: 'test-token' }
      else if (path.endsWith('/auth/me')) body = user
      else if (path.endsWith('/notifications/staff'))
        body = [{ id: staff.id, name: staff.name, role: staff.role }]
      else if (path.endsWith('/notifications/read-all') || path.endsWith('/read')) {
        read = true
        body = { ok: true }
      } else if (path.endsWith('/notifications/avisos')) body = { created: 1 }
      else if (path.endsWith('/roles/permissions'))
        body = [{ role: 'sales', permissions: ['users.view'] }]
      await route.fulfill({ json: body })
    }
  )
  await page.route(/\/notifications(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'notice',
            type: 'aviso',
            title: 'Aviso de prueba',
            body: 'Revisar operación',
            entity_type: null,
            entity_id: null,
            read_at: read ? new Date().toISOString() : null,
            created_at: '2026-09-11T12:00:00Z'
          }
        ],
        total: 1,
        unread_count: read ? 0 : 1
      }
    })
  )
  await page.route(/\/user(?:\?.*)?$/, (route) =>
    route.fulfill({ json: route.request().method() === 'PUT' ? staff : [staff] })
  )
  await page.route(/\/transactions(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'tx',
            code: 'TX-PRUEBA',
            origin_amount: 100,
            destination_amount: 90,
            status: 'verification',
            send_date: '2026-09-11T12:00:00Z'
          }
        ],
        total: 1
      }
    })
  )
}

test('bandeja, lectura y publicación de un aviso', async ({ page }) => {
  await mockPlan(page)
  await page.goto('/app/usuarios')
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click()
  await expect(page.getByText('Aviso de prueba')).toBeVisible()
  await page.getByRole('button', { name: 'Marcar todo leído' }).click()
  await expect(page.getByRole('button', { name: 'Marcar todo leído' })).toBeDisabled()
  await page.getByRole('button', { name: 'Nuevo aviso' }).click()
  await page.getByLabel('Título', { exact: true }).fill('Nuevo mensaje')
  await page.getByLabel('Mensaje', { exact: true }).fill('Texto para Ana')
  await page.getByLabel('Destinatarios').selectOption('staff')
  const request = page.waitForRequest(
    (r) => r.url().endsWith('/notifications/avisos') && r.method() === 'POST'
  )
  await page.getByRole('button', { name: 'Publicar aviso' }).click()
  expect((await request).postDataJSON()).toEqual({
    title: 'Nuevo mensaje',
    body: 'Texto para Ana',
    recipient_user_ids: ['staff'],
    audience: 'users',
    roles: [],
    body_format: 'html'
  })
})

test('historial filtrado por usuario y guardado de acceso sin datos de perfil', async ({
  page
}) => {
  await mockPlan(page)
  await page.goto('/app/usuarios?user=staff&tab=historial')
  await expect(page.getByText('TX-PRUEBA')).toBeVisible()
  await page.getByRole('button', { name: 'Permisos', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardar acceso' })).toBeVisible()
  const request = page.waitForRequest(
    (r) => new URL(r.url()).pathname === '/user' && r.method() === 'PUT'
  )
  await page.getByRole('button', { name: 'Restablecer al rol' }).click()
  await page.getByRole('button', { name: 'Guardar acceso' }).click()
  const body = (await request).postData() ?? ''
  expect(body).toContain('permissions_granted')
  expect(body).not.toContain('name="email"')
  await expect(page.getByText('Acceso guardado.')).toBeVisible()
})

test('sin permiso de notificaciones no muestra campanita', async ({ page }) => {
  await mockPlan(page, ['users.view'])
  await page.goto('/app/usuarios')
  await expect(page.getByRole('heading', { name: 'Usuarios y cuentas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notificaciones', exact: true })).toHaveCount(0)
})

for (const audience of ['roles', 'all']) {
  test(`aviso HTML para ${audience}`, async ({ page }) => {
    await mockPlan(page)
    await page.goto('/app/usuarios')
    await page.getByRole('button', { name: 'Notificaciones', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo aviso' }).click()
    await page.getByLabel('Título', { exact: true }).fill('Aviso de equipo')
    await page.getByLabel('Enviar a', { exact: true }).selectOption(audience)
    if (audience === 'roles') await page.getByLabel('Roles', { exact: true }).selectOption('sales')
    await page.getByRole('button', { name: 'Código HTML', exact: true }).click()
    await page.getByLabel('Código HTML del mensaje').fill('<p onclick="alert(1)"><strong>Equipo</strong></p><img src=x onerror=alert(1)>')
    await page.getByRole('button', { name: 'Editor visual', exact: true }).click()
    const editor = page.getByRole('textbox', { name: 'Mensaje', exact: true })
    await expect(editor.locator('strong')).toHaveText('Equipo')
    await expect(editor.locator('img, [onclick]')).toHaveCount(0)
    const request = page.waitForRequest(r => r.url().endsWith('/notifications/avisos') && r.method() === 'POST')
    await page.getByRole('button', { name: 'Publicar aviso' }).click()
    expect((await request).postDataJSON()).toMatchObject({ audience, roles: audience === 'roles' ? ['sales'] : [], recipient_user_ids: [], body_format: 'html' })
  })
}
