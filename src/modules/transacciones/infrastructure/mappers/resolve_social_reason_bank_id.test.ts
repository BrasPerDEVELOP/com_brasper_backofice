import { describe, expect, it } from 'vitest'
import { resolveSocialReasonBankId } from './resolve_social_reason_bank_id'

const banks = [
  { id: 'santander-brl', company: 'Brasper 21', bank: 'Santander', currency: 'BRL' },
  { id: 'picpay-brl', company: 'Brasper 21', bank: 'PicPay', currency: 'BRL' },
  { id: 'brasper-pen', company: 'Brasper 21', bank: 'BCP', currency: 'PEN' }
]

describe('resolveSocialReasonBankId', () => {
  it('prioriza y conserva el ID persistido aunque el catálogo aún no haya cargado', () => {
    expect(
      resolveSocialReasonBankId({
        persistedBankId: ' santander-brl ',
        companyName: 'Brasper 21',
        originCurrency: 'BRL',
        banks: []
      })
    ).toBe('santander-brl')
  })

  it('no elige el primer banco cuando empresa y moneda tienen duplicados', () => {
    expect(
      resolveSocialReasonBankId({
        companyName: 'Brasper 21',
        originCurrency: 'brl',
        banks
      })
    ).toBe('')
  })

  it('resuelve un registro legacy solo si empresa y moneda dejan una coincidencia', () => {
    expect(
      resolveSocialReasonBankId({
        companyName: ' brasper 21 ',
        originCurrency: 'PEN',
        banks
      })
    ).toBe('brasper-pen')
  })

  it('no intenta resolver legacy hasta conocer la moneda', () => {
    expect(
      resolveSocialReasonBankId({
        companyName: 'Brasper 21',
        originCurrency: '',
        banks: [banks[2]!]
      })
    ).toBe('')
  })
})
