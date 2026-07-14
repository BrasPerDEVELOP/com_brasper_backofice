import { describe, expect, it } from 'vitest'
import { appendFormValue } from './transaction_form_payload'

describe('appendFormValue', () => {
  it('serializa null como cadena vacía (el backend lo interpreta como limpiar)', () => {
    const form = new FormData()
    appendFormValue(form, 'operation_number', null)
    appendFormValue(form, 'payment_date', null)
    expect(form.get('operation_number')).toBe('')
    expect(form.get('payment_date')).toBe('')
  })

  it('omite undefined por completo', () => {
    const form = new FormData()
    appendFormValue(form, 'operation_number', undefined)
    expect(form.has('operation_number')).toBe(false)
  })

  it('serializa las listas *_keep como JSON', () => {
    const form = new FormData()
    const keep = [
      'transaction_vouchers/send_a.webp',
      'https://media.example.dev/backofice/transaction_vouchers/send_b.webp'
    ]
    appendFormValue(form, 'send_vouchers_keep', keep)
    expect(form.get('send_vouchers_keep')).toBe(JSON.stringify(keep))
  })

  it('adjunta cada valor de voucher bajo la misma clave', () => {
    const form = new FormData()
    const file = new File(['x'], 'nuevo.webp', { type: 'image/webp' })
    appendFormValue(form, 'send_voucher', ['transaction_vouchers/send_a.webp', file])
    const values = form.getAll('send_voucher')
    expect(values).toHaveLength(2)
    expect(values[0]).toBe('transaction_vouchers/send_a.webp')
    expect(values[1]).toBeInstanceOf(File)
  })

  it('serializa destinations como JSON', () => {
    const form = new FormData()
    const destinations = [{ bank_account_id: 'a', amount: 10 }]
    appendFormValue(form, 'destinations', destinations)
    expect(form.get('destinations')).toBe(JSON.stringify(destinations))
  })
})
