import { describe, expect, it } from 'vitest'
import {
  canIssueAgain,
  canRetryInvoice,
  canVoidInvoice,
  invoiceEventLabel,
  invoiceStatusMeta,
  isInvoicePending,
  sunatIdentityLabel
} from '.'

describe('estados del comprobante', () => {
  it('etiqueta y tono por estado, con respaldo para valores desconocidos', () => {
    expect(invoiceStatusMeta('accepted')).toMatchObject({ label: 'Aceptado', tone: 'success' })
    expect(invoiceStatusMeta('sent').tone).toBe('pending')
    expect(invoiceStatusMeta('rejected').tone).toBe('danger')
    expect(invoiceStatusMeta('voided').tone).toBe('muted')
    expect(invoiceStatusMeta('raro')).toMatchObject({ label: 'raro', tone: 'neutral' })
  })

  it('acciones permitidas siguen las reglas del API', () => {
    expect(['reserved', 'sent'].every(isInvoicePending)).toBe(true)
    expect(isInvoicePending('accepted')).toBe(false)

    expect(['rejected', 'exception', 'error'].every(canRetryInvoice)).toBe(true)
    expect(['reserved', 'sent', 'accepted', 'voided'].some(canRetryInvoice)).toBe(false)

    expect(canVoidInvoice('accepted')).toBe(true)
    expect(canVoidInvoice('sent')).toBe(false)

    expect(canIssueAgain(null)).toBe(true)
    expect(canIssueAgain('voided')).toBe(true)
    expect(canIssueAgain('error')).toBe(false) // se reintenta, no se emite otro
  })

  it('traduce catálogo 06 y eventos', () => {
    expect(sunatIdentityLabel('6')).toBe('RUC')
    expect(sunatIdentityLabel('1')).toBe('DNI')
    expect(sunatIdentityLabel(null)).toBe('—')
    expect(invoiceEventLabel('accepted')).toBe('Aceptado por SUNAT')
    expect(invoiceEventLabel('otro')).toBe('otro')
  })
})
