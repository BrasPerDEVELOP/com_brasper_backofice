import { describe, expect, it } from 'vitest'
import {
  extractTransactionsListFromApiPayload,
  extractTotalFromApiPayload,
} from './transactions_api_list'

describe('extractTransactionsListFromApiPayload', () => {
  it('reads a plain array', () => {
    const rows = [{ id: '1' }]
    expect(extractTransactionsListFromApiPayload(rows)).toEqual(rows)
  })

  it('reads data and results wrappers', () => {
    const rows = [{ id: '1' }, { id: '2' }]
    expect(extractTransactionsListFromApiPayload({ data: rows })).toEqual(rows)
    expect(extractTransactionsListFromApiPayload({ results: rows })).toEqual(rows)
    expect(extractTransactionsListFromApiPayload({ items: rows })).toEqual(rows)
  })

  it('reads nested paginated payloads', () => {
    const rows = [{ id: '9' }]
    expect(
      extractTransactionsListFromApiPayload({
        data: { count: 1, results: rows },
      }),
    ).toEqual(rows)
    expect(
      extractTransactionsListFromApiPayload({
        data: { transactions: rows },
      }),
    ).toEqual(rows)
  })
})

describe('extractTotalFromApiPayload', () => {
  it('reads total from a paginated payload', () => {
    expect(extractTotalFromApiPayload({ items: [{ id: '1' }], total: 42 })).toBe(42)
  })

  it('falls back when total is missing', () => {
    expect(extractTotalFromApiPayload([{ id: '1' }], 1)).toBe(1)
    expect(extractTotalFromApiPayload({ items: [] }, 7)).toBe(7)
  })

  it('ignores invalid totals', () => {
    expect(extractTotalFromApiPayload({ total: -3 }, 5)).toBe(5)
    expect(extractTotalFromApiPayload({ total: 'x' }, 5)).toBe(5)
  })
})
