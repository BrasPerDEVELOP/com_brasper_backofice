import { apiClient } from '@/interface/api/client'
import type {
  HomeBannerRepository,
  HomeBannerCreatePayload,
  HomeBannerUpdatePayload
} from './home_banner_repository'
import type { HomeBanner } from '../../domain/models'

const defaultContent = {
  es: { eyebrow: 'ENVÍA RÁPIDO DESDE WHATSAPP', title: 'Envía dinero con el mejor tipo de cambio.', subtitle: 'Cotiza en segundos con total transparencia.', image_alt: 'Promoción Brasper' },
  pr: { eyebrow: 'ENVIE RÁPIDO PELO WHATSAPP', title: 'Envie dinheiro com a melhor taxa de câmbio.', subtitle: 'Faça sua cotação em segundos com transparência.', image_alt: 'Promoção Brasper' },
  en: { eyebrow: 'SEND FAST FROM WHATSAPP', title: 'Send money with a great exchange rate.', subtitle: 'Get a transparent quote in seconds.', image_alt: 'Brasper promotion' }
}

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
    ,content: o.content && typeof o.content === 'object' ? { ...defaultContent, ...(o.content as Partial<HomeBanner['content']>) } : defaultContent
    ,indicators: Array.isArray(o.indicators) ? o.indicators as HomeBanner['indicators'] : []
    ,appearance: o.appearance && typeof o.appearance === 'object' ? o.appearance as HomeBanner['appearance'] : { type: 'gradient', primary: '#2563eb', secondary: '#38bdf8', blur: true }
    ,show_image: o.show_image !== false
    ,show_indicators: o.show_indicators !== false
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
    appendConfig(form, payload)
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
    appendConfig(form, payload)
    if (payload.banner_es instanceof File) form.append('banner_es', payload.banner_es)
    if (payload.banner_pr instanceof File) form.append('banner_pr', payload.banner_pr)
    if (payload.banner_en instanceof File) form.append('banner_en', payload.banner_en)
    const response = await apiClient.put<unknown>(PATH, form)
    const banner = parseBanner(response.data)
    if (!banner) throw new Error('Respuesta de actualización de banner inválida')
    return banner
  }
}

function appendConfig(form: FormData, payload: HomeBannerCreatePayload | HomeBannerUpdatePayload): void {
  form.append('content', JSON.stringify(payload.content))
  form.append('indicators', JSON.stringify(payload.indicators.slice(0, 3)))
  form.append('appearance', JSON.stringify(payload.appearance))
  form.append('show_image', payload.show_image ? 'true' : 'false')
  form.append('show_indicators', payload.show_indicators ? 'true' : 'false')
}
