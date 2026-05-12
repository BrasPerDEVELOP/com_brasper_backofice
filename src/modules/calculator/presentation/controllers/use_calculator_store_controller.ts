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

/**
 * Tasa efectiva `from` → `to` según catálogo coin: fila directa, o inversa (1 / tasa).
 * Así el tipo de cambio acompaña el par elegido aunque el backend solo devuelva un sentido.
 */
function effectiveExchangeRate(
  taxRates: ExchangeRate[],
  from: CurrencyCode,
  to: CurrencyCode
): number {
  const direct = taxRates.find((r) => r.from === from && r.to === to)
  if (direct && direct.rate > 0) return direct.rate
  const inverse = taxRates.find((r) => r.from === to && r.to === from)
  if (inverse && inverse.rate > 0) return 1 / inverse.rate
  return 0
}

function buildNormalResult(
  gross: number,
  rate: number,
  commissionDef: CommissionRange | null,
  amountReceiveOverride?: number
): CalculatorResult {
  const p = commissionDef ? commissionDef.percentage / 100 : 0
  const baseCommission = gross * p
  const totalToSend = gross - baseCommission
  const amountReceive = amountReceiveOverride ?? totalToSend * rate
  return {
    amountSend: gross,
    amountReceive,
    rate,
    commission: baseCommission,
    commissionRate: p * 100,
    totalToSend,
    calculationMode: 'normal',
    baseCommission,
    specialDiscountPercentage: 0,
    specialDiscountAmount: 0,
    finalCommission: baseCommission,
    specialTargetReceive: amountReceive,
    specialDiscountValid: true,
    specialDiscountInvalidReason: null
  }
}

/** Misma fórmula que la calculadora normal; `special` solo indica catálogo/tasa distinta (p. ej. trial). */
function asSpecialCatalogResult(normal: CalculatorResult): CalculatorResult {
  return {
    ...normal,
    calculationMode: 'special',
    specialTargetReceive: normal.amountReceive,
    specialDiscountPercentage: 0,
    specialDiscountAmount: 0,
    finalCommission: normal.commission,
    specialDiscountValid: true,
    specialDiscountInvalidReason: null
  }
}

interface CalculatorState {
  /** Si true, modo demo: URLs con sufijo -trial (coin/tax-rate-trial, coin/currencies-trial, etc.) sin /demo en la ruta. */
  demoMode: boolean
  currencies: CurrencyReadDTO[]
  currencyFrom: CurrencyCode
  currencyTo: CurrencyCode
  calculationMode: 'normal' | 'special'
  inputMode: 'send' | 'receive'
  amountSend: number
  amountReceive: number
  taxRates: ExchangeRate[]
  commissions: CommissionRange[]
  /** IDs para POST /transactions/ (tasa y comisión usadas en la calculadora). */
  selectedTaxRateId: string | null
  selectedCommissionId: string | null
  isLoading: boolean
  error: string | null
  /**
   * Tras la última carga exitosa de tasas/comisiones: si coincidía con API `-trial`.
   * Evita `background: true` con arrays llenos pero de otro modo (p. ej. producción vs trial).
   */
  lastCoinCatalogWasTrial: boolean | null
}

const DEFAULT_FROM: CurrencyCode = 'pen'
const DEFAULT_TO: CurrencyCode = 'brl'

/** Evita peticiones duplicadas si varios componentes llaman `loadData` al mismo tiempo. */
const calculatorLoadDataInflight = new Map<string, Promise<void>>()

export interface LoadCalculatorDataOptions {
  /** Si true y ya hay tasas/comisiones, no muestra el estado de carga (refresco silencioso). */
  background?: boolean
}

