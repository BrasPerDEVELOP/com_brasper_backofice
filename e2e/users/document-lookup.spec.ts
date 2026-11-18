import { expect, test, type Page } from '@playwright/test'

const html = '<!doctype html><html><body><div id="app"></div><script type="module" src="/e2e/users/document-lookup.fixture.ts"></script></body></html>'
const result = { document_type: 'dni', document_number: '00112233', names: 'JUAN CARLOS', lastnames: 'PEREZ GARCIA', source: 'apiperu' }

async function openForm(page: Page) {
  await page.route('**/qa-document-lookup', route => route.fulfill({ contentType: 'text/html', body: html }))
  await page.goto('/qa-document-lookup')
  await page.getByText('Tipo de documento', { exact: true }).click()
  await page.getByRole('button', { name: 'DNI', exact: true }).click()
  await page.getByPlaceholder('Número de documento').fill('00112233')
}

test('document comes first, lookup fills names and save persists document with names', async ({ page }) => {
  let lookupPayload: unknown
  let savePayload: unknown
  await page.route('**/user/document-lookup', route => {
    lookupPayload = route.request().postDataJSON()
    return route.fulfill({ json: result })
  })
  await page.route('**/user?*', route => route.fulfill({ json: [] }))
  await page.route('**/user', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] })
    const form = await new Response(route.request().postDataBuffer(), {
      headers: { 'Content-Type': route.request().headers()['content-type']! },
    }).formData()
    savePayload = { names: form.get('names'), lastnames: form.get('lastnames'), identifications: JSON.parse(String(form.get('identifications'))) }
    return route.fulfill({ json: { id: 'qa-user', ...savePayload as object } })
  })
  await openForm(page)
  const docBox = await page.getByPlaceholder('Número de documento').boundingBox()
  const nameBox = await page.getByPlaceholder('Nombres', { exact: true }).boundingBox()
  expect(docBox!.y).toBeLessThan(nameBox!.y)
  await page.getByRole('button', { name: 'Consultar datos', exact: true }).click()
  await expect(page.getByPlaceholder('Nombres', { exact: true })).toHaveValue('JUAN CARLOS')
  await expect(page.getByPlaceholder('Apellidos')).toHaveValue('PEREZ GARCIA')
  expect(lookupPayload).toEqual({ document_type: 'dni', document_number: '00112233' })
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect.poll(() => savePayload).toMatchObject({ names: 'JUAN CARLOS', lastnames: 'PEREZ GARCIA', identifications: [{ document_type: 'dni', document_number: '00112233', is_primary: true }] })
})

test('lookup preserves manually entered name until explicit apply', async ({ page }) => {
  await page.route('**/user/document-lookup', route => route.fulfill({ json: result }))
  await openForm(page)
  await page.getByPlaceholder('Nombres', { exact: true }).fill('Nombre escrito')
  await page.getByRole('button', { name: 'Consultar datos', exact: true }).click()
  await expect(page.getByText('Datos encontrados:', { exact: false })).toBeVisible()
  await expect(page.getByPlaceholder('Nombres', { exact: true })).toHaveValue('Nombre escrito')
  await page.getByRole('button', { name: 'Usar estos datos' }).click()
  await expect(page.getByPlaceholder('Nombres', { exact: true })).toHaveValue('JUAN CARLOS')
})

test('changing document discards an in-flight response', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/user/document-lookup', async route => {
    await pending
    await route.fulfill({ json: result })
  })
  await openForm(page)
  await page.getByRole('button', { name: 'Consultar datos', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled()
  await page.getByPlaceholder('Número de documento').fill('99887766')
  release()
  await expect(page.getByRole('button', { name: 'Consultar datos', exact: true })).toBeEnabled()
  await expect(page.getByPlaceholder('Nombres', { exact: true })).toHaveValue('')
  await expect(page.getByText('Datos encontrados:', { exact: false })).toHaveCount(0)
})

test('provider failure leaves manual creation available', async ({ page }) => {
  await page.route('**/user/document-lookup', route => route.fulfill({ status: 503, json: { detail: 'Proveedor no disponible; completa los datos manualmente.' } }))
  await openForm(page)
  await page.getByRole('button', { name: 'Consultar datos', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Proveedor no disponible')
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled()
})
