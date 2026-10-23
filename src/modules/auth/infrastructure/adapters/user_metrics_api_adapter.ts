import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'

export interface UserMetrics {
  total: number
  active: number
  brazil: number
  brazil_located: number
  brazil_missing_area: number
  countries: { name: string; count: number }[]
  areas: { code: string; name: string; count: number; percentage: number }[]
}

export async function fetchUserMetrics(role = ''): Promise<UserMetrics> {
  const { data } = await apiClient.get<UserMetrics>(Domain.apiPath('user/metrics'), {
    params: role ? { role } : {},
    skipAuthRedirect: true
  })
  return data
}