/** Si `lockTrial`, siempre API `-trial` (store aislado para calculadora demo en la misma página que producción). */
function buildCalculatorStoreDefinition(lockTrial: boolean) {
  return {
  state: (): CalculatorState => ({
    demoMode: lockTrial,
    currencies: [],
    currencyFrom: DEFAULT_FROM,
    currencyTo: DEFAULT_TO,
    calculationMode: 'normal',
    inputMode: 'send',
    amountSendNormal: 0,
    amountReceiveNormal: 0,
    amountSendSpecial: 0,
    amountReceiveSpecial: 0,
    taxRates: [],
    commissions: [],
    selectedTaxRateId: null,
    selectedCommissionId: null,
    isLoading: false,
    error: null,
    lastCoinCatalogWasTrial: null
  }),

  getters: {
    destinationOptions(state): CurrencyCode[] {
      return CURRENCY_OPTIONS[state.currencyFrom] ?? []
    },

    /** Monto a enviar según el modo activo. */
    amountSend(state): number {
      return state.calculationMode === 'special' ? state.amountSendSpecial : state.amountSendNormal
    },

    /** Monto a recibir según el modo activo. */
    amountReceive(state): number {
      return state.calculationMode === 'special' ? state.amountReceiveSpecial : state.amountReceiveNormal
    },

    /** Tasa de cambio del par actual (directa o derivada del inverso en catálogo). */
    currentRate(state): number {
      return effectiveExchangeRate(state.taxRates, state.currencyFrom, state.currencyTo)
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

      const rate = effectiveExchangeRate(state.taxRates, state.currencyFrom, state.currencyTo)
      let gross = 0
      const isSpecial = state.calculationMode === 'special'
      const send = isSpecial ? state.amountSendSpecial : state.amountSendNormal
      const receive = isSpecial ? state.amountReceiveSpecial : state.amountReceiveNormal

      if (state.inputMode === 'receive' && receive > 0 && rate > 0) {
        gross = resolveGrossFromReceive(receive, rate, pairCommissions)
      } else if (send > 0) {
        gross = send
      } else if (receive > 0 && rate > 0) {
        gross = resolveGrossFromReceive(receive, rate, pairCommissions)
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

    isSpecialMode(state): boolean {
      return state.calculationMode === 'special'
    },

    specialDiscountError(): string | null {
      if (!this.isSpecialMode) return null
      const res = this.result
      if (!res || res.specialDiscountValid) return null
      return res.specialDiscountInvalidReason
    },

    /**
     * Enviás `amountSend` (bruto origen): comisión sobre bruto, convierte el neto a destino.
     * O indicás `amountReceive`: se infiere el bruto con neto = recibe/tasa y bruto = neto/(1-p).
     */
    result(state): CalculatorResult | null {
      const rate = effectiveExchangeRate(state.taxRates, state.currencyFrom, state.currencyTo)
      if (!rate || rate <= 0) return null
      const pairCommissions = this.commissionsForPair

      const isSpecial = state.calculationMode === 'special'
      const send = isSpecial ? state.amountSendSpecial : state.amountSendNormal
      const receive = isSpecial ? state.amountReceiveSpecial : state.amountReceiveNormal

      if (isSpecial) {
        if (state.inputMode === 'receive' && receive > 0) {
          const gross = resolveGrossFromReceive(receive, rate, pairCommissions)
          const commissionDef = pickCommissionBracket(gross, pairCommissions)
          return asSpecialCatalogResult(buildNormalResult(gross, rate, commissionDef, receive))
        }

        if (send > 0) {
          const gross = send
          const commissionDef = pickCommissionBracket(gross, pairCommissions)
          return asSpecialCatalogResult(buildNormalResult(gross, rate, commissionDef))
        }

        if (receive > 0) {
          const gross = resolveGrossFromReceive(receive, rate, pairCommissions)
          const commissionDef = pickCommissionBracket(gross, pairCommissions)
          return asSpecialCatalogResult(buildNormalResult(gross, rate, commissionDef, receive))
        }

        return null
      }

      if (state.inputMode === 'receive' && receive > 0) {
        const gross = resolveGrossFromReceive(receive, rate, pairCommissions)
        const commissionDef = pickCommissionBracket(gross, pairCommissions)
        return buildNormalResult(gross, rate, commissionDef, receive)
      }

      if (send > 0) {
        const gross = send
        const commissionDef = pickCommissionBracket(gross, pairCommissions)
        return buildNormalResult(gross, rate, commissionDef)
      }

      if (receive > 0) {
        const gross = resolveGrossFromReceive(receive, rate, pairCommissions)
        const commissionDef = pickCommissionBracket(gross, pairCommissions)
        return buildNormalResult(gross, rate, commissionDef, receive)
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

    async loadData(options?: LoadCalculatorDataOptions) {
      const storeId = this.$id
      const existing = calculatorLoadDataInflight.get(storeId)
      if (existing) {
        await existing
        return
      }

      const useTrial = lockTrial || this.demoMode
      const catalogMatchesEndpoint =
        this.taxRates.length > 0 &&
        this.commissions.length > 0 &&
        this.lastCoinCatalogWasTrial === useTrial

      const showLoading = !options?.background || !catalogMatchesEndpoint

      const run = (async () => {
        if (showLoading) {
          this.isLoading = true
        }
        this.error = null
        try {
          const repo = new CalculatorApiAdapter(useTrial)
          const useCase = new LoadCalculatorDataUseCase(repo)
          const data = await useCase.execute()
          this.currencies = data.currencies
          this.taxRates = data.taxRates
          this.commissions = data.commissions
          this.lastCoinCatalogWasTrial = useTrial
          this.updateSelectedIds()
        } catch (e) {
          this.error = e instanceof Error ? e.message : 'Error al cargar datos'
        } finally {
          if (showLoading) {
            this.isLoading = false
          }
        }
      })()

      calculatorLoadDataInflight.set(storeId, run)
      try {
        await run
      } finally {
        calculatorLoadDataInflight.delete(storeId)
      }
    },

    /** Actualiza selectedTaxRateId y selectedCommissionId según el par actual. */
    updateSelectedIds() {
      const pair = getCurrencyPairKey(this.currencyFrom, this.currencyTo)
      const invPair = getCurrencyPairKey(this.currencyTo, this.currencyFrom)
      const direct = this.taxRates.find((r) => r.pair === pair)
      const inverse = this.taxRates.find((r) => r.pair === invPair)
      const taxRow =
        direct && direct.rate > 0
          ? direct
          : inverse && inverse.rate > 0
            ? inverse
            : null
      const commission = this.currentCommission
      this.selectedTaxRateId = taxRow?.id ?? null
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

    async setCalculationMode(mode: 'normal' | 'special') {
      if (this.calculationMode === mode) return

      const snap = {
        inputMode: this.inputMode,
        sendN: this.amountSendNormal,
        recN: this.amountReceiveNormal,
        sendS: this.amountSendSpecial,
        recS: this.amountReceiveSpecial
      }

      this.calculationMode = mode

      // Especial: catálogo trial; normal: producción (misma fórmula de comisión/tasa en ambos).
      this.setDemoMode(mode === 'special')

      if (mode === 'special') {
        this.inputMode = snap.inputMode
        this.amountSendSpecial = snap.sendN
        this.amountReceiveSpecial = snap.recN
      } else {
        this.inputMode = snap.inputMode
        this.amountSendNormal = snap.sendS
        this.amountReceiveNormal = snap.recS
      }

      await this.loadData({ background: true })

      if (mode === 'special') {
        if (this.inputMode === 'receive' && this.amountReceiveSpecial > 0) {
          this.recalcFromReceive()
        } else if (this.amountSendSpecial > 0) {
          this.recalcFromSend()
        }
      } else {
        if (this.inputMode === 'receive' && this.amountReceiveNormal > 0) {
          this.recalcFromReceive()
        } else if (this.amountSendNormal > 0) {
          this.recalcFromSend()
        }
      }

      this.updateSelectedIds()
    },

    setAmountSend(value: number) {
      this.inputMode = 'send'
      if (this.calculationMode === 'special') {
        this.amountSendSpecial = value
      } else {
        this.amountSendNormal = value
        this.amountReceiveNormal = 0
        const res = this.result
        if (res) this.amountReceiveNormal = res.amountReceive
      }
      this.updateSelectedIds()
    },

    setAmountReceive(value: number) {
      this.inputMode = 'receive'
      if (this.calculationMode === 'special') {
        this.amountReceiveSpecial = value
      } else {
        this.amountReceiveNormal = value
        this.amountSendNormal = 0
        const res = this.result
        if (res) this.amountSendNormal = res.amountSend
      }
      this.updateSelectedIds()
    },

    recalcFromSend() {
      this.inputMode = 'send'
      const res = this.result
      if (res) {
        if (this.calculationMode === 'special') {
          if (this.amountSendSpecial > 0) this.amountReceiveSpecial = res.amountReceive
        } else {
          if (this.amountSendNormal > 0) this.amountReceiveNormal = res.amountReceive
        }
      }
      this.updateSelectedIds()
    },

    recalcFromReceive() {
      this.inputMode = 'receive'
      const res = this.result
      if (res) {
        if (this.calculationMode === 'special') {
          if (this.amountReceiveSpecial > 0) this.amountSendSpecial = res.amountSend
        } else {
          if (this.amountReceiveNormal > 0) this.amountSendNormal = res.amountSend
        }
      }
      this.updateSelectedIds()
    },

    resetAmounts() {
      this.amountSendNormal = 0
      this.amountReceiveNormal = 0
      this.amountSendSpecial = 0
      this.amountReceiveSpecial = 0
      this.inputMode = 'send'
    },

    resetCalculatorMode() {
      this.calculationMode = 'normal'
    }
  }
}
}

export const useCalculatorStore = defineStore('calculator', buildCalculatorStoreDefinition(false))

/** Store independiente para la calculadora/tasas trial (misma pantalla que producción sin pisar estado). */
export const useCalculatorDemoStore = defineStore('calculator-demo', buildCalculatorStoreDefinition(true))
