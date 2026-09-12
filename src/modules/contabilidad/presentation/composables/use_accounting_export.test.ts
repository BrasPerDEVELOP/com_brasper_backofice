import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as XLSX from 'xlsx'
import { useAccountingExport } from './use_accounting_export'
import { useTransactionsStore } from '@modules/transacciones/presentation/controllers/use_transactions_store_controller'
import { TransactionsApiAdapter } from '@modules/transacciones/infrastructure/adapters'

vi.mock('xlsx', async (importOriginal) => ({
  ...await importOriginal<typeof import('xlsx')>(),
  writeFile: vi.fn()
}))

describe('Excel de contabilidad', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(XLSX.writeFile).mockClear()
    setActivePinia(createPinia())
  })

  it('exporta todas las páginas contables con filtros sin alterar la tabla', async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: String(i), origin_amount: 12.5 }))
    const accounting = vi.spyOn(TransactionsApiAdapter.prototype, 'getAccountingTransactions')
      .mockResolvedValueOnce({ items: first, total: 101 })
      .mockResolvedValueOnce({ items: [{ id: '100', origin_amount: 23.75 }], total: 101 })
    const normal = vi.spyOn(TransactionsApiAdapter.prototype, 'getTransactions')
    const store = useTransactionsStore()
    store.transactions = [{ id: 'visible' }]
    const filters = { status: 'completed', search: 'ABC', user_id: 'client', skip: 20, limit: 10 }
    const action = useAccountingExport(() => ({ filters, filename: 'contabilidad_2026-09-12.xlsx' }), [
      { label: 'Código', value: (t) => t.id },
      { label: 'Monto', value: (t) => t.origin_amount }
    ])
    await action.exportAccountingToExcel()
    expect(accounting).toHaveBeenNthCalledWith(1, { ...filters, skip: 0, limit: 100 })
    expect(accounting).toHaveBeenNthCalledWith(2, { ...filters, skip: 100, limit: 100 })
    expect(normal).not.toHaveBeenCalled()
    expect(store.transactions).toEqual([{ id: 'visible' }])
    const [book, filename] = vi.mocked(XLSX.writeFile).mock.calls[0]!
    expect(filename).toBe('contabilidad_2026-09-12.xlsx')
    const sheet = book.Sheets.Contabilidad!
    expect(sheet['!ref']).toBe('A1:B102')
    expect(sheet.B102).toMatchObject({ t: 'n', v: 23.75 })
    expect(action.exportError.value).toBe('')
    expect(action.isExporting.value).toBe(false)
  })

  it('muestra errores y permite reintentar sin descargar archivos incompletos', async () => {
    const fetch = vi.spyOn(useTransactionsStore(), 'fetchAllForExport').mockRejectedValueOnce(new Error('Error de red'))
    const action = useAccountingExport(() => ({ filters: {}, filename: 'contabilidad.xlsx' }), [])
    await action.exportAccountingToExcel()
    expect(action.exportError.value).toBe('Error de red')
    expect(action.isExporting.value).toBe(false)
    expect(XLSX.writeFile).not.toHaveBeenCalled()
    fetch.mockResolvedValueOnce([])
    await action.exportAccountingToExcel()
    expect(action.exportError.value).toBe('')
    expect(XLSX.writeFile).toHaveBeenCalledOnce()
  })
})
