import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCalculatorStore } from './use_calculator_store_controller'
import type { ExchangeRate, CommissionRange } from '../../domain/models'
import {
  getTransactionSpecialDiscountInfo,
  roundMoneyAmount,
  SPECIAL_CALCULATOR_DISCOUNT_CODE,
} from '@modules/transacciones/domain/models'

/**
 * Caso real: transacción BxP-0016 (última por fecha de envío al momento del análisis).
 * API: origin 797 BRL, destination 499.92 PEN, commission 27.89, total_send 769.11, tax 0.65.
 */
const BXP_API = {
  code: 'BxP-0000000016',
  origin_amount: 797,
  destination_amount: 499.92,
  commission_result: 27.89,
  total_to_send: 769.11,
  tax_amount: 0.65,
  tax_rate_id: 'rate-brl-pen',
  commission_id: 'comm-brl-pen',
} as const

const RATE_BRL_PEN: ExchangeRate = {
  id: BXP_API.tax_rate_id,
  pair: 'brl-pen',
  rate: BXP_API.tax_amount,
  from: 'brl',
  to: 'pen',
}

function commissionBrlPen(percentage: number, id = BXP_API.commission_id): CommissionRange {
  return {
    id,
    coin_a: 'brl',
    coin_b: 'pen',
    percentage,
    reverse: false,
    min_amount: 0,
    max_amount: 999_999,
  }
}

function seedBrlPenStore(
  store: ReturnType<typeof useCalculatorStore>,
  commissionPercentage: number,
) {
  store.$patch({
    taxRates: [RATE_BRL_PEN],
    commissions: [commissionBrlPen(commissionPercentage)],
    calculationMode: 'special',
    currencyFrom: 'brl',
    currencyTo: 'pen',
    lastCoinCatalogWasTrial: false,
  })
}

function runSpecialQuote(
  store: ReturnType<typeof useCalculatorStore>,
  send: number,
  targetReceive: number,
) {
  store.setAmountSend(send)
  store.setAmountReceive(targetReceive)
  return store.result
}

function catalogsFor(commissionPercentage: number) {
  return {
    taxRates: [
      {
        id: BXP_API.tax_rate_id,
        coin_a: 'BRL',
        coin_b: 'PEN',
        tax: BXP_API.tax_amount,
      },
    ],
    commissions: [
      {
        id: BXP_API.commission_id,
        coin_a: 'BRL',
        coin_b: 'PEN',
        percentage: commissionPercentage,
        min_amount: 0,
        max_amount: 999_999,
      },
    ],
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(useCalculatorStore(), 'loadData').mockResolvedValue(undefined)
})

