export const WORLD_CUP_EXCHANGE_RATE_OPTIONS = [
  { value: 'BRL_PEN', label: 'Reales a soles (BRL → PEN)' },
  { value: 'PEN_BRL', label: 'Soles a reales (PEN → BRL)' },
  { value: 'USD_BRL', label: 'Dólares a reales (USD → BRL)' },
  { value: 'BRL_USD', label: 'Reales a dólares (BRL → USD)' },
  { value: 'ALL', label: 'Todos los tipos de cambio configurados' }
] as const

export type WorldCupExchangeRateScope = typeof WORLD_CUP_EXCHANGE_RATE_OPTIONS[number]['value']

const DEFAULT_WORLD_CUP_EXCHANGE_RATE_SCOPE: WorldCupExchangeRateScope = 'PEN_BRL'

export function normalizeWorldCupExchangeRateScopes(
  value: WorldCupExchangeRateScope[] | WorldCupExchangeRateScope | null | undefined
): WorldCupExchangeRateScope[] {
  const list = Array.isArray(value) ? value : value ? [value] : []
  const unique = WORLD_CUP_EXCHANGE_RATE_OPTIONS
    .map((option) => option.value)
    .filter((scope) => list.includes(scope))
  if (unique.includes('ALL')) return ['ALL']
  return unique.length ? unique : [DEFAULT_WORLD_CUP_EXCHANGE_RATE_SCOPE]
}

export function getWorldCupExchangeRateScopeLabels(scopes: WorldCupExchangeRateScope[]): string {
  const normalized = normalizeWorldCupExchangeRateScopes(scopes)
  return normalized
    .map((scope) => WORLD_CUP_EXCHANGE_RATE_OPTIONS.find((option) => option.value === scope)?.label ?? scope)
    .join(', ')
}

export interface WorldCupCampaign {
  id: string
  name: string
  enabled: boolean
  mode: 'REVIEW' | 'AUTOMATIC'
  default_discount_percentage: number
  default_max_uses: number
  exchange_rate_scope?: WorldCupExchangeRateScope
  exchange_rate_scopes: WorldCupExchangeRateScope[]
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
  coupon_exchange_rate_scopes: WorldCupExchangeRateScope[]
}

export interface MatchCouponSettings {
  discount_percentage: number
  max_uses: number
  exchange_rate_scopes: WorldCupExchangeRateScope[]
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
