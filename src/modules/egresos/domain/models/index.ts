// Modelos del módulo Egresos: tasas mensuales a soles y gastos de la empresa.
// Contrato: /finance/* (snake_case) → camelCase aquí.

export type FxCurrency = 'BRL' | 'USD'
export const FX_CURRENCIES: readonly FxCurrency[] = ['BRL', 'USD']
export const FX_CURRENCY_LABELS: Record<FxCurrency, string> = {
  BRL: 'Reales (R$ → S/)',
  USD: 'Dólares ($ → S/)'
}

export interface FxMonthRate {
  id: string
  year: number
  month: number
  currency: FxCurrency
  rateToPen: number
}

export interface FxRateInput {
  year: number
  month: number
  currency: FxCurrency
  rateToPen: number
}

export interface ExpenseCategory {
  id: string
  name: string
  position: number
}

export interface Expense {
  id: string
  /** YYYY-MM-DD */
  expenseDate: string
  categoryId: string
  categoryName: string
  description: string | null
  amountPen: number
  createdBy: string | null
}

export interface ExpenseInput {
  expenseDate: string
  categoryId: string
  description: string | null
  amountPen: number
}

export interface ExpenseList {
  items: Expense[]
  totalPen: number
}

export const MONTH_LABELS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
] as const

export function todayIsoDate(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
