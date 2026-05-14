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
  specialBaseReceive: number
  specialTargetReceive: number
  specialImprovementAmount: number
  specialImprovementPercentage: number
  specialImprovementValid: boolean
  specialImprovementInvalidReason: string | null
  specialDiscountValid: boolean
  specialDiscountInvalidReason: string | null
}
