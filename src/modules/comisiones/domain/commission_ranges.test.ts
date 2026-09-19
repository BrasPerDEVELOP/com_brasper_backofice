import { describe, expect, it } from 'vitest'
import {
  findRangeForAmount,
  formatRangeBounds,
  rangeContains,
  sortRanges,
  suggestNextRange,
  validateRanges,
  type RangeLike
} from './commission_ranges'

/** Los ocho tramos del seed de contabilidad PEN → BRL, en desorden. */
const SEED: RangeLike[] = [
  { id: 'r5', min_amount: 3000, max_amount: 4999 },
  { id: 'r1', min_amount: 100, max_amount: 299 },
  { id: 'r8', min_amount: 10000, max_amount: null },
  { id: 'r3', min_amount: 1000, max_amount: 1999 },
  { id: 'r2', min_amount: 300, max_amount: 999 },
  { id: 'r7', min_amount: 7000, max_amount: 9999 },
  { id: 'r4', min_amount: 2000, max_amount: 2999 },
  { id: 'r6', min_amount: 5000, max_amount: 6999 }
]

describe('sortRanges', () => {
  it('ordena por mínimo y deja el tramo abierto al final', () => {
    expect(sortRanges(SEED).map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'])
  })

  it('no muta el arreglo original', () => {
    const copy = [...SEED]
    sortRanges(SEED)
    expect(SEED).toEqual(copy)
  })
})

describe('rangeContains', () => {
  it('es inclusivo por ambos lados', () => {
    const r = { id: 'x', min_amount: 100, max_amount: 299 }
    expect(rangeContains(r, 100)).toBe(true)
    expect(rangeContains(r, 299)).toBe(true)
    expect(rangeContains(r, 99.99)).toBe(false)
    expect(rangeContains(r, 299.01)).toBe(false)
  })

  it('trata max null como sin límite', () => {
    const open = { id: 'x', min_amount: 10000, max_amount: null }
    expect(rangeContains(open, 10000)).toBe(true)
    expect(rangeContains(open, 1_000_000_000)).toBe(true)
    expect(rangeContains(open, 9999)).toBe(false)
  })
})

describe('findRangeForAmount', () => {
  it('devuelve null sin tramos', () => {
    expect(findRangeForAmount([], 500)).toBeNull()
  })

  it('elige el tramo que contiene el monto', () => {
    expect(findRangeForAmount(SEED, 2500)?.id).toBe('r4')
  })

  it('un monto grande cae en el tramo abierto, no en el último finito', () => {
    expect(findRangeForAmount(SEED, 250_000)?.id).toBe('r8')
  })

  it('por debajo del mínimo global cae al primer tramo', () => {
    expect(findRangeForAmount(SEED, 20)?.id).toBe('r1')
  })

  it('en un hueco decimal cae al tramo superior', () => {
    expect(findRangeForAmount(SEED, 299.5)?.id).toBe('r8')
  })

  it('sin tramo abierto, por encima del máximo cae al último', () => {
    const closed = SEED.filter((r) => r.max_amount != null)
    expect(findRangeForAmount(closed, 50_000)?.id).toBe('r7')
  })
})

describe('validateRanges', () => {
  it('acepta la escalera del seed sin errores ni advertencias', () => {
    const result = validateRanges(SEED)
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('acepta una lista vacía y un único tramo', () => {
    expect(validateRanges([]).isValid).toBe(true)
    expect(validateRanges([{ id: 'a', min_amount: 0, max_amount: null }]).isValid).toBe(true)
  })

  it('detecta solape entre dos tramos', () => {
    const result = validateRanges([
      { id: 'a', min_amount: 100, max_amount: 500 },
      { id: 'b', min_amount: 400, max_amount: 999 }
    ])
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ code: 'overlap', rangeIds: ['a', 'b'] })
  })

  it('un tramo con el mismo mínimo que el máximo anterior es solape', () => {
    const result = validateRanges([
      { id: 'a', min_amount: 100, max_amount: 300 },
      { id: 'b', min_amount: 300, max_amount: 999 }
    ])
    expect(result.errors.map((e) => e.code)).toEqual(['overlap'])
  })

  it('advierte huecos mayores a una unidad, sin bloquear', () => {
    const result = validateRanges([
      { id: 'a', min_amount: 100, max_amount: 299 },
      { id: 'b', min_amount: 500, max_amount: 999 }
    ])
    expect(result.isValid).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatchObject({ code: 'gap', rangeIds: ['a', 'b'] })
  })

  it('rechaza más de un tramo abierto', () => {
    const result = validateRanges([
      { id: 'a', min_amount: 100, max_amount: null },
      { id: 'b', min_amount: 5000, max_amount: null }
    ])
    expect(result.errors.map((e) => e.code)).toContain('multiple_open')
    expect(result.errors.map((e) => e.code)).toContain('open_not_last')
  })

  it('rechaza un tramo abierto que no sea el último', () => {
    const result = validateRanges([
      { id: 'a', min_amount: 100, max_amount: null },
      { id: 'b', min_amount: 5000, max_amount: 9999 }
    ])
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toMatchObject({ code: 'open_not_last', rangeIds: ['a', 'b'] })
  })

  it('rechaza máximo menor o igual al mínimo', () => {
    const result = validateRanges([{ id: 'a', min_amount: 500, max_amount: 500 }])
    expect(result.errors[0]).toMatchObject({ code: 'invalid_bounds', rangeIds: ['a'] })
  })

  it('rechaza mínimo negativo o no numérico', () => {
    expect(validateRanges([{ id: 'a', min_amount: -1, max_amount: 10 }]).isValid).toBe(false)
    expect(validateRanges([{ id: 'a', min_amount: Number.NaN, max_amount: 10 }]).isValid).toBe(false)
  })
})

describe('suggestNextRange', () => {
  it('sin tramos propone 0 abierto', () => {
    expect(suggestNextRange([])).toEqual({ min_amount: 0, max_amount: null })
  })

  it('continúa desde el último tramo finito y queda abierto', () => {
    const closed = SEED.filter((r) => r.max_amount != null)
    expect(suggestNextRange(closed)).toEqual({ min_amount: 10000, max_amount: null })
  })

  it('si ya hay un tramo abierto propone por encima de su mínimo', () => {
    expect(suggestNextRange(SEED)).toEqual({ min_amount: 10001, max_amount: null })
  })
})

describe('formatRangeBounds', () => {
  it('muestra "a más" cuando no hay límite', () => {
    expect(formatRangeBounds({ id: 'x', min_amount: 10000, max_amount: null }, 'en-US')).toBe('10,000 a más')
  })

  it('muestra ambos límites cuando es finito', () => {
    expect(formatRangeBounds({ id: 'x', min_amount: 100, max_amount: 299 }, 'en-US')).toBe('100 – 299')
  })
})
