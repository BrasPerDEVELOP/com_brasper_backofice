import { describe, expect, it } from 'vitest'
import { accountingCurrencySymbol, formatAccountingMoney } from './accounting_money'

describe('accountingCurrencySymbol', () => {
  it('usa el símbolo de la moneda de envío', () => {
    expect(accountingCurrencySymbol('PEN')).toBe('S/')
    expect(accountingCurrencySymbol('brl')).toBe('R$')
    expect(accountingCurrencySymbol('USD')).toBe('$')
  })

  it('devuelve vacío si no hay moneda', () => {
    expect(accountingCurrencySymbol('')).toBe('')
    expect(accountingCurrencySymbol(undefined)).toBe('')
  })
})

describe('formatAccountingMoney', () => {
  it('no fuerza soles: el símbolo sigue al monto de envío', () => {
    expect(formatAccountingMoney(13.98, 'PEN')).toBe('S/ 13.98')
    expect(formatAccountingMoney(53.97, 'BRL')).toBe('R$ 53.97')
    expect(formatAccountingMoney(15.82, 'USD')).toBe('$ 15.82')
  })

  it('devuelve guion cuando el importe no es numérico', () => {
    expect(formatAccountingMoney(null, 'PEN')).toBe('—')
    expect(formatAccountingMoney(undefined, 'BRL')).toBe('—')
    expect(formatAccountingMoney(Number.NaN, 'USD')).toBe('—')
  })
})
