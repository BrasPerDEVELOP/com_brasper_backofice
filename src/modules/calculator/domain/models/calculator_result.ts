export interface CalculatorResult {
  amountSend: number
  amountReceive: number
  rate: number
  commission: number
  commissionRate: number
  totalToSend: number
  calculationMode: 'normal' | 'special'
  baseCommission: number
  specialDiscountPercentage: number
  specialDiscountAmount: number
  finalCommission: number
  specialTargetReceive: number
  specialDiscountValid: boolean
  specialDiscountInvalidReason: string | null
}