describe('BxP-0016 — calculadora especial (análisis)', () => {
  it('con comisión catálogo 3,5%: la cotización especial coincide con el API (sin mejora visible)', () => {
    const store = useCalculatorStore()
    seedBrlPenStore(store, 3.5)

    const res = runSpecialQuote(store, BXP_API.origin_amount, BXP_API.destination_amount)
    expect(res).not.toBeNull()

    expect(roundMoneyAmount(res!.amountSend)).toBe(BXP_API.origin_amount)
    expect(roundMoneyAmount(res!.amountReceive)).toBe(BXP_API.destination_amount)
    expect(roundMoneyAmount(res!.finalCommission)).toBe(BXP_API.commission_result)
    expect(roundMoneyAmount(res!.totalToSend)).toBe(BXP_API.total_to_send)
    expect(res!.specialDiscountAmount).toBeLessThan(0.01)
    expect(res!.specialImprovementAmount).toBeLessThan(0.01)

    const inferred = getTransactionSpecialDiscountInfo(
      {
        id: '1',
        ...BXP_API,
        resultado_comision: BXP_API.commission_result,
        total_a_enviar: BXP_API.total_to_send,
      },
      catalogsFor(3.5),
    )
    // Redondeo: 797×3,5% = 27,895 → 27,90; comisión API 27,89 → diferencia 0,01 (ruido).
    expect(inferred?.improvementReceive ?? 0).toBeLessThan(0.01)
  })

  it('con comisión catálogo ~3,797%: aparece mejora ~1,54 PEN (lo que ve la tabla)', () => {
    const catalogPct = 3.797
    const store = useCalculatorStore()
    seedBrlPenStore(store, catalogPct)

    const res = runSpecialQuote(store, BXP_API.origin_amount, BXP_API.destination_amount)
    expect(res).not.toBeNull()

    expect(roundMoneyAmount(res!.finalCommission)).toBe(BXP_API.commission_result)
    expect(roundMoneyAmount(res!.specialImprovementAmount)).toBe(1.54)
    expect(roundMoneyAmount(res!.specialDiscountAmount)).toBe(2.37)

    const inferred = getTransactionSpecialDiscountInfo(
      {
        id: '1',
        ...BXP_API,
        resultado_comision: BXP_API.commission_result,
        total_a_enviar: BXP_API.total_to_send,
      },
      catalogsFor(catalogPct),
    )
    expect(inferred).not.toBeNull()
    expect(inferred!.improvementReceive).toBe(1.54)
    expect(inferred!.discountCommission).toBe(2.37)
    expect(inferred!.persisted).toBe(false)
  })

  it('documenta la fórmula: mejora en destino = descuento comisión × tasa', () => {
    const store = useCalculatorStore()
    seedBrlPenStore(store, 4)

    const res = runSpecialQuote(store, 797, 499.92)
    expect(res).not.toBeNull()

    const expectedBaseCommission = roundMoneyAmount(797 * 0.04)
    const expectedDiscount = roundMoneyAmount(
      expectedBaseCommission - res!.finalCommission,
    )
    const expectedImprovement = roundMoneyAmount(expectedDiscount * BXP_API.tax_amount)

    expect(roundMoneyAmount(res!.specialDiscountAmount)).toBe(expectedDiscount)
    expect(roundMoneyAmount(res!.specialImprovementAmount)).toBe(expectedImprovement)
    expect(roundMoneyAmount(res!.specialBaseReceive)).toBe(
      roundMoneyAmount((797 - expectedBaseCommission) * BXP_API.tax_amount),
    )
  })

  it('payload ESPECIAL al crear: snapshot alineado con result de la calculadora', () => {
    const store = useCalculatorStore()
    seedBrlPenStore(store, 3.797)
    const res = runSpecialQuote(store, BXP_API.origin_amount, BXP_API.destination_amount)
    expect(res).not.toBeNull()

    const snapshot = {
      calculationMode: 'special' as const,
      origin_amount: roundMoneyAmount(res!.amountSend),
      destination_amount: roundMoneyAmount(res!.amountReceive),
      resultado_comision: roundMoneyAmount(res!.finalCommission),
      total_a_enviar: roundMoneyAmount(res!.totalToSend),
      tax_amount: res!.rate,
      tax_rate_id: BXP_API.tax_rate_id,
      commission_id: BXP_API.commission_id,
      specialDiscountAmount: roundMoneyAmount(res!.specialDiscountAmount),
      specialDiscountPercentage: res!.specialDiscountPercentage,
      specialBaseReceive: roundMoneyAmount(res!.specialBaseReceive),
    }

    expect(snapshot.origin_amount).toBe(797)
    expect(snapshot.destination_amount).toBe(499.92)
    expect(snapshot.resultado_comision).toBe(27.89)
    expect(snapshot.total_a_enviar).toBe(769.11)
    expect(snapshot.specialDiscountAmount).toBe(2.37)
    expect(snapshot.specialBaseReceive).toBe(498.38)

    const persistedPayload = {
      coupon_discount_code: SPECIAL_CALCULATOR_DISCOUNT_CODE,
      coupon_discount_commission: snapshot.specialDiscountAmount,
      coupon_discount_percentage: snapshot.specialDiscountPercentage,
      coupon_origin_amount: snapshot.origin_amount,
      coupon_destination_amount: snapshot.destination_amount,
      coupon_discount_total_to_send: snapshot.total_a_enviar,
    }

    expect(persistedPayload.coupon_discount_code).toBe('ESPECIAL')
    expect(persistedPayload.coupon_discount_commission).toBeGreaterThan(0)
  })

  it('si el usuario no edita el recibe manualmente, especial = normal (sin descuento)', () => {
    const store = useCalculatorStore()
    seedBrlPenStore(store, 3.796)
    store.setAmountSend(797)
    // specialReceiveManuallyEdited queda false → targetReceive = baseQuote.amountReceive

    const res = store.result
    expect(res).not.toBeNull()
    expect(Math.abs(res!.specialDiscountAmount)).toBeLessThan(0.01)
    expect(res!.amountReceive).toBeCloseTo(res!.specialBaseReceive, 2)
    expect(roundMoneyAmount(res!.amountReceive)).toBe(498.38)
  })

  it('ingeniería inversa: el API implica comisión efectiva ~3,499% y catálogo ~3,797% para +1,54 PEN', () => {
    const send = BXP_API.origin_amount
    const receive = BXP_API.destination_amount
    const rate = BXP_API.tax_amount
    const finalCommission = BXP_API.commission_result

    const effectivePct = roundMoneyAmount((finalCommission / send) * 100)
    const netOrigin = roundMoneyAmount(receive / rate)
    const baseReceiveFor154 = roundMoneyAmount(receive - 1.54)
    const impliedBaseCommission = roundMoneyAmount(send - baseReceiveFor154 / rate)
    const impliedCatalogPct = roundMoneyAmount((impliedBaseCommission / send) * 100)

    expect(effectivePct).toBe(3.5)
    expect(netOrigin).toBe(769.11)
    expect(impliedCatalogPct).toBe(3.8)
  })
})
