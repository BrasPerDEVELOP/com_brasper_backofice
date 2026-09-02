import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parseAccountingCommissionSettings,
  toAccountingCommissionSettingsPayload,
  AccountingCommissionSettingsApiAdapter
} from './accounting_commission_settings_api_adapter'

vi.mock('@/interface/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn()
  }
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: {
    apiPath: (path: string) => path
  }
}))

import { apiClient } from '@/interface/api/client'

describe('parseAccountingCommissionSettings', () => {
  it('lee snake_case y camelCase', () => {
    expect(
      parseAccountingCommissionSettings({
        amount_threshold: 150,
        fixed_commission: 7
      })
    ).toEqual({ amountThreshold: 150, fixedCommission: 7 })

    expect(
      parseAccountingCommissionSettings({
        amountThreshold: 80,
        fixedCommission: 2.5
      })
    ).toEqual({ amountThreshold: 80, fixedCommission: 2.5 })
  })
})

describe('toAccountingCommissionSettingsPayload', () => {
  it('serializa al body que espera el PUT', () => {
    expect(
      toAccountingCommissionSettingsPayload({
        amountThreshold: 100,
        fixedCommission: 3
      })
    ).toEqual({ amount_threshold: 100, fixed_commission: 3 })
  })
})

describe('AccountingCommissionSettingsApiAdapter', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.put).mockReset()
  })

  it('hace GET y PUT a coin/commission-accounting/settings', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { amount_threshold: 100, fixed_commission: 3 }
    })
    vi.mocked(apiClient.put).mockResolvedValue({
      data: { amount_threshold: 120, fixed_commission: 5 }
    })

    const adapter = new AccountingCommissionSettingsApiAdapter()
    await expect(adapter.getSettings()).resolves.toEqual({
      amountThreshold: 100,
      fixedCommission: 3
    })
    await expect(
      adapter.saveSettings({ amountThreshold: 120, fixedCommission: 5 })
    ).resolves.toEqual({ amountThreshold: 120, fixedCommission: 5 })

    expect(apiClient.get).toHaveBeenCalledWith('coin/commission-accounting/settings')
    expect(apiClient.put).toHaveBeenCalledWith('coin/commission-accounting/settings', {
      amount_threshold: 120,
      fixed_commission: 5
    })
  })
})
