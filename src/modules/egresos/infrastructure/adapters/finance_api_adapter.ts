import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import {
  FX_CURRENCIES,
  type Expense,
  type ExpenseCategory,
  type ExpenseInput,
  type ExpenseList,
  type FxCurrency,
  type FxMonthRate,
  type FxRateInput
} from '../../domain/models'

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

function endpoint(path: string): string {
  return Domain.apiPath(`finance/${path}`)
}

export function fxRateFromApi(raw: unknown): FxMonthRate | null {
  const o = record(raw)
  const currency = str(o.currency).toUpperCase() as FxCurrency
  if (!FX_CURRENCIES.includes(currency)) return null
  return {
    id: str(o.id),
    year: Math.round(num(o.year)),
    month: Math.round(num(o.month)),
    currency,
    rateToPen: num(o.rate_to_pen)
  }
}

export function categoryFromApi(raw: unknown): ExpenseCategory {
  const o = record(raw)
  return { id: str(o.id), name: str(o.name), position: Math.round(num(o.position)) }
}

export function expenseFromApi(raw: unknown): Expense {
  const o = record(raw)
  return {
    id: str(o.id),
    expenseDate: str(o.expense_date).slice(0, 10),
    categoryId: str(o.category_id),
    categoryName: str(o.category_name),
    description: o.description == null ? null : str(o.description) || null,
    amountPen: num(o.amount_pen),
    createdBy: o.created_by == null ? null : str(o.created_by)
  }
}

function expenseToApi(input: ExpenseInput): Record<string, unknown> {
  return {
    expense_date: input.expenseDate,
    category_id: input.categoryId,
    description: input.description,
    amount_pen: input.amountPen
  }
}

export class FinanceApiAdapter {
  async getFxRates(year: number): Promise<FxMonthRate[]> {
    const { data } = await apiClient.get(endpoint('fx-rates'), { params: { year } })
    return records(data)
      .map(fxRateFromApi)
      .filter((item): item is FxMonthRate => item !== null)
  }

  async saveFxRates(items: FxRateInput[]): Promise<FxMonthRate[]> {
    const { data } = await apiClient.put(endpoint('fx-rates'), {
      items: items.map((item) => ({
        year: item.year,
        month: item.month,
        currency: item.currency,
        rate_to_pen: item.rateToPen
      }))
    })
    return records(data)
      .map(fxRateFromApi)
      .filter((item): item is FxMonthRate => item !== null)
  }

  async getCategories(): Promise<ExpenseCategory[]> {
    const { data } = await apiClient.get(endpoint('expense-categories'))
    return records(data).map(categoryFromApi)
  }

  async getExpenses(year: number, month: number | null): Promise<ExpenseList> {
    const params: Record<string, number> = { year }
    if (month) params.month = month
    const { data } = await apiClient.get(endpoint('expenses'), { params })
    const o = record(data)
    return { items: records(o.items).map(expenseFromApi), totalPen: num(o.total_pen) }
  }

  async createExpense(input: ExpenseInput): Promise<Expense> {
    const { data } = await apiClient.post(endpoint('expenses'), expenseToApi(input))
    return expenseFromApi(data)
  }

  /** El API espera el `id` en el cuerpo (mismo criterio que etiquetas y comisiones). */
  async updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
    const { data } = await apiClient.put(endpoint('expenses'), { id, ...expenseToApi(input) })
    return expenseFromApi(data)
  }

  async deleteExpense(id: string): Promise<void> {
    await apiClient.delete(endpoint(`expenses/${id}`))
  }
}
