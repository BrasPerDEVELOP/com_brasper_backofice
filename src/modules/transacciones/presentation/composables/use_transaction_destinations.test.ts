import { describe, expect, it } from 'vitest'
import {
  clearTransactionDestinationAccounts,
  formatDestinationAccountOptionLabel,
  validateCreateTransactionAssociations,
  validateTransactionDestinations
} from './use_transaction_destinations'

describe('formatDestinationAccountOptionLabel', () => {
  it('muestra la cuenta antes del nombre completo para una cuenta natural', () => {
    expect(
      formatDestinationAccountOptionLabel(
        {
          account_holder_type: 'Natural',
          holder_names: ' Eurico ',
          holder_surnames: 'Teles da Silva',
          account_number: '51391181477098'
        },
        'BCP'
      )
    ).toBe('BCP · 51391181477098 - Eurico Teles da Silva')
  })

  it('muestra la razón social para una cuenta jurídica', () => {
    expect(
      formatDestinationAccountOptionLabel(
        {
          account_holder_type: 'Jurídica',
          business_name: 'Brasper S.A.C.',
          account_number: '1234',
          cci_number: '00212345678901234567'
        },
        'BCP'
      )
    ).toBe('BCP · 1234 / CCI: 00212345678901234567 - Brasper S.A.C.')
  })

  it('conserva banco e identificador cuando el API no devuelve titular', () => {
    expect(
      formatDestinationAccountOptionLabel(
        {
          account_holder_type: 'Natural',
          pix_key: 'cliente@example.com'
        },
        'Banco do Brasil'
      )
    ).toBe('Banco do Brasil · PIX: cliente@example.com')
  })
})

describe('validateTransactionDestinations', () => {
  it('acepta montos manuales cuya suma coincide', () => {
    expect(
      validateTransactionDestinations(
        [
          { bank_account_id: 'bcp', amount: 300 },
          { bank_account_id: 'interbank', amount: 330 }
        ],
        630
      )
    ).toMatchObject({ total: 630, difference: 0, error: null })
  })

  it('redondea la suma a centavos', () => {
    expect(
      validateTransactionDestinations(
        [
          { bank_account_id: 'a', amount: 0.1 },
          { bank_account_id: 'b', amount: 0.2 }
        ],
        0.3
      ).error
    ).toBeNull()
  })

  it('rechaza cuentas duplicadas', () => {
    expect(
      validateTransactionDestinations(
        [
          { bank_account_id: 'a', amount: 10 },
          { bank_account_id: 'a', amount: 20 }
        ],
        30
      ).error
    ).toContain('repetir')
  })

  it('informa el monto pendiente', () => {
    expect(
      validateTransactionDestinations([{ bank_account_id: 'a', amount: 20 }], 30)
    ).toMatchObject({ difference: 10 })
  })
})

describe('validateCreateTransactionAssociations', () => {
  const completeInput = {
    userId: 'client-1',
    socialReasonBankId: 'bank-1',
    destinations: [{ bank_account_id: 'account-1', amount: 100 }],
    expectedTotal: 100
  }

  it('exige cliente y razón social al crear', () => {
    expect(validateCreateTransactionAssociations({ ...completeInput, userId: '' }).error).toBe(
      'Selecciona el cliente.'
    )
    expect(
      validateCreateTransactionAssociations({ ...completeInput, socialReasonBankId: '' }).error
    ).toBe('Selecciona la razón social.')
  })

  it('exige que todas las cuentas destino estén seleccionadas', () => {
    expect(
      validateCreateTransactionAssociations({
        ...completeInput,
        destinations: [{ bank_account_id: '', amount: 100 }]
      }).error
    ).toBe('Selecciona todas las cuentas destino.')
  })

  it('acepta los tres datos obligatorios completos', () => {
    expect(validateCreateTransactionAssociations(completeInput).error).toBeNull()
  })
})

describe('clearTransactionDestinationAccounts', () => {
  it('quita las cuentas del cliente anterior y conserva la distribución de montos', () => {
    expect(
      clearTransactionDestinationAccounts([
        { bank_account_id: 'bcp', amount: 300 },
        { bank_account_id: 'interbank', amount: 330 }
      ])
    ).toEqual([
      { bank_account_id: '', amount: 300 },
      { bank_account_id: '', amount: 330 }
    ])
  })

  it('mantiene al menos una fila vacía', () => {
    expect(clearTransactionDestinationAccounts([])).toEqual([{ bank_account_id: '', amount: null }])
  })
})
