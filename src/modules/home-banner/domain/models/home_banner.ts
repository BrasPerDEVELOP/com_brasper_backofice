export interface HomeBanner {
  id: string
  banner_es: string | null
  banner_pr: string | null
  banner_en: string | null
  enable: boolean
  created_at?: string
  created_by?: string
  updated_at?: string
  content: Record<'es' | 'pr' | 'en', BannerLocaleContent>
  indicators: BannerIndicator[]
  appearance: BannerAppearance
  show_image: boolean
  show_indicators: boolean
}

export interface BannerLocaleContent { eyebrow: string; title: string; subtitle: string; image_alt: string }
export interface BannerIndicator { icon: string; enabled: boolean; text: Record<'es' | 'pr' | 'en', string> }
export interface BannerAppearance { type: 'solid' | 'gradient'; primary: string; secondary: string; blur: boolean }
