export interface Coupon {
  id: string
  code: string
  discount_percentage: number
  max_uses: number
  origin_currency: string
  destination_currency: string
  exchange_rate_scopes?: string[] | null
  start_date: string
  end_date: string
  is_active: boolean
  created_at?: string
  created_by?: string
  updated_at?: string
}
