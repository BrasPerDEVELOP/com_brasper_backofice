export const WORLD_CUP_EXCHANGE_RATE_OPTIONS = [
  { value: 'BRL_PEN', label: 'Reales a soles (BRL → PEN)' },
  { value: 'PEN_BRL', label: 'Soles a reales (PEN → BRL)' },
  { value: 'USD_BRL', label: 'Dólares a reales (USD → BRL)' },
  { value: 'BRL_USD', label: 'Reales a dólares (BRL → USD)' },
  { value: 'ALL', label: 'Todos los tipos de cambio configurados' }
] as const

export type WorldCupExchangeRateScope = typeof WORLD_CUP_EXCHANGE_RATE_OPTIONS[number]['value']

export interface WorldCupCampaign {
  id: string
  name: string
  enabled: boolean
  mode: 'REVIEW' | 'AUTOMATIC'
  default_discount_percentage: number
  default_max_uses: number
  exchange_rate_scope: WorldCupExchangeRateScope
  code_template: string
  notification_emails: string[]
  updated_at: string
}

export interface WorldCupMatch {
  id: string
  provider_id: string
  stage: string | null
  home_team: string
  away_team: string
  home_team_code: string | null
  away_team_code: string | null
  home_score: number | null
  away_score: number | null
  starts_at: string
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED'
  selected: boolean
  last_synced_at: string
  coupon_id: string | null
  coupon_code: string | null
  coupon_status: 'DRAFT' | 'APPROVED_WAITING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED' | null
  coupon_discount_percentage: number | null
  coupon_max_uses: number | null
  coupon_exchange_rate_scope: WorldCupExchangeRateScope | null
}

export interface MatchCouponSettings {
  discount_percentage: number
  max_uses: number
  exchange_rate_scope: WorldCupExchangeRateScope
}

export interface AdminNotification {
  id: string
  kind: string
  title: string
  message: string
  match_id: string | null
  read_at: string | null
  email_status: string
  created_at: string
}

export interface WorldCupSyncResult {
  synced: number
}
