import { apiClient } from '@/interface/api/client'
import type {
  HomeBannerRepository,
  HomeBannerCreatePayload,
  HomeBannerUpdatePayload
} from './home_banner_repository'
import type { HomeBanner } from '../../domain/models'

const PATH = 'home-banner/home-image/'

function parseBanner(raw: unknown): HomeBanner | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = o.id
  if (id == null) return null
  return {
    id: String(id),
    banner_es: o.banner_es != null ? String(o.banner_es) : null,
    banner_pr: o.banner_pr != null ? String(o.banner_pr) : null,
    banner_en: o.banner_en != null ? String(o.banner_en) : null,
    enable: Boolean(o.enable),
    created_at: o.created_at != null ? String(o.created_at) : undefined,
    created_by: o.created_by != null ? String(o.created_by) : undefined,
    updated_at: o.updated_at != null ? String(o.updated_at) : undefined
  }
}

export class HomeBannerApiAdapter implements HomeBannerRepository {
  async getBanner(): Promise<HomeBanner | null> {
    const response = await apiClient.get<unknown>(PATH)
    const data = response.data
    if (Array.isArray(data) && data.length > 0) return parseBanner(data[0])
    return parseBanner(data)
  }

  async createBanner(payload: HomeBannerCreatePayload): Promise<HomeBanner> {
    const form = new FormData()
    form.append('enable', payload.enable ? 'true' : 'false')
    if (payload.banner_es instanceof File) form.append('banner_es', payload.banner_es)
    if (payload.banner_pr instanceof File) form.append('banner_pr', payload.banner_pr)
    if (payload.banner_en instanceof File) form.append('banner_en', payload.banner_en)
    const response = await apiClient.post<unknown>(PATH, form)
    const banner = parseBanner(response.data)
    if (!banner) throw new Error('Respuesta de creación de banner inválida')
    return banner
  }

  async updateBanner(payload: HomeBannerUpdatePayload): Promise<HomeBanner> {
    const form = new FormData()
    form.append('id', payload.id)
    form.append('enable', payload.enable ? 'true' : 'false')
    if (payload.banner_es instanceof File) form.append('banner_es', payload.banner_es)
    else if (payload.banner_es != null && payload.banner_es !== '') form.append('banner_es', payload.banner_es)
    if (payload.banner_pr instanceof File) form.append('banner_pr', payload.banner_pr)
    else if (payload.banner_pr != null && payload.banner_pr !== '') form.append('banner_pr', payload.banner_pr)
    if (payload.banner_en instanceof File) form.append('banner_en', payload.banner_en)
    else if (payload.banner_en != null && payload.banner_en !== '') form.append('banner_en', payload.banner_en)
    const response = await apiClient.put<unknown>(PATH, form)
    const banner = parseBanner(response.data)
    if (!banner) throw new Error('Respuesta de actualización de banner inválida')
    return banner
  }
}
