import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  useCalculatorStore,
  useCalculatorDemoStore
} from './use_calculator_store_controller'
import type { ExchangeRate, CommissionRange } from '../../domain/models'

// ─── fixtures ────────────────────────────────────────────────────────────────

const RATE_PEN_BRL: ExchangeRate = {
  id: 'tr-1',
  pair: 'pen-brl',
  rate: 1.438,
  from: 'pen',
  to: 'brl'
}

const COMMISSION_PEN_BRL: CommissionRange = {
  id: 'cm-1',
  coin_a: 'pen',
  coin_b: 'brl',
  percentage: 2,
  reverse: false,
  min_amount: 100,
  max_amount: 50_000
}

function seed(
  store: ReturnType<typeof useCalculatorStore>,
  overrides: Partial<{ taxRates: ExchangeRate[]; commissions: CommissionRange[]; calculationMode: 'normal' | 'special' }> = {}
) {
  store.$patch({
    taxRates: overrides.taxRates ?? [RATE_PEN_BRL],
    commissions: overrides.commissions ?? [COMMISSION_PEN_BRL],
    calculationMode: overrides.calculationMode ?? 'normal',
    lastCoinCatalogWasTrial: false
  })
}

beforeEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})

// ─── tests ───────────────────────────────────────────────────────────────────

describe('effectiveTaxRates getter', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('devuelve taxRates sin cambios cuando no hay overrides', () => {
    const store = useCalculatorStore()
    seed(store)
    expect(store.effectiveTaxRates).toEqual([RATE_PEN_BRL])
  })

  it('aplica el override cuando existe', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'special' })
    store.overrideLocalTaxRate('tr-1', 1.500)
    expect(store.effectiveTaxRates[0]?.rate).toBe(1.500)
  })

  it('NO muta taxRates al setear un override', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'special' })
    store.overrideLocalTaxRate('tr-1', 1.999)
    expect(store.taxRates[0]?.rate).toBe(1.438)   // intacto
    expect(store.effectiveTaxRates[0]?.rate).toBe(1.999)  // override aplicado
  })

  it('guarda el override en localTaxRateOverrides, no en taxRates', () => {
    const store = useCalculatorStore()
    seed(store)
    store.overrideLocalTaxRate('tr-1', 1.700)
    expect(store.localTaxRateOverrides['tr-1']).toBe(1.700)
    expect(store.taxRates[0]?.rate).toBe(1.438)
  })
})

describe('result.rate usa effectiveTaxRates', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('modo normal sin override: result.rate = tasa del backend', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'normal' })
    store.setAmountSend(1000)
    expect(store.result?.rate).toBe(1.438)
  })

  it('modo especial con override: result.rate = tasa overrideada', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'special' })
    store.overrideLocalTaxRate('tr-1', 1.600)
    store.setAmountSend(1000)
    expect(store.result?.rate).toBe(1.600)
  })

  it('modo normal ignora overrides especiales guardados', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'normal' })

    store.overrideLocalTaxRate('tr-1', 1.999)
    store.setAmountSend(1000)

    expect(store.result?.rate).toBe(1.438)
  })
})

