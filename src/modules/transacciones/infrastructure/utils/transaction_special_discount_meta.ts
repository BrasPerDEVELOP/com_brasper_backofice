import type { Transaction } from '../../domain/models'
import {
  SPECIAL_CALCULATOR_DISCOUNT_CODE,
  isSpecialCalculatorDiscountCode,
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

export function removeTransactionSpecialDiscountMeta(
  transactionId: string | undefined | null,
) {
  const id = transactionId?.trim()
  if (!id) return
  const map = readMetaMap()
  if (!(id in map)) return
  delete map[id]
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

function mergeSpecialDiscountMeta(
  next: TransactionSpecialDiscountMeta,
  previous: TransactionSpecialDiscountMeta | null,
): TransactionSpecialDiscountMeta {
  if (!previous) return next
  return {
    ...next,
    baseReceive: previous.baseReceive ?? next.baseReceive,
    improvementReceive:
      previous.improvementReceive > 0.005
        ? previous.improvementReceive
        : next.improvementReceive,
    discountPercentage: next.discountPercentage ?? previous.discountPercentage,
  }
}

/** Construye meta desde una transacción con ESPECIAL persistido en el API. */
export function buildSpecialDiscountMetaFromPersistedApi(
  transaction: Transaction,
): TransactionSpecialDiscountMeta | null {
  if (!isSpecialCalculatorDiscountCode(transaction.coupon_discount_code)) {
    return null
  }

  const finalReceive = roundMoneyAmount(
    Number(
      transaction.coupon_destination_amount ??
        transaction.destination_amount ??
        0,
    ),
  )
  if (finalReceive <= 0) return null

  const discountCommission = roundMoneyAmount(
    Number(transaction.coupon_discount_commission ?? 0),
  )
  const finalCommission = roundMoneyAmount(
    Number(transaction.resultado_comision ?? transaction.commission_result ?? 0),
  )
  const totalToSendRaw =
    transaction.coupon_discount_total_to_send ??
    transaction.total_a_enviar ??
    transaction.total_to_send
  const totalToSend =
    totalToSendRaw != null ? roundMoneyAmount(Number(totalToSendRaw)) : null

  return {
    discountCommission,
    discountPercentage:
      transaction.coupon_discount_percentage != null
        ? roundMoneyAmount(Number(transaction.coupon_discount_percentage))
        : null,
    baseReceive: finalReceive,
    finalReceive,
    improvementReceive: 0,
    finalCommission,
    totalToSend,
  }
}

export function buildSpecialDiscountMetaFromSavedAmounts(input: {
  origin_amount: number
  destination_amount: number
  resultado_comision?: number | null
  total_a_enviar?: number | null
  specialDiscountAmount?: number | null
  specialDiscountPercentage?: number | null
  specialBaseReceive?: number | null
}): TransactionSpecialDiscountMeta | null {
  const discountCommission = roundMoneyAmount(
    Number(input.specialDiscountAmount ?? 0),
  )
  const finalReceive = roundMoneyAmount(input.destination_amount)
  if (finalReceive <= 0) return null

  const finalCommission =
    input.resultado_comision != null
      ? roundMoneyAmount(input.resultado_comision)
      : null
  const totalToSend =
    input.total_a_enviar != null
      ? roundMoneyAmount(input.total_a_enviar)
      : null
  const baseReceive =
    input.specialBaseReceive != null
      ? roundMoneyAmount(input.specialBaseReceive)
      : finalReceive

  if (discountCommission <= 0.005) {
    if (
      finalCommission == null ||
      totalToSend == null ||
      !isFiniteNumber(finalCommission) ||
      !isFiniteNumber(totalToSend)
    ) {
      return null
    }
  }

  return {
    discountCommission,
    discountPercentage:
      input.specialDiscountPercentage != null
        ? roundMoneyAmount(input.specialDiscountPercentage)
        : null,
    baseReceive,
    finalReceive,
    improvementReceive: roundMoneyAmount(
      Math.max(0, finalReceive - baseReceive),
    ),
    finalCommission,
    totalToSend,
  }
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

function overlayTransactionWithSpecialDiscountMeta(
  transaction: Transaction,
  meta: TransactionSpecialDiscountMeta,
): Transaction {
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

/** Completa campos ESPECIAL cuando el API no los devuelve pero sí hay meta local. */
export function enrichTransactionWithSpecialDiscountMeta(
  transaction: Transaction,
): Transaction {
  const persistedApiMeta = buildSpecialDiscountMetaFromPersistedApi(transaction)
  if (persistedApiMeta) {
    if (transaction.id) {
      const previous = getTransactionSpecialDiscountMeta(transaction.id)
      saveTransactionSpecialDiscountMeta(
        transaction.id,
        mergeSpecialDiscountMeta(persistedApiMeta, previous),
      )
    }
    return transaction
  }

  const meta = getTransactionSpecialDiscountMeta(transaction.id)
  if (!meta) return transaction

  return overlayTransactionWithSpecialDiscountMeta(transaction, meta)
}

export function enrichTransactionsWithSpecialDiscountMeta(
  transactions: Transaction[],
): Transaction[] {
  return transactions.map(enrichTransactionWithSpecialDiscountMeta)
}

/** Sincroniza meta local tras guardar para que la misma pestaña no muestre montos viejos. */
export function syncSpecialDiscountMetaAfterSave(
  transaction: Transaction,
  fallback?: Parameters<typeof buildSpecialDiscountMetaFromSavedAmounts>[0],
): void {
  const id = transaction.id?.trim()
  if (!id) return

  const fromApi = buildSpecialDiscountMetaFromPersistedApi(transaction)
  if (fromApi) {
    const previous = getTransactionSpecialDiscountMeta(id)
    saveTransactionSpecialDiscountMeta(
      id,
      mergeSpecialDiscountMeta(fromApi, previous),
    )
    return
  }

  if (fallback) {
    const fromAmounts = buildSpecialDiscountMetaFromSavedAmounts(fallback)
    if (fromAmounts) {
      saveTransactionSpecialDiscountMeta(id, fromAmounts)
      return
    }
  }

  removeTransactionSpecialDiscountMeta(id)
}
