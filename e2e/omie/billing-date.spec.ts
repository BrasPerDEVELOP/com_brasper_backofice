import { expect, test } from '@playwright/test'

const html = '<!doctype html><html><body><div id="app"></div><script type="module" src="/e2e/omie/billing-date.fixture.ts"></script></body></html>'
test.beforeEach(async ({page}) => {
  await page.route('**/qa-billing-date*', route => route.fulfill({contentType: 'text/html', body: html}))
})

test('billing date without a fiscal record blocks both providers and reacts to clearing the date', async ({page}) => {
  await page.goto('/qa-billing-date')
  const omie = page.getByRole('button', {name: 'NFS-e Omie', exact: true})
  const sunat = page.getByRole('button', {name: 'Emitir', exact: true})
  await expect(omie).toBeDisabled()
  await expect(sunat).toBeDisabled()
  await expect(omie).toHaveAttribute('title', /fecha de facturación/)
  await expect(sunat).toHaveAttribute('title', /fecha de facturación/)
  await page.getByRole('button', {name: 'Quitar fecha'}).click()
  await expect(omie).toBeEnabled()
  await expect(sunat).toBeEnabled()
})

test('existing Omie note stays accessible with a billing date', async ({page}) => {
  await page.route('**/omie/transactions/qa-date/preview', route => route.fulfill({json: {
    can_issue: false, total: '10', currency: 'BRL', customer: 'Cliente prueba', document: '12345678901',
    issuer: 'Brasper', service: 'Remessa internacional', account: 'Banco do Brasil',
    record: {status: 'pending', total: '10', os_id: 1, nfse_number: '42', error: null}
  }}))
  await page.goto('/qa-billing-date?issued=1')
  const note = page.getByRole('button', {name: /NFS-e 42/})
  await expect(note).toBeEnabled()
  await note.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', {name: 'Consultar estado'})).toBeEnabled()
  await expect(page.getByRole('button', {name: 'Emitir NFS-e', exact: true})).toHaveCount(0)
})
