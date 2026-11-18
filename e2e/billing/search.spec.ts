import { expect, test } from '@playwright/test'

const fixtureHtml = `<!doctype html><html><body><div id="app"></div><script type="module" src="/e2e/billing/search.fixture.ts"></script></body></html>`

test('search submits to the API, resets the page, combines filters and clears', async ({ page }) => {
  const queries: URLSearchParams[] = []
  await page.route('**/qa-billing-search', (route) => route.fulfill({ contentType: 'text/html', body: fixtureHtml }))
  await page.route('**/billing/status', (route) => route.fulfill({ json: { enabled: true, issuers: [] } }))
  await page.route('**/billing/invoices?*', (route) => {
    const query = new URL(route.request().url()).searchParams
    queries.push(query)
    const searched = query.has('search')
    return route.fulfill({ json: { items: [], total: searched ? 0 : 25,
      page: Number(query.get('page')), page_size: 10, total_pages: searched ? 1 : 3,
      skip: (Number(query.get('page')) - 1) * 10, limit: 10 } })
  })
  await page.goto('/qa-billing-search')
  await expect(page.getByText('25 comprobantes · página 1 de 3')).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('25 comprobantes · página 2 de 3')).toBeVisible()
  await page.getByLabel('Buscar comprobante').fill('BB02-209')
  await page.getByLabel('Buscar comprobante').press('Enter')
  await expect(page.getByText('0 comprobantes · página 1 de 1')).toBeVisible()
  expect(queries.at(-1)?.get('search')).toBe('BB02-209')
  expect(queries.at(-1)?.get('page')).toBe('1')
  await page.locator('#billing-filter-status').selectOption('accepted')
  await expect.poll(() => queries.at(-1)?.get('status')).toBe('accepted')
  expect(queries.at(-1)?.get('search')).toBe('BB02-209')
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(page.getByText('25 comprobantes · página 1 de 3')).toBeVisible()
  await expect(page.getByLabel('Buscar comprobante')).toHaveValue('')
  expect(queries.at(-1)?.has('search')).toBe(false)
  expect(queries.at(-1)?.has('status')).toBe(false)
})
