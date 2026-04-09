import type { CurrencyCode } from '../../domain/models'

export const CURRENCY_FLAG_SRC_BY_CODE: Record<CurrencyCode, string> = {
  pen: '/assets/flags/pe.png',
  usd: '/assets/flags/usa.png',
  brl: '/assets/flags/bra.png'
}

const currencyLocales: Record<CurrencyCode, string> = {
  pen: 'es-PE',
  usd: 'en-US',
  brl: 'pt-BR'
}

export function normalizeTwoDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function formatCurrency(value: number, currency: CurrencyCode): string {
  const amount = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat(currencyLocales[currency], {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/** Misma precisión que las tasas (evitar toFixed(2) que distorsiona ej. 1.485 → 1.49). */
export function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  const s = value.toFixed(6)
  return s.includes('.') ? s.replace(/\.?0+$/, '') || '0' : s
}

export function formatNumber(value: number): string {
  const amount = Number.isFinite(value) ? value : 0
  return amount.toFixed(2)
}
