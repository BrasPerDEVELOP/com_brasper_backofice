import { describe, expect, it } from 'vitest'
import type { Transaction } from './models/transaction'
import {
  getTransactionCurrencyPairKey,
  resolveTransactionCurrencyPair,
  transactionMatchesCurrencyPair,
  inferOriginCurrencyFromTransactionCode,
  formatTransactionCodeForDisplay,
  SPECIAL_CALCULATOR_DISCOUNT_CODE,
  getTransactionSpecialDiscountInfo,
  getTransactionSpecialDiscountForDisplay,
  buildDailySequenceMap,
} from './transaction_domain'

describe('resolveTransactionCurrencyPair', () => {
  it('resolves PEN-USD from tax rate catalog', () => {
    const tx: Transaction = { id: '1', tax_rate_id: 'rate-pen-usd' }
    const pair = resolveTransactionCurrencyPair(tx, {
      taxRateById: (id) =>
        id === 'rate-pen-usd' ? { coin_a: 'PEN', coin_b: 'USD' } : undefined,
    })
    expect(pair).toEqual({ origin: 'PEN', destination: 'USD' })
    expect(getTransactionCurrencyPairKey(tx, {
      taxRateById: (id) =>
        id === 'rate-pen-usd' ? { coin_a: 'PEN', coin_b: 'USD' } : undefined,
    })).toBe('pen-usd')
    expect(
      transactionMatchesCurrencyPair(tx, 'pen-usd', {
        taxRateById: (id) =>
          id === 'rate-pen-usd' ? { coin_a: 'PEN', coin_b: 'USD' } : undefined,
      }),
    ).toBe(true)
  })

  it('resolves pair from API flat currency fields', () => {
    const tx: Transaction = {
      origin_currency: 'pen',
      destination_currency: 'usd',
    }
    expect(resolveTransactionCurrencyPair(tx)).toEqual({
      origin: 'PEN',
      destination: 'USD',
    })
  })
})

describe('inferOriginCurrencyFromTransactionCode', () => {
  it('maps BxP to BRL and PxB to PEN', () => {
    expect(inferOriginCurrencyFromTransactionCode('BxP-0000000016')).toBe('BRL')
    expect(inferOriginCurrencyFromTransactionCode('PxB-0000000029')).toBe('PEN')
    expect(inferOriginCurrencyFromTransactionCode('BxP-16')).toBe('BRL')
  })
})

describe('formatTransactionCodeForDisplay', () => {
  it('keeps prefix and leaves two leading zeros', () => {
    expect(formatTransactionCodeForDisplay('BxP-0000000016')).toBe('BxP-0016')
    expect(formatTransactionCodeForDisplay('PxB-0000000029')).toBe('PxB-0029')
    expect(formatTransactionCodeForDisplay('BxP-0000000120')).toBe('BxP-00120')
    expect(formatTransactionCodeForDisplay('')).toBe('—')
  })
})

describe('getTransactionSpecialDiscountInfo', () => {
  const catalogs = {
    taxRates: [
      {
        id: 'rate-brl-pen',
        coin_a: 'BRL',
        coin_b: 'PEN',
        tax: 0.65,
      },
    ],
    commissions: [
      {
        id: 'comm-brl-pen',
        coin_a: 'BRL',
        coin_b: 'PEN',
        percentage: 5,
        min_amount: 0,
        max_amount: 999999,
      },
    ],
  }

  it('reads persisted ESPECIAL discount from coupon fields', () => {
    const tx: Transaction = {
      id: '1',
      origin_amount: 797,
      destination_amount: 499.92,
      commission_result: 27.89,
      tax_rate_id: 'rate-brl-pen',
      commission_id: 'comm-brl-pen',
      coupon_discount_code: SPECIAL_CALCULATOR_DISCOUNT_CODE,
      coupon_discount_commission: 12.11,
      coupon_discount_percentage: 43.2,
      total_to_send: 769.11,
    }
    const info = getTransactionSpecialDiscountInfo(tx, catalogs)
    expect(info?.persisted).toBe(true)
    expect(info?.discountCommission).toBe(12.11)
    expect(info?.improvementReceive).toBeGreaterThan(0)
  })

  it('infers special discount when applied commission is below catalog', () => {
    const tx: Transaction = {
      id: '2',
      origin_amount: 797,
      destination_amount: 499.92,
      commission_result: 27.89,
      total_to_send: 769.11,
      tax_rate_id: 'rate-brl-pen',
      commission_id: 'comm-brl-pen',
    }
    const info = getTransactionSpecialDiscountInfo(tx, catalogs)
    expect(info?.persisted).toBe(false)
    expect(info?.discountCommission).toBeGreaterThan(0)
    expect(info?.improvementReceive).toBeGreaterThan(0)
  })

  it('oculta inferencia con ruido de redondeo (< 1)', () => {
    const tx: Transaction = {
      id: '3',
      origin_amount: 797,
      destination_amount: 499.92,
      commission_result: 27.89,
      tax_rate_id: 'rate-brl-pen',
      commission_id: 'comm-brl-pen',
    }
    const catalogs = {
      taxRates: [
        {
          id: 'rate-brl-pen',
          coin_a: 'BRL',
          coin_b: 'PEN',
          tax: 0.65,
        },
      ],
      commissions: [
        {
          id: 'comm-brl-pen',
          coin_a: 'BRL',
          coin_b: 'PEN',
          percentage: 3.5,
          min_amount: 0,
          max_amount: 999999,
        },
      ],
    }
    expect(getTransactionSpecialDiscountInfo(tx, catalogs)).toBeNull()
    expect(getTransactionSpecialDiscountForDisplay(tx, catalogs)).toBeNull()
  })
})

