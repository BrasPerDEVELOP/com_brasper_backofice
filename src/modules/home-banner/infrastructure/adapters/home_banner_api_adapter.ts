import { apiClient, getApiAuthHeaders } from '@/interface/api/client'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import { Domain } from '@/interface/infrastructure/services'
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

function appendBannerField(form: FormData, key: string, value: File | string | null | undefined): void {
  if (value instanceof File) {
    form.append(key, value)
    return
  }
  if (value != null && value !== '') form.append(key, value)
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    return res.json().catch(() => null)
  }
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * `fetch` + FormData evita que axios altere el multipart en PUT/POST
 * y permite manejar 401/403 sin cerrar la sesión global del backoffice.
 */
async function submitBannerForm(method: 'POST' | 'PUT', form: FormData): Promise<HomeBanner> {
  const res = await fetch(Domain.apiUrl(PATH), {
    method,
    body: form,
    headers: getApiAuthHeaders()
  })
  const raw = await parseJsonResponse(res)

  if (res.status === 401 || res.status === 403) {
    const msg =
      formatApiErrorBody(raw) ??
      (res.status === 401
        ? 'No autorizado para guardar el banner. Si el endpoint aún no usa token, revisa permisos en el backend.'
        : 'No tienes permiso para modificar el banner.')
    throw new Error(msg)
  }

  if (!res.ok) {
    throw new Error(formatApiErrorBody(raw) ?? `Error al guardar el banner (${res.status})`)
  }

  const payload =
    raw != null && typeof raw === 'object'
      ? ((raw as Record<string, unknown>).data ?? raw)
      : raw
  const banner = parseBanner(payload)
  if (!banner) throw new Error('Respuesta de guardado de banner inválida')
  return banner
}

export class HomeBannerApiAdapter implements HomeBannerRepository {
  async getBanner(): Promise<HomeBanner | null> {
    const response = await apiClient.get<unknown>(PATH, { skipAuthRedirect: true })
    const data = response.data
    if (Array.isArray(data) && data.length > 0) return parseBanner(data[0])
    return parseBanner(data)
  }

  async createBanner(payload: HomeBannerCreatePayload): Promise<HomeBanner> {
    const form = new FormData()
    form.append('enable', payload.enable ? 'true' : 'false')
    appendBannerField(form, 'banner_es', payload.banner_es)
    appendBannerField(form, 'banner_pr', payload.banner_pr)
    appendBannerField(form, 'banner_en', payload.banner_en)
    return submitBannerForm('POST', form)
  }

  async updateBanner(payload: HomeBannerUpdatePayload): Promise<HomeBanner> {
    const form = new FormData()
    form.append('id', payload.id)
    form.append('enable', payload.enable ? 'true' : 'false')
    appendBannerField(form, 'banner_es', payload.banner_es)
    appendBannerField(form, 'banner_pr', payload.banner_pr)
    appendBannerField(form, 'banner_en', payload.banner_en)
    return submitBannerForm('PUT', form)
  }
}
