import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type {
  AccountingCommissionSettings,
  AccountingCommissionSettingsPayload
} from '../../domain/models/accounting_commission_settings'
import {
  ACCOUNTING_COMMISSION_FALLBACK_FIXED,
  ACCOUNTING_COMMISSION_FALLBACK_THRESHOLD
} from '../../domain/accounting_commission'

function parseNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function parseAccountingCommissionSettings(
  data: unknown
): AccountingCommissionSettings {
  const o =
    data != null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  // Algunos backends anidan bajo `data` / `settings`.
  const nested =
    o.data != null && typeof o.data === 'object' && !Array.isArray(o.data)
      ? (o.data as Record<string, unknown>)
      : o.settings != null && typeof o.settings === 'object' && !Array.isArray(o.settings)
        ? (o.settings as Record<string, unknown>)
        : o

  return {
    amountThreshold: parseNumber(
      nested.amount_threshold ?? nested.amountThreshold ?? nested.threshold,
      ACCOUNTING_COMMISSION_FALLBACK_THRESHOLD
    ),
    fixedCommission: parseNumber(
      nested.fixed_commission ??
        nested.fixedCommission ??
        nested.fixed_amount ??
        nested.fixedAmount,
      ACCOUNTING_COMMISSION_FALLBACK_FIXED
    )
  }
}

export function toAccountingCommissionSettingsPayload(
  settings: AccountingCommissionSettings
): AccountingCommissionSettingsPayload {
  return {
    amount_threshold: settings.amountThreshold,
    fixed_commission: settings.fixedCommission
  }
}

/**
 * GET/PUT `coin/commission-accounting/settings/`.
 * El backend debe exponer umbral + comisión fija editable.
 */
export class AccountingCommissionSettingsApiAdapter {
  private endpoint(): string {
    return Domain.apiPath('coin/commission-accounting/settings/')
  }

  async getSettings(): Promise<AccountingCommissionSettings> {
    const response = await apiClient.get<unknown>(this.endpoint())
    return parseAccountingCommissionSettings(response.data)
  }

  async saveSettings(
    settings: AccountingCommissionSettings
  ): Promise<AccountingCommissionSettings> {
    const body = toAccountingCommissionSettingsPayload(settings)
    const response = await apiClient.put<unknown>(this.endpoint(), body)
    return parseAccountingCommissionSettings(response.data ?? body)
  }
}
