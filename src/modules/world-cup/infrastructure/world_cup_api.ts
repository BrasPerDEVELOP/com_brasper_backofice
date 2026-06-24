import { apiClient } from '@/interface/api/client'
import type {
  AdminNotification,
  MatchCouponSettings,
  WorldCupCampaign,
  WorldCupMatch,
  WorldCupSyncResult
} from '../domain/models'
import { normalizeWorldCupExchangeRateScopes } from '../domain/models'

const BASE = 'world-cup'
const SYNC_TIMEOUT_MS = 120_000

function normalizeCampaign(campaign: WorldCupCampaign): WorldCupCampaign {
  return {
    ...campaign,
    exchange_rate_scopes: normalizeWorldCupExchangeRateScopes(
      campaign.exchange_rate_scopes ?? campaign.exchange_rate_scope
    )
  }
}

function normalizeMatch(match: WorldCupMatch): WorldCupMatch {
  return {
    ...match,
    coupon_exchange_rate_scopes: normalizeWorldCupExchangeRateScopes(
      match.coupon_exchange_rate_scopes?.length
        ? match.coupon_exchange_rate_scopes
        : match.coupon_exchange_rate_scope
    )
  }
}

export const worldCupApi = {
  async load() {
    const [campaign, matches, notifications] = await Promise.all([
      apiClient.get<WorldCupCampaign>(`${BASE}/campaign`),
      apiClient.get<WorldCupMatch[]>(`${BASE}/matches`),
      apiClient.get<AdminNotification[]>(`${BASE}/notifications`)
    ])
    return {
      campaign: normalizeCampaign(campaign.data),
      matches: matches.data.map(normalizeMatch),
      notifications: notifications.data
    }
  },
  saveCampaign(payload: Omit<WorldCupCampaign, 'id' | 'name' | 'updated_at'>) {
    return apiClient.put<WorldCupCampaign>(`${BASE}/campaign`, {
      ...payload,
      exchange_rate_scopes: normalizeWorldCupExchangeRateScopes(payload.exchange_rate_scopes)
    })
  },
  sync() {
    return apiClient.post<WorldCupSyncResult>(`${BASE}/sync`, undefined, {
      timeout: SYNC_TIMEOUT_MS
    })
  },
  selectMatch(id: string, selected: boolean, settings?: MatchCouponSettings) {
    const exchangeRateScopes = selected && settings
      ? normalizeWorldCupExchangeRateScopes(settings.exchange_rate_scopes)
      : []
    return apiClient.post<WorldCupMatch>(`${BASE}/matches/${id}/selection`, {
      selected,
      ...(selected && settings
        ? {
            ...settings,
            exchange_rate_scope: exchangeRateScopes[0],
            exchange_rate_scopes: exchangeRateScopes
          }
        : undefined)
    })
  },
  couponAction(id: string, action: 'approve' | 'cancel') {
    return apiClient.post(`${BASE}/coupons/${id}/${action}`)
  },
  readNotification(id: string) {
    return apiClient.post<AdminNotification>(`${BASE}/notifications/${id}/read`)
  }
}
