import type { Transaction } from '../../domain/models'
import {
  SPECIAL_CALCULATOR_DISCOUNT_CODE,
  roundMoneyAmount,
} from '../../domain/models'

const STORAGE_KEY = 'transactions.specialDiscountMeta.v1'

export type TransactionSpecialDiscountMeta = {
  discountCommission: number
  discountPercentage: number | null
  baseReceive: number | null
  finalReceive: number
  improvementReceive: number
  finalCommission: number | null
  totalToSend: number | null
}

export type SpecialDiscountSnapshotInput = {
  origin_amount: number
  destination_amount: number
  resultado_comision?: number | null
  total_a_enviar?: number | null
  specialDiscountAmount?: number | null
  specialDiscountPercentage?: number | null
  specialBaseReceive?: number
}

type MetaMap = Record<string, TransactionSpecialDiscountMeta>

function readMetaMap(): MetaMap {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as MetaMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMetaMap(map: MetaMap) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / private mode */
  }
}

export function saveTransactionSpecialDiscountMeta(
  transactionId: string,
  meta: TransactionSpecialDiscountMeta,
) {
  const id = transactionId.trim()
  if (!id) return
  const map = readMetaMap()
  map[id] = meta
  writeMetaMap(map)
}

export function getTransactionSpecialDiscountMeta(
  transactionId: string | undefined | null,
): TransactionSpecialDiscountMeta | null {
  const id = transactionId?.trim()
  if (!id) return null
  return readMetaMap()[id] ?? null
}

export function buildSpecialDiscountMetaFromSnapshot(
  snapshot: SpecialDiscountSnapshotInput,
): TransactionSpecialDiscountMeta | null {
  const discountCommission = roundMoneyAmount(
    Number(snapshot.specialDiscountAmount ?? 0),
  )
  if (discountCommission <= 0.005) return null
  const finalReceive = roundMoneyAmount(snapshot.destination_amount)
  const baseReceive =
    snapshot.specialBaseReceive != null
      ? roundMoneyAmount(snapshot.specialBaseReceive)
      : finalReceive
  const improvementReceive = roundMoneyAmount(
    Math.max(0, finalReceive - baseReceive),
  )
  return {
    discountCommission,
    discountPercentage:
      snapshot.specialDiscountPercentage != null
        ? roundMoneyAmount(snapshot.specialDiscountPercentage)
        : null,
    baseReceive,
    finalReceive,
    improvementReceive,
    finalCommission:
      snapshot.resultado_comision != null
        ? roundMoneyAmount(snapshot.resultado_comision)
        : null,
    totalToSend:
      snapshot.total_a_enviar != null
        ? roundMoneyAmount(snapshot.total_a_enviar)
        : null,
  }
}

/** Completa campos ESPECIAL cuando el API no los devuelve pero sí hay meta local. */
export function enrichTransactionWithSpecialDiscountMeta(
  transaction: Transaction,
): Transaction {
  const meta = getTransactionSpecialDiscountMeta(transaction.id)
  if (!meta) return transaction

  return {
    ...transaction,
    coupon_discount_code: SPECIAL_CALCULATOR_DISCOUNT_CODE,
    coupon_discount_commission: meta.discountCommission,
    coupon_discount_percentage: meta.discountPercentage,
    coupon_origin_amount: transaction.origin_amount ?? null,
    coupon_destination_amount: meta.finalReceive,
    coupon_discount_total_to_send: meta.totalToSend,
    destination_amount: meta.finalReceive,
    resultado_comision: meta.finalCommission ?? transaction.resultado_comision,
    commission_result: meta.finalCommission ?? transaction.commission_result,
    total_a_enviar: meta.totalToSend ?? transaction.total_a_enviar,
    total_to_send: meta.totalToSend ?? transaction.total_to_send,
  }
}

export function enrichTransactionsWithSpecialDiscountMeta(
  transactions: Transaction[],
): Transaction[] {
  return transactions.map(enrichTransactionWithSpecialDiscountMeta)
}

/** Tras PUT: persiste meta ESPECIAL en sessionStorage si el snapshot tiene descuento. */
export function syncSpecialDiscountMetaAfterSave(
  transaction: Transaction,
  snapshot: SpecialDiscountSnapshotInput,
): void {
  const id = transaction.id?.trim()
  if (!id) return
  const meta = buildSpecialDiscountMetaFromSnapshot(snapshot)
  if (meta) saveTransactionSpecialDiscountMeta(id, meta)
}
