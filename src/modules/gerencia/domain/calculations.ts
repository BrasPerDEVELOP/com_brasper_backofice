// Cálculos derivados del panel gerencial. Puros y sin dependencias para poder
// contrastarlos con las fórmulas del Excel de gerencia.
import type { CurrencyCode, ManagementMonth } from './models'
import { CURRENCY_CODES } from './models'

export function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

/**
 * Variación porcentual entre dos valores. `null` cuando no hay base de
 * comparación (mes anterior sin datos), para que el gráfico deje el hueco en
 * vez de pintar un 0 engañoso.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null
  return round1(((current - previous) / previous) * 100)
}

/** Participación (%) de cada parte sobre el total; 0 cuando el total es 0. */
export function shares<K extends string>(parts: Record<K, number>): Record<K, number> {
  const total = (Object.values(parts) as number[]).reduce((acc, value) => acc + value, 0)
  const result = {} as Record<K, number>
  for (const key of Object.keys(parts) as K[]) {
    result[key] = total > 0 ? round1((parts[key] / total) * 100) : 0
  }
  return result
}

/**
 * Tasa de retención de clientes (TRC) del mes, tal como la calcula gerencia:
 * clientes del mes que ya existían (activos − nuevos) sobre los activos del mes
 * anterior. Verificado contra el Excel: julio (588 − 66) / 536 = 97 %.
 */
export function retentionRate(
  month: Pick<ManagementMonth, 'activeClients' | 'newClients'>,
  previous: Pick<ManagementMonth, 'activeClients'> | null
): number | null {
  if (!previous || previous.activeClients === 0) return null
  const retained = Math.max(0, month.activeClients - month.newClients)
  return round1((retained / previous.activeClients) * 100)
}

/**
 * Serie mensual de una métrica con su variación % respecto al mes anterior.
 * `previous` aporta diciembre del año anterior para que enero tenga base.
 */
export function monthlyChanges(
  months: ManagementMonth[],
  previous: ManagementMonth | null,
  pick: (month: ManagementMonth) => number
): Array<number | null> {
  return months.map((month, index) => {
    const prior = index === 0 ? previous : months[index - 1]
    if (!prior) return null
    return percentChange(pick(month), pick(prior))
  })
}

/** Serie de retención por mes (enero usa diciembre del año anterior). */
export function monthlyRetention(
  months: ManagementMonth[],
  previous: ManagementMonth | null
): Array<number | null> {
  return months.map((month, index) =>
    retentionRate(month, index === 0 ? previous : (months[index - 1] ?? null))
  )
}

/** Participación % por moneda de los envíos de cada mes (apilado 100 %). */
export function monthlyCurrencyShares(
  months: ManagementMonth[],
  pick: (month: ManagementMonth) => Record<CurrencyCode, number>
): Record<CurrencyCode, number[]> {
  const result = { PEN: [], BRL: [], USD: [] } as Record<CurrencyCode, number[]>
  for (const month of months) {
    const share = shares(pick(month))
    for (const code of CURRENCY_CODES) result[code].push(share[code])
  }
  return result
}

/** Meses con al menos un envío; evita pintar ceros de meses futuros. */
export function monthsWithData(months: ManagementMonth[]): ManagementMonth[] {
  const last = months.map((m) => m.enviosCount > 0).lastIndexOf(true)
  return last < 0 ? [] : months.slice(0, last + 1)
}
