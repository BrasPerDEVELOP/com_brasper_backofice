import { describe, expect, it } from 'vitest'
import { formatInvoiceMoney, formatLimaDateTime } from './billing_format'

describe('billing_format', () => {
  it('muestra la emisión en hora de Lima sin importar la zona del navegador', () => {
    // 03:30 UTC del 4 de octubre = 22:30 del 3 de octubre en Lima.
    const text = formatLimaDateTime('2026-10-04T03:30:00Z')
    expect(text).toContain('03/10/2026')
    expect(text).toMatch(/10:30|22:30/)
    expect(formatLimaDateTime(null)).toBe('—')
    expect(formatLimaDateTime('no-es-fecha')).toBe('—')
  })

  it('formatea importes con el símbolo de la moneda del comprobante', () => {
    expect(formatInvoiceMoney(40, 'PEN')).toBe('S/ 40.00')
    expect(formatInvoiceMoney(6.1, 'BRL')).toBe('R$ 6.10')
    expect(formatInvoiceMoney(null, 'PEN')).toBe('—')
  })
})