describe('buildDailySequenceMap', () => {
  const tx = (
    id: string,
    send_date: string | undefined,
    created_at?: string,
  ): Transaction => ({ id, send_date, created_at }) as Transaction

  it('reinicia el correlativo en cada día y respeta el orden de ingreso', () => {
    const map = buildDailySequenceMap([
      tx('c', '2026-08-05T11:58:00', '2026-08-05T11:58:00'),
      tx('a', '2026-08-05T07:34:00', '2026-08-05T07:34:00'),
      tx('b', '2026-08-05T08:02:00', '2026-08-05T08:02:00'),
      tx('d', '2026-08-06T07:31:00', '2026-08-06T07:31:00'),
      tx('e', '2026-08-06T09:15:00', '2026-08-06T09:15:00'),
    ])
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(2)
    expect(map.get('c')).toBe(3)
    // el día siguiente arranca de cero otra vez
    expect(map.get('d')).toBe(1)
    expect(map.get('e')).toBe(2)
  })

  it('el número no depende del orden en que llega la lista', () => {
    const items = [
      tx('a', '2026-08-05T07:34:00', '2026-08-05T07:34:00'),
      tx('b', '2026-08-05T08:02:00', '2026-08-05T08:02:00'),
      tx('c', '2026-08-05T11:58:00', '2026-08-05T11:58:00'),
    ]
    const ascending = buildDailySequenceMap(items)
    const descending = buildDailySequenceMap(items.slice().reverse())
    expect(descending.get('a')).toBe(ascending.get('a'))
    expect(descending.get('c')).toBe(ascending.get('c'))
  })

  it('agrupa por send_date aunque created_at caiga en otro día', () => {
    const map = buildDailySequenceMap([
      tx('a', '2026-08-05T07:34:00', '2026-08-04T23:50:00'),
      tx('b', '2026-08-05T08:02:00', '2026-08-05T08:02:00'),
    ])
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(2)
  })

  it('cae en created_at cuando no hay send_date', () => {
    const map = buildDailySequenceMap([
      tx('a', undefined, '2026-08-05T09:00:00'),
      tx('b', undefined, '2026-08-05T10:00:00'),
    ])
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(2)
  })

  it('desempata por id para que el número sea estable entre recargas', () => {
    const same = '2026-08-05T08:00:00'
    const map = buildDailySequenceMap([tx('zzz', same, same), tx('aaa', same, same)])
    expect(map.get('aaa')).toBe(1)
    expect(map.get('zzz')).toBe(2)
  })

  it('ignora registros sin id y sin fecha utilizable', () => {
    const map = buildDailySequenceMap([
      { send_date: '2026-08-05T07:00:00' } as Transaction,
      tx('a', 'no-es-una-fecha'),
      tx('b', '2026-08-05T08:02:00', '2026-08-05T08:02:00'),
    ])
    expect(map.get('a')).toBeUndefined()
    expect(map.get('b')).toBe(1)
  })

  it('devuelve un mapa vacío si no hay transacciones', () => {
    expect(buildDailySequenceMap([]).size).toBe(0)
  })
})