describe('setCalculationMode conserva overrides especiales sin afectar normal', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('al cambiar a modo normal conserva localTaxRateOverrides', async () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'special' })

    // Mock loadData para no llamar al backend
    vi.spyOn(store, 'loadData').mockResolvedValue(undefined)

    store.overrideLocalTaxRate('tr-1', 1.800)
    expect(store.localTaxRateOverrides['tr-1']).toBe(1.800)

    await store.setCalculationMode('normal')

    expect(store.localTaxRateOverrides['tr-1']).toBe(1.800)
  })

  it('al volver a normal, result.rate usa taxRates original (no el override)', async () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'special' })
    vi.spyOn(store, 'loadData').mockResolvedValue(undefined)

    store.overrideLocalTaxRate('tr-1', 1.999)
    store.setAmountSend(1000)
    expect(store.result?.rate).toBe(1.999)  // en especial: usa override

    await store.setCalculationMode('normal')
    store.setAmountSend(1000)
    expect(store.localTaxRateOverrides['tr-1']).toBe(1.999)
    expect(store.result?.rate).toBe(1.438)  // en normal: tasa original
  })

  it('cambiar a especial NO limpia overrides', async () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'normal' })
    vi.spyOn(store, 'loadData').mockResolvedValue(undefined)

    store.overrideLocalTaxRate('tr-1', 1.550)
    await store.setCalculationMode('special')

    expect(store.localTaxRateOverrides['tr-1']).toBe(1.550)
  })

  it('cambiar a especial mantiene el catálogo real en el store principal', async () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'normal' })
    vi.spyOn(store, 'loadData').mockResolvedValue(undefined)

    await store.setCalculationMode('special')

    expect(store.demoMode).toBe(false)
  })
})

describe('calculadora especial con descuento negativo', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('permite guardar el descuento especial como monto negativo', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'special' })

    store.$patch({
      amountSendSpecial: 1000,
      amountReceiveSpecial: 1300,
      specialReceiveManuallyEdited: true,
      inputMode: 'send'
    })

    expect(store.result?.specialDiscountValid).toBe(true)
    expect(store.result?.specialDiscountAmount).toBeLessThan(0)
    expect(store.result?.specialDiscountPercentage).toBeLessThan(0)
    expect(store.result?.specialDiscountInvalidReason).toBeNull()
  })

  it('mantiene bloqueado el descuento mayor al 100%', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'special' })

    store.$patch({
      amountSendSpecial: 1000,
      amountReceiveSpecial: 2000,
      specialReceiveManuallyEdited: true,
      inputMode: 'send'
    })

    expect(store.result?.specialDiscountValid).toBe(false)
    expect(store.result?.specialDiscountInvalidReason).toBe(
      'El monto a enviar es insuficiente para sostener el monto a recibir aun con 100% de descuento.'
    )
  })
})

describe('aislamiento entre useCalculatorStore y useCalculatorDemoStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('los dos stores son instancias independientes', () => {
    const main = useCalculatorStore()
    const demo = useCalculatorDemoStore()
    expect(main.$id).toBe('calculator')
    expect(demo.$id).toBe('calculator-demo')
  })

  it('override en demo store NO afecta al main store', () => {
    const main = useCalculatorStore()
    const demo = useCalculatorDemoStore()

    seed(main, { taxRates: [{ ...RATE_PEN_BRL, id: 'tr-main', rate: 1.438 }] })
    seed(demo, { taxRates: [{ ...RATE_PEN_BRL, id: 'tr-demo', rate: 1.500 }] })

    demo.overrideLocalTaxRate('tr-demo', 1.700)

    expect(main.taxRates[0]?.rate).toBe(1.438)
    expect(main.effectiveTaxRates[0]?.rate).toBe(1.438)
    expect(main.localTaxRateOverrides).toEqual({})
  })

  it('override en main store NO afecta al demo store', () => {
    const main = useCalculatorStore()
    const demo = useCalculatorDemoStore()

    seed(main, { taxRates: [{ ...RATE_PEN_BRL, id: 'tr-1', rate: 1.438 }] })
    seed(demo, { taxRates: [{ ...RATE_PEN_BRL, id: 'tr-1', rate: 1.500 }] })

    main.overrideLocalTaxRate('tr-1', 1.999)

    expect(demo.taxRates[0]?.rate).toBe(1.500)
    expect(demo.effectiveTaxRates[0]?.rate).toBe(1.500)
    expect(demo.localTaxRateOverrides).toEqual({})
  })

  it('override en demo store se aplica en demo effectiveTaxRates', () => {
    const demo = useCalculatorDemoStore()
    seed(demo, { taxRates: [{ ...RATE_PEN_BRL, id: 'tr-demo', rate: 1.500 }] })

    demo.overrideLocalTaxRate('tr-demo', 1.750)

    expect(demo.effectiveTaxRates[0]?.rate).toBe(1.750)
    expect(demo.taxRates[0]?.rate).toBe(1.500)  // taxRates intacto
  })

  it('múltiples overrides: solo el id correcto es sobreescrito', () => {
    const store = useCalculatorStore()
    const rate2: ExchangeRate = { id: 'tr-2', pair: 'pen-usd', rate: 0.27, from: 'pen', to: 'usd' }
    store.$patch({ taxRates: [RATE_PEN_BRL, rate2], calculationMode: 'special' })

    store.overrideLocalTaxRate('tr-1', 1.600)

    expect(store.effectiveTaxRates.find(r => r.id === 'tr-1')?.rate).toBe(1.600)
    expect(store.effectiveTaxRates.find(r => r.id === 'tr-2')?.rate).toBe(0.27)  // no afectado
  })
})

