import { describe, expect, it } from 'vitest'
import { normalizeGetTransactionsParams } from './transaction_payload_guards'

describe('normalizeGetTransactionsParams', () => {
  it('devuelve undefined sin parámetros', () => {
    expect(normalizeGetTransactionsParams()).toBeUndefined()
    expect(normalizeGetTransactionsParams({})).toBeUndefined()
  })

  it('propaga paginación de servidor (incluye skip=0)', () => {
    const out = normalizeGetTransactionsParams({ skip: 0, limit: 20 })
    expect(out).toEqual({ skip: 0, limit: 20 })
  })

  it('descarta skip negativo y limit no positivo', () => {
    expect(normalizeGetTransactionsParams({ skip: -5, limit: 0 })).toBeUndefined()
  })

  it('propaga búsqueda, fechas de envío y monedas', () => {
    const out = normalizeGetTransactionsParams({
      search: '  ABC  ',
      send_date_from: '2026-01-01T00:00:00.000Z',
      send_date_to: '2026-01-31T23:59:59.000Z',
      origin_currency: 'BRL',
      destination_currency: 'PEN',
      skip: 40,
      limit: 10,
    })
    expect(out).toEqual({
      search: 'ABC',
      send_date_from: '2026-01-01T00:00:00.000Z',
      send_date_to: '2026-01-31T23:59:59.000Z',
      origin_currency: 'BRL',
      destination_currency: 'PEN',
      skip: 40,
      limit: 10,
    })
  })

  it('omite strings vacíos o de solo espacios', () => {
    const out = normalizeGetTransactionsParams({
      status: '   ',
      user_id: '',
      search: '  ',
      skip: 10,
      limit: 25,
    })
    expect(out).toEqual({ skip: 10, limit: 25 })
  })
})
