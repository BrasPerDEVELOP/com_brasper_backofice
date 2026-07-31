import { describe, expect, it } from 'vitest'
import {
  formatDestinationAccountOptionLabel,
  validateTransactionDestinations
} from './use_transaction_destinations'

describe('formatDestinationAccountOptionLabel', () => {
  it('muestra la cuenta antes del nombre completo para una cuenta natural', () => {
    expect(formatDestinationAccountOptionLabel({
      account_holder_type: 'Natural',
      holder_names: ' Eurico ',
      holder_surnames: 'Teles da Silva',
      account_number: '51391181477098'
    }, 'BCP')).toBe('BCP · 51391181477098 - Eurico Teles da Silva')
  })

  it('muestra la razón social para una cuenta jurídica', () => {
    expect(formatDestinationAccountOptionLabel({
      account_holder_type: 'Jurídica',
      business_name: 'Brasper S.A.C.',
      account_number: '1234',
      cci_number: '00212345678901234567'
    }, 'BCP')).toBe('BCP · 1234 / CCI: 00212345678901234567 - Brasper S.A.C.')
  })

  it('conserva banco e identificador cuando el API no devuelve titular', () => {
    expect(formatDestinationAccountOptionLabel({
      account_holder_type: 'Natural',
      pix_key: 'cliente@example.com'
    }, 'Banco do Brasil')).toBe('Banco do Brasil · PIX: cliente@example.com')
  })
})

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
