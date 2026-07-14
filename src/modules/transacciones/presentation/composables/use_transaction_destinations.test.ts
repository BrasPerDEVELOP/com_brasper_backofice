import { describe, expect, it } from 'vitest'
import { validateTransactionDestinations } from './use_transaction_destinations'

describe('validateTransactionDestinations', () => {
  it('acepta montos manuales cuya suma coincide', () => {
    expect(validateTransactionDestinations([
      { bank_account_id: 'bcp', amount: 300 },
      { bank_account_id: 'interbank', amount: 330 }
    ], 630)).toMatchObject({ total: 630, difference: 0, error: null })
  })

  it('redondea la suma a centavos', () => {
    expect(validateTransactionDestinations([
      { bank_account_id: 'a', amount: 0.1 },
      { bank_account_id: 'b', amount: 0.2 }
    ], 0.3).error).toBeNull()
  })

  it('rechaza cuentas duplicadas', () => {
    expect(validateTransactionDestinations([
      { bank_account_id: 'a', amount: 10 },
      { bank_account_id: 'a', amount: 20 }
    ], 30).error).toContain('repetir')
  })

  it('informa el monto pendiente', () => {
    expect(validateTransactionDestinations([
      { bank_account_id: 'a', amount: 20 }
    ], 30)).toMatchObject({ difference: 10 })
  })
})
