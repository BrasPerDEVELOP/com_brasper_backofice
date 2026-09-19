/**
 * Lógica pura de tramos (rangos de monto) de comisión. Sin dependencias de
 * store ni de API: ordenar, elegir el tramo de un monto, validar la escalera
 * de un par y proponer el siguiente tramo al crear uno nuevo.
 *
 * Convenciones (las mismas que el API de venta, `transaction_use_cases.py`):
 * - `max_amount === null` ⇒ tramo abierto, "a más", sin límite superior.
 * - La coincidencia es inclusiva por ambos lados: `min <= monto <= max`.
 * - Dos tramos son contiguos si `siguiente.min - anterior.max <= 1`. Los
 *   datos históricos vienen como escalera de enteros (100–299, 300–999), así
 *   que la unidad de separación no se considera hueco.
 */

/** Mínimo común entre `Commission` (comisiones) y `CommissionRange` (calculadora). */
export interface RangeLike {
  id: string
  min_amount: number
  max_amount: number | null
}

export type RangeIssueCode =
  | 'invalid_bounds'
  | 'overlap'
  | 'gap'
  | 'multiple_open'
  | 'open_not_last'

export interface RangeIssue {
  code: RangeIssueCode
  /** Ids de los tramos involucrados (uno o dos). */
  rangeIds: string[]
  message: string
}

export interface RangeValidation {
  /** Bloquean el guardado. */
  errors: RangeIssue[]
  /** Se muestran, pero no bloquean: un hueco puede ser intencional. */
  warnings: RangeIssue[]
  isValid: boolean
}

/** Máximo separación entre tramos para seguir considerándolos contiguos. */
const CONTIGUITY_TOLERANCE = 1

function upper(range: RangeLike): number {
  return range.max_amount ?? Number.POSITIVE_INFINITY
}

/** Ordena por mínimo ascendente; a igual mínimo, el tramo abierto va último. */
export function sortRanges<T extends RangeLike>(ranges: readonly T[]): T[] {
  return [...ranges].sort((a, b) => a.min_amount - b.min_amount || upper(a) - upper(b))
}

/** `true` si el monto cae dentro del tramo (inclusivo, `null` = sin tope). */
export function rangeContains(range: RangeLike, amount: number): boolean {
  return amount >= range.min_amount && amount <= upper(range)
}

/**
 * Tramo que aplica a un monto. Si ninguno lo contiene, cae al primero cuando
 * el monto está por debajo del mínimo global, y al último en cualquier otro
 * caso (hueco intermedio o por encima del máximo finito).
 */
export function findRangeForAmount<T extends RangeLike>(
  ranges: readonly T[],
  amount: number
): T | null {
  if (ranges.length === 0) return null
  const sorted = sortRanges(ranges)
  const match = sorted.find((r) => rangeContains(r, amount))
  if (match) return match
  if (amount < sorted[0]!.min_amount) return sorted[0]!
  return sorted[sorted.length - 1]!
}

/** Formatea un tramo para mensajes: `100 – 299` o `10 000 a más`. */
export function formatRangeBounds(range: RangeLike, locale = 'es-PE'): string {
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const min = fmt.format(range.min_amount)
  return range.max_amount == null ? `${min} a más` : `${min} – ${fmt.format(range.max_amount)}`
}

/**
 * Valida la escalera completa de un par. Recibe todos los tramos de ese par
 * (incluido el que se está editando o creando, ya con sus valores nuevos).
 */
export function validateRanges(ranges: readonly RangeLike[]): RangeValidation {
  const errors: RangeIssue[] = []
  const warnings: RangeIssue[] = []

  for (const r of ranges) {
    if (!Number.isFinite(r.min_amount) || r.min_amount < 0) {
      errors.push({
        code: 'invalid_bounds',
        rangeIds: [r.id],
        message: `El mínimo del tramo ${formatRangeBounds(r)} no es válido.`
      })
      continue
    }
    if (r.max_amount != null && (!Number.isFinite(r.max_amount) || r.max_amount <= r.min_amount)) {
      errors.push({
        code: 'invalid_bounds',
        rangeIds: [r.id],
        message: `El máximo del tramo ${formatRangeBounds(r)} debe ser mayor que el mínimo.`
      })
    }
  }

  const open = ranges.filter((r) => r.max_amount == null)
  if (open.length > 1) {
    errors.push({
      code: 'multiple_open',
      rangeIds: open.map((r) => r.id),
      message: 'Solo puede haber un tramo sin límite superior por par.'
    })
  }

  const sorted = sortRanges(ranges)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const curr = sorted[i]!

    if (prev.max_amount == null) {
      errors.push({
        code: 'open_not_last',
        rangeIds: [prev.id, curr.id],
        message: `El tramo ${formatRangeBounds(prev)} no tiene límite y deja fuera al tramo ${formatRangeBounds(curr)}.`
      })
      continue
    }

    if (curr.min_amount <= prev.max_amount) {
      errors.push({
        code: 'overlap',
        rangeIds: [prev.id, curr.id],
        message: `Los tramos ${formatRangeBounds(prev)} y ${formatRangeBounds(curr)} se solapan.`
      })
      continue
    }

    if (curr.min_amount - prev.max_amount > CONTIGUITY_TOLERANCE) {
      warnings.push({
        code: 'gap',
        rangeIds: [prev.id, curr.id],
        message: `Hay un hueco entre ${formatRangeBounds(prev)} y ${formatRangeBounds(curr)}: los montos intermedios caerán en el tramo superior.`
      })
    }
  }

  return { errors, warnings, isValid: errors.length === 0 }
}

export interface SuggestedRange {
  min_amount: number
  max_amount: number | null
}

/**
 * Propone el siguiente tramo para prellenar el formulario de creación:
 * arranca donde termina el tramo finito más alto y queda abierto. Si el par
 * ya tiene un tramo abierto, propone un tramo por encima de su mínimo para
 * que el operador lo acote; si no hay tramos, empieza en 0 abierto.
 */
export function suggestNextRange(ranges: readonly RangeLike[]): SuggestedRange {
  if (ranges.length === 0) return { min_amount: 0, max_amount: null }
  const sorted = sortRanges(ranges)
  const last = sorted[sorted.length - 1]!
  if (last.max_amount == null) {
    return { min_amount: last.min_amount + 1, max_amount: null }
  }
  return { min_amount: last.max_amount + 1, max_amount: null }
}
