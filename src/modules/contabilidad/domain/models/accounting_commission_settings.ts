/** Settings globales de comisión fija bajo umbral (API contabilidad). */
export interface AccountingCommissionSettings {
  amountThreshold: number
  fixedCommission: number
}

export type AccountingCommissionSettingsPayload = {
  amount_threshold: number
  fixed_commission: number
}
