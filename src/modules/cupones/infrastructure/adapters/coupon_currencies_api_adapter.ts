import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'

export interface CouponCurrencyOption {
  value: string
  label: string
}

export async function getCouponCurrencyOptions(): Promise<CouponCurrencyOption[]> {
  const url = Domain.http('coin/currencies')
  const response = await apiClient.get<unknown>(url).catch(() => ({ data: [] }))
  if (!Array.isArray(response.data)) return []

  return response.data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => {
      const code = String(item.code ?? '').toUpperCase()
      const name = String(item.name ?? '').trim()
      return {
        value: code,
        label: name ? `${code} - ${name}` : code
      }
    })
    .filter((item) => item.value)
}
