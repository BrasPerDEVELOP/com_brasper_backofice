import type { HomeBanner } from '../../domain/models'
import type { BannerAppearance, BannerIndicator, BannerLocaleContent } from '../../domain/models/home_banner'

export interface HomeBannerConfigPayload {
  content: Record<'es' | 'pr' | 'en', BannerLocaleContent>
  indicators: BannerIndicator[]
  appearance: BannerAppearance
  show_image: boolean
  show_indicators: boolean
}

export interface HomeBannerCreatePayload extends HomeBannerConfigPayload {
  enable: boolean
  banner_es?: File | null
  banner_pr?: File | null
  banner_en?: File | null
}

export interface HomeBannerUpdatePayload extends HomeBannerConfigPayload {
  id: string
  enable: boolean
  banner_es?: File | string | null
  banner_pr?: File | string | null
  banner_en?: File | string | null
}

export interface HomeBannerRepository {
  getBanner(): Promise<HomeBanner | null>
  createBanner(payload: HomeBannerCreatePayload): Promise<HomeBanner>
  updateBanner(payload: HomeBannerUpdatePayload): Promise<HomeBanner>
}
