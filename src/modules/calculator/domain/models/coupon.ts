export interface Coupon {
  id: string
  code: string
  discount: number
  type: 'percent' | 'fixed'
  isAutomatic?: boolean
}
