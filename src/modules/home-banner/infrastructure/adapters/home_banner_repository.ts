import type { HomeBanner } from '../../domain/models'

export interface HomeBannerCreatePayload {
  enable: boolean
  banner_es?: File | null
  banner_pr?: File | null
  banner_en?: File | null
}

export interface HomeBannerUpdatePayload {
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
