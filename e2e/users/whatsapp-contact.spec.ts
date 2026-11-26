import { expect, test } from '@playwright/test'

test('el formulario muestra y envía el usuario de WhatsApp sin convertirlo a número', async ({ page }) => {
  let savedContacts: object | null = null
  await page.route('**/qa-whatsapp-contact', route => route.fulfill({
    contentType: 'text/html',
    body: '<html><body><div id="app"></div><script type="module" src="/e2e/users/document-lookup.fixture.ts"></script></body></html>',
  }))
  await page.route('**/user?*', route => route.fulfill({ json: [] }))
  await page.route('**/user', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] })
    const form = await new Response(route.request().postDataBuffer(), {
      headers: { 'Content-Type': route.request().headers()['content-type']! },
    }).formData()
    savedContacts = { phone: form.get('phone'), whatsapp_username: form.get('whatsapp_username') }
    return route.fulfill({ json: { id: 'qa-contact', names: 'Contacto QA', ...savedContacts } })
  })
  await page.goto('/qa-whatsapp-contact')
  const contact = page.getByLabel('Usuario de WhatsApp (opcional)', { exact: true })
  await expect(contact).toBeVisible()
  await contact.fill('cliente.brasper')
  await expect(contact).toHaveValue('cliente.brasper')
  await contact.fill('@@cliente.brasper')
  await contact.blur()
  await expect(contact).toHaveValue('cliente.brasper')
  const phone = page.getByLabel('Teléfono', { exact: true })
  await phone.fill('001234567')
  await phone.fill('@otro')
  await expect(phone).toHaveValue('001234567')
  await page.getByPlaceholder('Nombres', { exact: true }).fill('Contacto QA')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect.poll(() => savedContacts).toEqual({ phone: '001234567', whatsapp_username: '@cliente.brasper' })
})
