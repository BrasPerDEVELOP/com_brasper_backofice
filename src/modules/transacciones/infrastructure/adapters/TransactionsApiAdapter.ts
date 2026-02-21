import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { TransactionsRepository } from './TransactionsRepository'
import type { Transaction } from '../../domain/models'

function parseTransaction(item: unknown): Transaction {
  if (item == null || typeof item !== 'object') return {}
  const o = item as Record<string, unknown>
  return { ...o } as Transaction
}

function parseTransactions(data: unknown): Transaction[] {
  if (!Array.isArray(data)) return []
  return data.map(parseTransaction)
}

export class TransactionsApiAdapter implements TransactionsRepository {
  private base(): string {
    return Domain.http('transactions')
  }

  async getTransactions(): Promise<Transaction[]> {
    const url = `${this.base()}/`
    const response = await apiClient.get<unknown>(url)
    return parseTransactions(response.data ?? [])
  }

  async importFromExcel(file: File): Promise<unknown> {
    const url = `${this.base()}/import-excel`
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  }
}
