import { defineStore } from 'pinia'
import type { CurrencyCode, ExchangeRate, CommissionRange, Coupon, CalculatorResult } from '../../domain/models'
import type { CurrencyReadDTO } from '../../infrastructure/adapters/CalculatorRepository'
import { getCurrencyPairKey, CURRENCY_OPTIONS } from '../../domain/models'
import { LoadCalculatorDataUseCase } from '../../application/use_cases'
import { CalculatorApiAdapter } from '../../infrastructure/adapters'

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
  coupons: Coupon[]
  /** IDs para POST /transactions/ (tasa y comisión usadas en la calculadora). */
  selectedTaxRateId: string | null
  selectedCommissionId: string | null
  isLoading: boolean
  error: string | null
}

const DEFAULT_FROM: CurrencyCode = 'pen'
const DEFAULT_TO: CurrencyCode = 'brl'

export const useCalculatorStore = defineStore('calculator', {
  state: (): CalculatorState => ({
    demoMode: false,
    currencies: [],
    currencyFrom: DEFAULT_FROM,
    currencyTo: DEFAULT_TO,
    amountSend: 0,
    amountReceive: 0,
    taxRates: [],
    commissions: [],
    coupons: [],
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

    /** Comisión cuyo rango contiene el monto actual (o null si no hay match). */
    currentCommission(state): CommissionRange | null {
      const pairCommissions = this.commissionsForPair
      const amount = state.amountSend || state.amountReceive
      if (amount <= 0) return pairCommissions[0] ?? null
      const match = pairCommissions.find(
        (c) => amount >= c.min_amount && amount <= c.max_amount
      )
      return match ?? pairCommissions[pairCommissions.length - 1] ?? null
    },

    /** Porcentaje de comisión aplicable al monto (respeta min_amount/max_amount). */
    currentCommissionPercentage(state): number {
      const c = this.currentCommission
      if (!c) return 0
      const amount = state.amountSend || state.amountReceive
      if (amount <= 0) return 0
      if (amount < c.min_amount || amount > c.max_amount) return 0
      return c.percentage
    },

    /** Resultado calculado: destination = (origin - commission) * tax. */
    result(state): CalculatorResult | null {
      const rate = state.taxRates.find(
        (r) => r.from === state.currencyFrom && r.to === state.currencyTo
      )?.rate
      if (!rate || rate <= 0) return null
      const pairCommissions = this.commissionsForPair
      const amount =
        state.amountSend > 0 ? state.amountSend : state.amountReceive > 0 ? state.amountReceive / rate : 0
      if (amount <= 0) return null
      const commissionDef = pairCommissions.find(
        (c) => amount >= c.min_amount && amount <= c.max_amount
      ) ?? pairCommissions[pairCommissions.length - 1]
      const commissionRate = commissionDef ? commissionDef.percentage / 100 : 0
      const commission = amount * commissionRate
      const totalToSend = amount - commission
      const amountReceive = totalToSend * rate
      const couponDiscount = 0
      return {
        amountSend: amount,
        amountReceive,
        rate,
        commission,
        commissionRate: commissionRate * 100,
        totalToSend,
        couponDiscount
      }
    },

    minAmount(state): number {
      const pair = this.commissionsForPair
      if (pair.length === 0) return 100
      return Math.min(...pair.map((c) => c.min_amount))
    },

    maxAmount(state): number {
      const pair = this.commissionsForPair
      if (pair.length === 0) return 50000
      return Math.max(...pair.map((c) => c.max_amount))
    }
  },

  actions: {
    setDemoMode(value: boolean) {
      this.demoMode = value
    },

    async loadData() {
      this.isLoading = true
      this.error = null
      try {
        const repo = new CalculatorApiAdapter(this.demoMode)
        const useCase = new LoadCalculatorDataUseCase(repo)
        const data = await useCase.execute()
        this.currencies = data.currencies
        this.taxRates = data.taxRates
        this.commissions = data.commissions
        this.coupons = data.coupons
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
})
