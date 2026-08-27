import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_COMMISSION_DEFAULT,
  calculateAccountingCommission,
  calculateAccountingFinalSale,
  calculateAccountingInternalSale,
  defaultVariableDiscountPercent
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

describe('defaultVariableDiscountPercent', () => {
  it('es 0 bajo el umbral de 100 y sube por tramos de monto', () => {
    expect(defaultVariableDiscountPercent(80)).toBe(0)
    expect(defaultVariableDiscountPercent(200)).toBe(40)
    expect(defaultVariableDiscountPercent(1500)).toBe(50)
    expect(defaultVariableDiscountPercent(4520)).toBe(60)
  })
})

describe('calculateAccountingInternalSale', () => {
  it('reproduce la fila de comisión fija 3 (monto < 100, V = 0)', () => {
    expect(calculateAccountingInternalSale(3, 0)).toEqual({
      net: 2.54,
      tax: 0.46,
      sale: 3
    })
  })

  it('aplica el descuento variable y el IGV 18% (Excel Q=8, V=40%)', () => {
    expect(calculateAccountingInternalSale(8, 40)).toEqual({
      net: 4.07,
      tax: 0.73,
      sale: 4.8
    })
  })

  it('Venta Final = comisión neta + impuesto (Excel Q=45, V=50%)', () => {
    expect(calculateAccountingInternalSale(45, 50)).toEqual({
      net: 19.07,
      tax: 3.43,
      sale: 22.5
    })
  })

  it('devuelve vacío cuando no hay comisión de cliente', () => {
    expect(calculateAccountingInternalSale(0, 40)).toBeUndefined()
    expect(calculateAccountingInternalSale(null, 40)).toBeUndefined()
  })
})
