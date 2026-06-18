import { apiClient } from '@/interface/api/client'
import type {
  AdminNotification,
  MatchCouponSettings,
  WorldCupCampaign,
  WorldCupMatch,
  WorldCupSyncResult
} from '../domain/models'

const BASE = 'world-cup'
const SYNC_TIMEOUT_MS = 120_000

export const worldCupApi = {
  async load() {
    const [campaign, matches, notifications] = await Promise.all([
      apiClient.get<WorldCupCampaign>(`${BASE}/campaign`),
      apiClient.get<WorldCupMatch[]>(`${BASE}/matches`),
      apiClient.get<AdminNotification[]>(`${BASE}/notifications`)
    ])
    return { campaign: campaign.data, matches: matches.data, notifications: notifications.data }
  },
  saveCampaign(payload: Omit<WorldCupCampaign, 'id' | 'name' | 'updated_at'>) {
    return apiClient.put<WorldCupCampaign>(`${BASE}/campaign`, payload)
  },
  sync() {
    return apiClient.post<WorldCupSyncResult>(`${BASE}/sync`, undefined, {
      timeout: SYNC_TIMEOUT_MS
    })
  },
  selectMatch(id: string, selected: boolean, settings?: MatchCouponSettings) {
    return apiClient.post<WorldCupMatch>(`${BASE}/matches/${id}/selection`, {
      selected,
      ...(selected ? settings : undefined)
    })
  },
  couponAction(id: string, action: 'approve' | 'cancel') {
    return apiClient.post(`${BASE}/coupons/${id}/${action}`)
  },
  readNotification(id: string) {
    return apiClient.post<AdminNotification>(`${BASE}/notifications/${id}/read`)
  }
}