describe('editRateLock: tasa histórica de la transacción en edición', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('fuerza la tasa guardada en modo normal (no la del catálogo)', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'normal' })  // catálogo: 1.438

    store.setEditRateLock('pen', 'brl', 1.497)
    store.setAmountSend(1000)

    expect(store.result?.rate).toBe(1.497)
    expect(store.currentRate).toBe(1.497)
  })

  it('NO muta taxRates al aplicar el bloqueo', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'normal' })

    store.setEditRateLock('pen', 'brl', 1.497)

    expect(store.taxRates[0]?.rate).toBe(1.438)        // catálogo intacto
    expect(store.effectiveTaxRates[0]?.rate).toBe(1.497)  // bloqueo aplicado
  })

  it('reproduce el monto destino guardado en vez de recalcular con el catálogo vivo', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'normal' })  // catálogo 1.438 daría un destino distinto

    store.setEditRateLock('pen', 'brl', 1.497)
    store.setAmountSend(291)

    // 291 - 2% = 285.18 neto → 285.18 * 1.497 ≈ 426.9 (con la tasa histórica, no la del catálogo)
    const net = 291 - 291 * 0.02
    expect(store.result?.amountReceive).toBeCloseTo(net * 1.497, 4)
  })

  it('aplica la inversa cuando el catálogo solo tiene el sentido contrario', () => {
    const store = useCalculatorStore()
    store.$patch({
      taxRates: [{ id: 'tr-inv', pair: 'brl-pen', rate: 0.66, from: 'brl', to: 'pen' }],
      commissions: [COMMISSION_PEN_BRL],
      calculationMode: 'normal',
      currencyFrom: 'pen',
      currencyTo: 'brl',
      lastCoinCatalogWasTrial: false
    })

    store.setEditRateLock('pen', 'brl', 1.497)
    store.setAmountSend(1000)

    expect(store.result?.rate).toBeCloseTo(1.497, 6)  // pen→brl derivado de la inversa bloqueada
  })

  it('también manda en modo especial', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'special' })

    store.setEditRateLock('pen', 'brl', 1.497)
    store.setAmountSend(1000)

    expect(store.result?.rate).toBe(1.497)
  })

  it('clearEditRateLock vuelve a la tasa del catálogo', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'normal' })

    store.setEditRateLock('pen', 'brl', 1.497)
    store.setAmountSend(1000)
    expect(store.result?.rate).toBe(1.497)

    store.clearEditRateLock()
    store.setAmountSend(1000)
    expect(store.result?.rate).toBe(1.438)
  })

  it('ignora un bloqueo inválido (tasa <= 0)', () => {
    const store = useCalculatorStore()
    seed(store, { calculationMode: 'normal' })

    store.setEditRateLock('pen', 'brl', 0)

    expect(store.editRateLock).toBeNull()
    store.setAmountSend(1000)
    expect(store.result?.rate).toBe(1.438)
  })
})
