import { expect, test } from '@playwright/test'

const html = `<!doctype html><html><body><div id="app"></div><script type="module" src="/e2e/billing/recipients.fixture.ts"></script></body></html>`
const original = {
  id: 'qa-invoice', transaction_id: 'qa-transaction', issuer_ruc: '20611936428',
  issuer_name: 'INGENITECH S.A.C.', document_type: '03', document_type_label: 'Boleta de venta',
  series: 'BB02', number: 199, full_number: 'BB02-00000199',
  status: 'accepted', environment: 'production', currency: 'PEN', total_amount: 7,
  customer_name: 'Cliente de prueba', customer_email: 'client@example.com',
  customer_emails: ['client@example.com'], email_delivered_to: [] as string[],
  email_recipients: [] as string[], email_status: null as string | null, events: [],
}

test('unchecked customer is excluded when sending only to an additional recipient', async ({ page }) => {
  let invoice = { ...original }
  const sent: string[][] = []
  await page.route('**/qa-billing-recipients', route => route.fulfill({ contentType: 'text/html', body: html }))
  await page.route('**/billing/status', route => route.fulfill({ json: { enabled: true, environment: 'production', issuers: [] } }))
  await page.route('**/billing/invoices/qa-invoice', route => route.fulfill({ json: invoice }))
  await page.route('**/billing/invoices/qa-invoice/email', route => {
    const recipients = route.request().postDataJSON().recipients as string[]
    sent.push(recipients)
    invoice = { ...invoice, email_recipients: recipients, email_delivered_to: recipients, email_status: 'sent' }
    return route.fulfill({ json: invoice })
  })
  await page.goto('/qa-billing-recipients')
  const customer = page.getByRole('checkbox', { name: 'client@example.com' })
  await expect(customer).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Enviar PDF (0)' })).toBeDisabled()
  await customer.check()
  await customer.uncheck()
  await page.getByRole('button', { name: '+ Agregar destinatario' }).click()
  await page.getByLabel('Destinatario adicional 1').fill('extra@example.com')
  await expect(page.getByText('Se enviará únicamente a: extra@example.com')).toBeVisible()
  await page.getByRole('button', { name: 'Enviar PDF (1)' }).click()
  expect(sent).toEqual([['extra@example.com']])
  await expect(page.getByText('Historial de envíos:', { exact: false })).toContainText('extra@example.com')
  await expect(page.getByText('Historial de envíos:', { exact: false })).not.toContainText('client@example.com')
  await expect(customer).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Enviar PDF (0)' })).toBeDisabled()
})

test('previously sent recipients appear in history, not as unchecked recipient checkboxes', async ({ page }) => {
  await page.route('**/qa-billing-recipients', route => route.fulfill({ contentType: 'text/html', body: html }))
  await page.route('**/billing/status', route => route.fulfill({ json: { enabled: true, environment: 'production', issuers: [] } }))
  await page.route('**/billing/invoices/qa-invoice', route => route.fulfill({ json: {
    ...original, email_status: 'sent', email_recipients: ['extra@example.com'],
    email_delivered_to: ['client@example.com', 'extra@example.com'],
  } }))
  await page.goto('/qa-billing-recipients')
  await expect(page.getByText('Historial de envíos:', { exact: false })).toContainText('client@example.com, extra@example.com')
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByText('No hay destinatarios seleccionados.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar PDF (0)' })).toBeDisabled()
})
