import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/interface/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))
vi.mock('@/interface/infrastructure/services', () => ({
  Domain: { apiPath: (path: string) => path.replace(/^\/+|\/+$/g, '') }
}))

import { apiClient } from '@/interface/api/client'
import { FinanceApiAdapter } from './finance_api_adapter'

describe('FinanceApiAdapter', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.put).mockReset()
    vi.mocked(apiClient.post).mockReset()
  })

  it('serializa las tasas en snake_case y descarta monedas desconocidas', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      data: [
        { id: 'r1', year: 2026, month: 7, currency: 'BRL', rate_to_pen: '0.7' },
        { id: 'r2', year: 2026, month: 7, currency: 'PEN', rate_to_pen: 1 }
      ]
    })
    const result = await new FinanceApiAdapter().saveFxRates([
      { year: 2026, month: 7, currency: 'BRL', rateToPen: 0.7 }
    ])
    expect(vi.mocked(apiClient.put)).toHaveBeenCalledWith('finance/fx-rates', {
      items: [{ year: 2026, month: 7, currency: 'BRL', rate_to_pen: 0.7 }]
    })
    expect(result).toEqual([{ id: 'r1', year: 2026, month: 7, currency: 'BRL', rateToPen: 0.7 }])
  })

  it('normaliza el listado de egresos y su total', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        items: [
          {
            id: 'e1',
            expense_date: '2026-07-03',
            category_id: 'c1',
            category_name: 'Planilla',
            description: null,
            amount_pen: '1500.50',
            created_by: 'ana@brasper.com'
          }
        ],
        total_pen: 1500.5
      }
    })
    const result = await new FinanceApiAdapter().getExpenses(2026, 7)
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('finance/expenses', {
      params: { year: 2026, month: 7 }
    })
    expect(result.totalPen).toBe(1500.5)
    expect(result.items[0]).toEqual({
      id: 'e1',
      expenseDate: '2026-07-03',
      categoryId: 'c1',
      categoryName: 'Planilla',
      description: null,
      amountPen: 1500.5,
      createdBy: 'ana@brasper.com'
    })
  })

  it('manda el id en el cuerpo al editar', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 'e1' } })
    await new FinanceApiAdapter().updateExpense('e1', {
      expenseDate: '2026-07-03',
      categoryId: 'c1',
      description: 'Sueldos',
      amountPen: 10
    })
    expect(vi.mocked(apiClient.put)).toHaveBeenCalledWith('finance/expenses', {
      id: 'e1',
      expense_date: '2026-07-03',
      category_id: 'c1',
      description: 'Sueldos',
      amount_pen: 10
    })
  })
})
