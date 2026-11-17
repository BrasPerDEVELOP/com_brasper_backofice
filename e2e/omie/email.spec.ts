import { expect, test } from '@playwright/test'

// Mount the real panel through Vite, with all email endpoints intercepted.
// No customer messages or fiscal requests leave this test.
const fixtureHtml = `<!doctype html><html><body><div id="panel"></div><script type="module">
import '/src/interface/styles/main.css';
import { createApp, h } from '/node_modules/.vite/deps/vue.js';
import { createPinia } from '/node_modules/.vite/deps/pinia.js';
import { useAuthStore } from '/src/modules/auth/presentation/controllers/use_auth_store_controller.ts';
import Panel from '/src/modules/omie/presentation/OmieEmailPanel.vue';
const pinia = createPinia();
useAuthStore(pinia).user = { role: location.search.includes('viewer') ? 'viewer' : 'admin', permissions: ['billing.view'] };
createApp({render: () => h(Panel, {transactionId: 'test-transaction'})}).use(pinia).mount('#panel');
</script></body></html>`

test('selects registered and additional recipients, tracks partial delivery and retries only remaining emails', async ({ page }, testInfo) => {
  let data = {
    customer_emails: ['sent@example.com', 'client@example.com'],
    email_status: 'sent', email_recipients: ['sent@example.com'],
    email_delivered_to: ['sent@example.com'], email_sent_at: null
  }
  const submissions: string[][] = []
  await page.route('**/qa-omie-email', (route) => route.fulfill({ contentType: 'text/html', body: fixtureHtml }))
  await page.route('**/omie/transactions/test-transaction/email', async (route) => {
    if (route.request().method() === 'POST') {
      const recipients = route.request().postDataJSON().recipients as string[]
      submissions.push(recipients)
      data = { ...data, email_status: 'pending', email_recipients: recipients }
    }
    await route.fulfill({ json: data })
  })
  await page.goto('/qa-omie-email')
  await expect(page.getByRole('checkbox', { name: 'sent@example.com' })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: 'client@example.com' })).toBeChecked()
  await page.getByRole('button', { name: '+ Agregar destinatario' }).click()
  await page.getByRole('textbox', { name: 'Correo adicional 1' }).fill('extra@example.com')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('omie-email-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Enviar PDF (2)' }).click()
  await expect(page.getByRole('button', { name: 'Envío en curso…' })).toBeDisabled()
  expect(submissions).toEqual([['client@example.com', 'extra@example.com']])
  data = { ...data, email_status: 'failed', email_delivered_to: ['sent@example.com', 'client@example.com'] }
  await page.getByRole('button', { name: 'Actualizar estado del correo' }).click()
  await expect(page.getByRole('checkbox', { name: 'client@example.com' })).toBeDisabled()
  await page.getByRole('button', { name: 'Enviar PDF (1)' }).click()
  expect(submissions[1]).toEqual(['extra@example.com'])
})

test('a view-only operator cannot send email', async ({ page }) => {
  await page.route('**/qa-omie-email?viewer', (route) => route.fulfill({ contentType: 'text/html', body: fixtureHtml }))
  await page.route('**/omie/transactions/test-transaction/email', (route) => route.fulfill({ json: {
    customer_emails: ['client@example.com'], email_status: 'sent', email_recipients: ['client@example.com'],
    email_delivered_to: ['client@example.com'], email_sent_at: null
  } }))
  await page.goto('/qa-omie-email?viewer')
  await expect(page.getByText('PDF enviado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Enviar PDF/ })).toHaveCount(0)
})
