import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_COMMISSION_DEFAULT,
  calculateAccountingCommission,
  calculateAccountingFinalSale
} from './accounting_commission'

describe('calculateAccountingCommission', () => {
  it('devuelve vacío cuando el monto es 0 o inválido', () => {
    expect(calculateAccountingCommission(0, 45)).toBeUndefined()
    expect(calculateAccountingCommission(null, 45)).toBeUndefined()
    expect(calculateAccountingCommission(undefined, 45)).toBeUndefined()
  })

  it('usa la comisión fija de 3 cuando el monto de envío es menor a 100', () => {
    expect(calculateAccountingCommission(50, 0)).toBe(ACCOUNTING_COMMISSION_DEFAULT)
    expect(calculateAccountingCommission(52, 45)).toBe(3)
    expect(calculateAccountingCommission(99.99, null)).toBe(3)
  })

  it('calcula monto × porcentaje de contabilidad cuando el monto es >= 100', () => {
    expect(calculateAccountingCommission(2000, 3)).toBe(60)
    expect(calculateAccountingCommission(5640, 45)).toBe(2538)
    expect(calculateAccountingCommission(100, 3.5)).toBe(3.5)
  })

  it('sin porcentaje no calcula cuando el monto es >= 100', () => {
    expect(calculateAccountingCommission(200, null)).toBeUndefined()
    expect(calculateAccountingCommission(200, undefined)).toBeUndefined()
  })
})

describe('calculateAccountingFinalSale', () => {
  it('resta la comisión al monto de envío', () => {
    expect(calculateAccountingFinalSale(5640, 2538)).toBe(3102)
    expect(calculateAccountingFinalSale(50, 3)).toBe(47)
  })

  it('devuelve vacío si faltan datos', () => {
    expect(calculateAccountingFinalSale(100, null)).toBeUndefined()
    expect(calculateAccountingFinalSale(null, 3)).toBeUndefined()
  })
})
