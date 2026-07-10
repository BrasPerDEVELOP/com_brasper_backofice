import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../../domain/models'
import { SPECIAL_CALCULATOR_DISCOUNT_CODE } from '../../domain/models'
import {
  enrichTransactionWithSpecialDiscountMeta,
  getTransactionSpecialDiscountMeta,
  removeTransactionSpecialDiscountMeta,
  saveTransactionSpecialDiscountMeta,
  syncSpecialDiscountMetaAfterSave,
} from './transaction_special_discount_meta'

const STORAGE_KEY = 'transactions.specialDiscountMeta.v1'

function makeSpecialTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id: 'tx-1',
    coupon_discount_code: SPECIAL_CALCULATOR_DISCOUNT_CODE,
    origin_amount: 630,
    destination_amount: 1450,
    coupon_destination_amount: 1450,
    coupon_discount_commission: 12.5,
    coupon_discount_percentage: 10,
    coupon_discount_total_to_send: 617.5,
    resultado_comision: 12.5,
    total_a_enviar: 617.5,
    ...overrides,
  }
}

describe('transaction_special_discount_meta', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
      removeItem(key: string) {
        delete this.store[key]
      },
    })
  })

  it('prefers API amounts when ESPECIAL is persisted and refreshes session meta', () => {
    saveTransactionSpecialDiscountMeta('tx-1', {
      discountCommission: 12.5,
      discountPercentage: 10,
      baseReceive: 1449.18,
      finalReceive: 1449.18,
      improvementReceive: 0,
      finalCommission: 12.5,
      totalToSend: 617.5,
    })

    const enriched = enrichTransactionWithSpecialDiscountMeta(
      makeSpecialTransaction({
        destination_amount: 1500,
        coupon_destination_amount: 1500,
        total_a_enviar: 620,
        coupon_discount_total_to_send: 620,
      }),
    )

    expect(enriched.destination_amount).toBe(1500)
    expect(enriched.total_a_enviar).toBe(620)
    expect(getTransactionSpecialDiscountMeta('tx-1')?.finalReceive).toBe(1500)
    expect(getTransactionSpecialDiscountMeta('tx-1')?.totalToSend).toBe(620)
  })

  it('falls back to session meta for legacy transactions without ESPECIAL in API', () => {
    saveTransactionSpecialDiscountMeta('tx-legacy', {
      discountCommission: 8,
      discountPercentage: 5,
      baseReceive: 1400,
      finalReceive: 1450,
      improvementReceive: 50,
      finalCommission: 10,
      totalToSend: 620,
    })

    const enriched = enrichTransactionWithSpecialDiscountMeta({
      id: 'tx-legacy',
      origin_amount: 630,
      destination_amount: 1449.18,
      total_a_enviar: 617.5,
    })

    expect(enriched.destination_amount).toBe(1450)
    expect(enriched.total_a_enviar).toBe(620)
    expect(enriched.coupon_discount_code).toBe(SPECIAL_CALCULATOR_DISCOUNT_CODE)
  })

  it('syncs session meta after save from updated API response', () => {
    saveTransactionSpecialDiscountMeta('tx-1', {
      discountCommission: 12.5,
      discountPercentage: 10,
      baseReceive: 1449.18,
      finalReceive: 1449.18,
      improvementReceive: 0,
      finalCommission: 12.5,
      totalToSend: 617.5,
    })

    syncSpecialDiscountMetaAfterSave(
      makeSpecialTransaction({
        destination_amount: 1500,
        coupon_destination_amount: 1500,
        total_a_enviar: 620,
        coupon_discount_total_to_send: 620,
      }),
    )

    const raw = sessionStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as Record<string, { finalReceive: number; totalToSend: number }>
    expect(parsed['tx-1'].finalReceive).toBe(1500)
    expect(parsed['tx-1'].totalToSend).toBe(620)
  })

  it('removes session meta when the transaction is deleted', () => {
    saveTransactionSpecialDiscountMeta('tx-delete', {
      discountCommission: 8,
      discountPercentage: 5,
      baseReceive: 1400,
      finalReceive: 1450,
      improvementReceive: 50,
      finalCommission: 10,
      totalToSend: 620,
    })

    removeTransactionSpecialDiscountMeta('tx-delete')

    expect(getTransactionSpecialDiscountMeta('tx-delete')).toBeNull()
    const raw = sessionStorage.getItem(STORAGE_KEY)
    expect(raw ? JSON.parse(raw) : {}).not.toHaveProperty('tx-delete')
  })
})
