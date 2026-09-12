import { ref } from 'vue'
import type { Transaction } from '@modules/transacciones/domain/models'
import type { GetTransactionsParams } from '@modules/transacciones/infrastructure/adapters/transactions_repository'
import { useTransactionsStore } from '@modules/transacciones/presentation/controllers/use_transactions_store_controller'

export interface AccountingExportColumn {
  label: string
  value: (transaction: Transaction) => string | number | null | undefined
}

export function useAccountingExport(
  snapshot: () => { filters: GetTransactionsParams; filename: string },
  columns: AccountingExportColumn[]
) {
  const store = useTransactionsStore()
  const isExporting = ref(false)
  const exportError = ref('')

  async function exportAccountingToExcel() {
    if (isExporting.value) return
    const { filters, filename } = snapshot()
    isExporting.value = true
    exportError.value = ''
    try {
      const transactions = await store.fetchAllForExport(filters, { accounting: true })
      const XLSX = await import('xlsx')
      const sheet = XLSX.utils.aoa_to_sheet([
        columns.map((column) => column.label),
        ...transactions.map((transaction) => columns.map((column) => column.value(transaction) ?? ''))
      ])
      sheet['!cols'] = columns.map(() => ({ wch: 22 }))
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, 'Contabilidad')
      XLSX.writeFile(book, filename)
    } catch (error) {
      exportError.value = error instanceof Error ? error.message : 'No se pudo generar el Excel'
    } finally {
      isExporting.value = false
    }
  }

  return { isExporting, exportError, exportAccountingToExcel }
}
