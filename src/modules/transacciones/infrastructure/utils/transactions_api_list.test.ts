import { describe, expect, it } from 'vitest'
import { extractTransactionsListFromApiPayload } from './transactions_api_list'

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
