// @ts-nocheck — defineStore + factory: TS no infiere `this` en getters/actions del objeto devuelto.
import { defineStore } from 'pinia'
import type { CurrencyCode, ExchangeRate, CommissionRange, CalculatorResult } from '../../domain/models'
import type { CurrencyReadDTO } from '../../infrastructure/adapters/calculator_repository'
import { getCurrencyPairKey, CURRENCY_OPTIONS } from '../../domain/models'
import { LoadCalculatorDataUseCase } from '../../application/use_cases'
import { CalculatorApiAdapter } from '../../infrastructure/adapters'

/** Tramo de comisión según monto bruto enviado (origen). */
function pickCommissionBracket(
  grossSend: number,
  pairCommissions: CommissionRange[]
): CommissionRange | null {
  if (pairCommissions.length === 0) return null
  const match = pairCommissions.find(
    (c) => grossSend >= c.min_amount && grossSend <= c.max_amount
  )
  return match ?? pairCommissions[pairCommissions.length - 1]!
}

/**
 * Monto bruto en origen si el usuario indicó cuánto recibe el destinatario.
 * neto_origen = recibe / tasa; bruto * (1 - p) = neto_origen → bruto = neto / (1-p).
 * Si hay varios tramos, se prueba cada uno y se elige el que cuadra con `receive`.
 */
function resolveGrossFromReceive(
  receive: number,
  rate: number,
  pairCommissions: CommissionRange[]
): number {
  const net = receive / rate
  if (pairCommissions.length === 0 || net <= 0) return net

  const candidates: number[] = []
  for (const c of pairCommissions) {
    const p = c.percentage / 100
    if (p >= 1) continue
    const S = net / (1 - p)
    if (S + 1e-9 >= c.min_amount && S - 1e-9 <= c.max_amount) {
      candidates.push(S)
    }
  }

  if (candidates.length > 0) {
    let best = candidates[0]!
    let bestErr = Infinity
    for (const S of candidates) {
      const def = pickCommissionBracket(S, pairCommissions)
      const p = (def?.percentage ?? 0) / 100
      const recv = (S - S * p) * rate
      const err = Math.abs(recv - receive)
      if (err < bestErr) {
        bestErr = err
        best = S
      }
    }
    return best
  }

  const p0 = pairCommissions[pairCommissions.length - 1]!.percentage / 100
  let gross = net / (1 - Math.min(Math.max(p0, 0), 0.999999))
  for (let i = 0; i < 25; i++) {
    const def = pickCommissionBracket(gross, pairCommissions)
    const p = (def?.percentage ?? 0) / 100
    if (p >= 1) break
    const next = net / (1 - p)
    if (Math.abs(next - gross) < 1e-10) return next
    gross = next
  }
  return gross
}

function rateForPair(
  taxRates: ExchangeRate[],
  from: CurrencyCode,
  to: CurrencyCode
): number {
  const row = taxRates.find((r) => r.from === from && r.to === to)
  return row?.rate ?? 0
}

interface CalculatorState {
  /** Si true, modo demo: URLs con sufijo -trial (coin/tax-rate-trial, coin/currencies-trial, etc.) sin /demo en la ruta. */
  demoMode: boolean
  currencies: CurrencyReadDTO[]
  currencyFrom: CurrencyCode
  currencyTo: CurrencyCode
  amountSend: number
  amountReceive: number
  taxRates: ExchangeRate[]
  commissions: CommissionRange[]
  /** IDs para POST /transactions/ (tasa y comisión usadas en la calculadora). */
  selectedTaxRateId: string | null
  selectedCommissionId: string | null
  isLoading: boolean
  error: string | null
}

const DEFAULT_FROM: CurrencyCode = 'pen'
const DEFAULT_TO: CurrencyCode = 'brl'

