import { expect, test } from '@playwright/test'

const html = '<!doctype html><html><body><div id="app"></div><script type="module" src="/e2e/omie/description.fixture.ts"></script></body></html>'

test('shows backend fiscal description and sends it back for stale-preview validation', async ({ page }) => {
  const description = 'Remessa internacional\nOperação Brasper: BxP-123\nValor enviado: BRL 200,00\nValor a receber: PEN 115,00'
  let submitted: unknown
  await page.route('**/qa-omie-description', route => route.fulfill({ contentType: 'text/html', body: html }))
  await page.route('**/omie/transactions/qa-description/preview', route => route.fulfill({ json: {
    can_issue: true, record: null, total: '9.60', currency: 'BRL', customer: 'CLIENTE TESTE',
    document: '12345678901', issuer: 'BRASPER', service: 'Remessa internacional', account: 'Banco do Brasil', description,
  } }))
  await page.route('**/omie/transactions/qa-description/issue', route => {
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: { status: 'pending', total: '9.60', os_id: 42, nfse_number: null, error: null } })
  })
  await page.goto('/qa-omie-description')
  await page.getByRole('button', { name: 'NFS-e Omie', exact: true }).click()
  await expect(page.getByText('Descripción en la nota fiscal', { exact: true })).toBeVisible()
  await expect(page.locator('dd').filter({ hasText: 'Operação Brasper:' })).toHaveText(description)
  await page.getByRole('button', { name: /Emitir/ }).click()
  await expect.poll(() => submitted).toEqual({ expected_total: '9.60', expected_document: '12345678901', expected_description: description })
  await expect(page.getByText('En proceso', { exact: true }).first()).toBeVisible()
})