/** Si `lockTrial`, siempre API `-trial` (store aislado para calculadora demo en la misma página que producción). */
function buildCalculatorStoreDefinition(lockTrial: boolean) {
  return {
  state: (): CalculatorState => ({
    demoMode: lockTrial,
    currencies: [],
    currencyFrom: DEFAULT_FROM,
    currencyTo: DEFAULT_TO,
    amountSend: 0,
    amountReceive: 0,
    taxRates: [],
    commissions: [],
    selectedTaxRateId: null,
    selectedCommissionId: null,
    isLoading: false,
    error: null
  }),

  getters: {
    destinationOptions(state): CurrencyCode[] {
      return CURRENCY_OPTIONS[state.currencyFrom] ?? []
    },

    /** Tasa de cambio del par actual (desde API tax-rate). */
    currentRate(state): number {
      const pair = getCurrencyPairKey(state.currencyFrom, state.currencyTo)
      const found = state.taxRates.find((r) => r.pair === pair)
      return found?.rate ?? 0
    },

    /** Comisiones del par actual (puede haber varios rangos por par). */
    commissionsForPair(state): CommissionRange[] {
      return state.commissions.filter(
        (c) => c.coin_a === state.currencyFrom && c.coin_b === state.currencyTo
      )
    },

    /** Tramo de comisión según monto bruto (origen), también si el usuario editó “recibe”. */
    currentCommission(state): CommissionRange | null {
      const pairCommissions = this.commissionsForPair
      if (pairCommissions.length === 0) return null

      const rate = rateForPair(state.taxRates, state.currencyFrom, state.currencyTo)
      let gross = 0
      if (state.amountSend > 0) {
        gross = state.amountSend
      } else if (state.amountReceive > 0 && rate > 0) {
        gross = resolveGrossFromReceive(state.amountReceive, rate, pairCommissions)
      } else {
        return pairCommissions[0] ?? null
      }

      return pickCommissionBracket(gross, pairCommissions)
    },

    /** Porcentaje del tramo actual (alineado con `result`). */
    currentCommissionPercentage(): number {
      const c = this.currentCommission
      return c ? c.percentage : 0
    },

    /**
     * Enviás `amountSend` (bruto origen): comisión sobre bruto, convierte el neto a destino.
     * O indicás `amountReceive`: se infiere el bruto con neto = recibe/tasa y bruto = neto/(1-p).
     */
    result(state): CalculatorResult | null {
      const rate = rateForPair(state.taxRates, state.currencyFrom, state.currencyTo)
      if (!rate || rate <= 0) return null
      const pairCommissions = this.commissionsForPair

      if (state.amountSend > 0) {
        const gross = state.amountSend
        const commissionDef = pickCommissionBracket(gross, pairCommissions)
        const p = commissionDef ? commissionDef.percentage / 100 : 0
        const commission = gross * p
        const totalToSend = gross - commission
        const amountReceive = totalToSend * rate
        return {
          amountSend: gross,
          amountReceive,
          rate,
          commission,
          commissionRate: p * 100,
          totalToSend,
          couponDiscount: 0
        }
      }

      if (state.amountReceive > 0) {
        const receive = state.amountReceive
        const gross = resolveGrossFromReceive(receive, rate, pairCommissions)
        const commissionDef = pickCommissionBracket(gross, pairCommissions)
        const p = commissionDef ? commissionDef.percentage / 100 : 0
        const commission = gross * p
        const totalToSend = gross - commission
        return {
          amountSend: gross,
          amountReceive: receive,
          rate,
          commission,
          commissionRate: p * 100,
          totalToSend,
          couponDiscount: 0
        }
      }

      return null
    },

    minAmount(_state): number {
      const pair = this.commissionsForPair
      if (pair.length === 0) return 100
      return Math.min(...pair.map((c) => c.min_amount))
    },

    maxAmount(_state): number {
      const pair = this.commissionsForPair
      if (pair.length === 0) return 50000
      return Math.max(...pair.map((c) => c.max_amount))
    }
  },

  actions: {
    setDemoMode(value: boolean) {
      if (lockTrial) return
      this.demoMode = value
    },

    async loadData() {
      this.isLoading = true
      this.error = null
      try {
        const useTrial = lockTrial || this.demoMode
        const repo = new CalculatorApiAdapter(useTrial)
        const useCase = new LoadCalculatorDataUseCase(repo)
        const data = await useCase.execute()
        this.currencies = data.currencies
        this.taxRates = data.taxRates
        this.commissions = data.commissions
        this.updateSelectedIds()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar datos'
      } finally {
        this.isLoading = false
      }
    },

    /** Actualiza selectedTaxRateId y selectedCommissionId según el par actual. */
    updateSelectedIds() {
      const pair = getCurrencyPairKey(this.currencyFrom, this.currencyTo)
      const rate = this.taxRates.find((r) => r.pair === pair)
      const commission = this.currentCommission
      this.selectedTaxRateId = rate?.id ?? null
      this.selectedCommissionId = commission?.id ?? null
    },

    setCurrencyFrom(code: CurrencyCode) {
      this.currencyFrom = code
      const options = CURRENCY_OPTIONS[code] ?? []
      if (!options.includes(this.currencyTo)) this.currencyTo = options[0] ?? this.currencyTo
      this.updateSelectedIds()
    },

    setCurrencyTo(code: CurrencyCode) {
      this.currencyTo = code
      this.updateSelectedIds()
    },

    setAmountSend(value: number) {
      this.amountSend = value
      this.amountReceive = 0
      const res = this.result
      if (res) this.amountReceive = res.amountReceive
      this.updateSelectedIds()
    },

    setAmountReceive(value: number) {
      this.amountReceive = value
      this.amountSend = 0
      const res = this.result
      if (res) this.amountSend = res.amountSend
      this.updateSelectedIds()
    },

    recalcFromSend() {
      const res = this.result
      if (res && this.amountSend > 0) this.amountReceive = res.amountReceive
      this.updateSelectedIds()
    },

    recalcFromReceive() {
      const res = this.result
      if (res && this.amountReceive > 0) this.amountSend = res.amountSend
      this.updateSelectedIds()
    },

    resetAmounts() {
      this.amountSend = 0
      this.amountReceive = 0
    }
  }
}
}

export const useCalculatorStore = defineStore('calculator', buildCalculatorStoreDefinition(false))

/** Store independiente para la calculadora/tasas trial (misma pantalla que producción sin pisar estado). */
export const useCalculatorDemoStore = defineStore('calculator-demo', buildCalculatorStoreDefinition(true))
