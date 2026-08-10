import type { Transaction } from "./models/transaction";

/** Sinónimos ES → clave interna (inglés), tras quitar acentos y pasar a minúsculas. */
const STATUS_ES_TO_EN: Record<string, string> = {
  "en verificacion": "verification",
  verificado: "verified",
  verificada: "verified",
  pendiente: "pending",
  completado: "completed",
  finalizado: "completed",
  finalizada: "completed",
  fallido: "failed",
  fallida: "failed",
  cancelado: "cancelled",
  cancelada: "cancelled",
};

/**
 * Estado de negocio normalizado para comparar con API y filtros
 * (minúsculas, sin marcas diacríticas; etiquetas en español → clave en inglés).
 */
export function normalizeTransactionStatus(status: string | undefined): string {
  if (status == null || status === "") return "";
  const folded = String(status)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return STATUS_ES_TO_EN[folded] ?? folded;
}

function hasVoucher(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasVoucher);
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Los tres comprobantes (envío + pago + checklist); el formulario usa esto para
 * pasar a `verified` cuando los tres están presentes.
 */
export function hasTransactionVerificationVouchersComplete(
  t: Pick<Transaction, "checked_image" | "send_voucher" | "payment_voucher">,
): boolean {
  const send = hasVoucher(t.send_voucher);
  const pay = hasVoucher(t.payment_voucher);
  const img = hasVoucher(t.checked_image);
  return send && pay && img;
}

/** Imagen de verificación / checklist ya persistida (path o URL). */
export function hasStoredCheckedVerificationImage(
  t: Pick<Transaction, "checked_image">,
): boolean {
  return hasVoucher(t.checked_image);
}

/**
 * Fila “verificada” en tabla: flag `checked`, estado `verified`/`checked`,
 * imagen de checklist sola en `verification`, o los tres comprobantes.
 */
export function isTransactionChecked(
  t: Pick<
    Transaction,
    "checked" | "status" | "checked_image" | "send_voucher" | "payment_voucher"
  >,
): boolean {
  if (t.checked === true) return true;
  const st = normalizeTransactionStatus(t.status);
  if (st === "checked" || st === "verified") return true;
  if (st === "" || st === "verification") {
    if (hasTransactionVerificationVouchersComplete(t)) return true;
    if (hasStoredCheckedVerificationImage(t)) return true;
  }
  return false;
}

/**
 * Clave de estado para badge / exportes: si ya está verificado a efectos de UI
 * pero el API envía `verification`, se muestra como `verified`.
 */
export function resolveTransactionStatusForDisplay(
  t: Pick<
    Transaction,
    | "status"
    | "checked"
    | "checked_image"
    | "send_voucher"
    | "payment_voucher"
  >,
): string | undefined {
  const raw = t.status;
  const st = normalizeTransactionStatus(raw);
  if (["completed", "failed", "cancelled"].includes(st)) return st || raw;
  if (st === "verified" || st === "checked") return "verified";
  if (st === "verification" && isTransactionChecked(t)) return "verified";
  if (!raw?.trim() && isTransactionChecked(t)) return "verified";
  return raw?.trim() ? st || String(raw) : undefined;
}

/**
 * Redondeo monetario a 2 decimales (coherente con payloads create/update).
 */
export function roundMoneyAmount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** `YYYY-MM-DD` del input `type="date"` → inicio del día en hora local (ms). */
export function localDateInputStartMs(
  value: string | undefined | null,
): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** `YYYY-MM-DD` del input `type="date"` → fin del día en hora local (ms). */
export function localDateInputEndMs(
  value: string | undefined | null,
): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    23,
    59,
    59,
    999,
  );
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** Fecha de envío para filtros de tabla (prioriza `send_date`). */
export function getTransactionSendDateMs(
  t: Pick<Transaction, "send_date" | "created_at">,
): number | null {
  const raw = t.send_date?.trim() || t.created_at?.trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function transactionMatchesSendDateRange(
  t: Pick<Transaction, "send_date" | "created_at">,
  fromInput?: string | null,
  toInput?: string | null,
): boolean {
  const fromMs = localDateInputStartMs(fromInput ?? undefined);
  const toMs = localDateInputEndMs(toInput ?? undefined);
  if (fromMs == null && toMs == null) return true;
  const txMs = getTransactionSendDateMs(t);
  if (txMs == null) return false;
  if (fromMs != null && txMs < fromMs) return false;
  if (toMs != null && txMs > toMs) return false;
  return true;
}

/** Código ISO de moneda normalizado (mayúsculas). */
export function normalizeCurrencyCode(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().toUpperCase();
}

export interface TransactionCurrencyCoinLookup {
  coin_a?: string;
  coin_b?: string;
}

export interface ResolveTransactionCurrencyPairOptions {
  taxRateById?: (id: string) => TransactionCurrencyCoinLookup | undefined;
  commissionById?: (id: string) => TransactionCurrencyCoinLookup | undefined;
  bankAccountCurrencyById?: (id: string) => string | undefined;
}

function nestedCoinPair(
  value: unknown,
): TransactionCurrencyCoinLookup | undefined {
  if (value == null || typeof value !== "object") return undefined;
  const rec = value as Record<string, unknown>;
  const coin_a = normalizeCurrencyCode(rec.coin_a ?? rec.from ?? rec.from_currency);
  const coin_b = normalizeCurrencyCode(rec.coin_b ?? rec.to ?? rec.to_currency);
  if (!coin_a && !coin_b) return undefined;
  return { coin_a, coin_b };
}

function firstCurrencyCode(...values: unknown[]): string {
  for (const value of values) {
    const code = normalizeCurrencyCode(value);
    if (code) return code;
  }
  return "";
}

/**
 * Par origen/destino de una transacción: tasa, comisión, campos planos del API
 * y moneda de cuentas bancarias (en ese orden).
 */
export function resolveTransactionCurrencyPair(
  t: Transaction,
  options: ResolveTransactionCurrencyPairOptions = {},
): { origin: string; destination: string } {
  const rec = t as Record<string, unknown>;
  const taxRateId = String(t.tax_rate_id ?? "").trim();
  const commissionId = String(t.commission_id ?? "").trim();
  const rate = taxRateId ? options.taxRateById?.(taxRateId) : undefined;
  const commission = commissionId
    ? options.commissionById?.(commissionId)
    : undefined;
  const nestedRate = nestedCoinPair(rec.tax_rate ?? rec.taxRate ?? rec.tasa);
  const nestedCommission = nestedCoinPair(
    rec.commission ?? rec.comision ?? rec.commission_rate,
  );

  const originAccountId = String(
    t.bank_account_origin_id ?? t.bank_account_id ?? "",
  ).trim();
  const destinationAccountId = String(
    t.bank_account_destination_id ?? "",
  ).trim();

  const origin = firstCurrencyCode(
    rate?.coin_a,
    commission?.coin_a,
    nestedRate?.coin_a,
    nestedCommission?.coin_a,
    rec.origin_currency,
    rec.moneda_origen,
    rec.moneda_envio,
    rec.coin_a,
    rec.from_currency,
    rec.currency_from,
    originAccountId
      ? options.bankAccountCurrencyById?.(originAccountId)
      : undefined,
  );

  const destination = firstCurrencyCode(
    rate?.coin_b,
    commission?.coin_b,
    nestedRate?.coin_b,
    nestedCommission?.coin_b,
    rec.destination_currency,
    rec.moneda_destino,
    rec.moneda_recepcion,
    rec.coin_b,
    rec.to_currency,
    rec.currency_to,
    destinationAccountId
      ? options.bankAccountCurrencyById?.(destinationAccountId)
      : undefined,
  );

  return { origin, destination };
}

/** Clave de par para filtros (`brl-pen`). */
export function getTransactionCurrencyPairKey(
  t: Transaction,
  options?: ResolveTransactionCurrencyPairOptions,
): string {
  const { origin, destination } = resolveTransactionCurrencyPair(t, options);
  if (!origin || !destination) return "";
  return `${origin.toLowerCase()}-${destination.toLowerCase()}`;
}

export function transactionMatchesCurrencyPair(
  t: Transaction,
  filterKey: string,
  options?: ResolveTransactionCurrencyPairOptions,
): boolean {
  const key = filterKey.trim().toLowerCase();
  if (!key) return true;
  return getTransactionCurrencyPairKey(t, options) === key;
}

const TRANSACTION_CODE_ORIGIN_CURRENCY: Record<string, string> = {
  B: "BRL",
  P: "PEN",
  U: "USD",
};

/**
 * Moneda de envío inferida del prefijo de código (`BxP` → BRL, `PxB` → PEN).
 */
export function inferOriginCurrencyFromTransactionCode(
  code: string | undefined | null,
): string {
  const trimmed = code?.trim();
  if (!trimmed) return "";
  const match = /^([BPU])x[BPU]/i.exec(trimmed);
  if (!match) return "";
  const originCode = match[1]?.toUpperCase();
  return originCode ? (TRANSACTION_CODE_ORIGIN_CURRENCY[originCode] ?? "") : "";
}

/** Código legible en UI: conserva prefijo, quita ceros extra y deja dos ceros iniciales. */
export function formatTransactionCodeForDisplay(
  code: string | undefined | null,
): string {
  if (!code?.trim()) return "—";
  const trimmed = code.trim();
  const formatNumericSuffix = (numPart: string): string => {
    const significant = numPart.replace(/^0+/, "") || "0";
    return significant.padStart(significant.length + 2, "0");
  };
  const dash = trimmed.indexOf("-");
  if (dash === -1) {
    const match = /^(.+?)(\d+)$/.exec(trimmed);
    if (!match) return trimmed;
    const prefix = match[1] ?? "";
    const numericSuffix = match[2] ?? "";
    return `${prefix}${formatNumericSuffix(numericSuffix)}`;
  }
  const prefix = trimmed.slice(0, dash + 1);
  const numPart = trimmed.slice(dash + 1).replace(/\D/g, "");
  if (!numPart) return trimmed;
  return `${prefix}${formatNumericSuffix(numPart)}`;
}

/** Código persistido en `coupon_discount_code` para descuentos de calculadora especial. */
export const SPECIAL_CALCULATOR_DISCOUNT_CODE = "ESPECIAL";

/** Umbral mínimo para inferir descuento especial en UI (evita ruido de redondeo). */
export const SPECIAL_CALCULATOR_INFERRED_DISPLAY_MIN = 1;

export function isSpecialCalculatorDiscountCode(
  code: string | null | undefined,
): boolean {
  return (
    String(code ?? "")
      .trim()
      .toUpperCase() === SPECIAL_CALCULATOR_DISCOUNT_CODE
  );
}

export interface SpecialDiscountCatalogLookup {
  commissions: Array<{
    id: string;
    coin_a: string;
    coin_b: string;
    percentage: number;
    min_amount: number;
    max_amount: number;
  }>;
  taxRates: Array<{
    id: string;
    coin_a: string;
    coin_b: string;
    tax: string | number;
  }>;
}

export interface TransactionSpecialDiscountInfo {
  code: string;
  discountCommission: number;
  discountPercentage: number | null;
  baseReceive: number;
  finalReceive: number;
  improvementReceive: number;
  baseCommission: number;
  finalCommission: number;
  totalToSend: number | null;
  /** `true` si el API guardó el código ESPECIAL; `false` si se infiere del catálogo. */
  persisted: boolean;
}

function pickCommissionBracketForAmount(
  grossSend: number,
  pairCommissions: SpecialDiscountCatalogLookup["commissions"],
): SpecialDiscountCatalogLookup["commissions"][number] | null {
  if (pairCommissions.length === 0) return null;
  const match = pairCommissions.find(
    (c) => grossSend >= c.min_amount && grossSend <= c.max_amount,
  );
  return match ?? pairCommissions[pairCommissions.length - 1] ?? null;
}

function computeNormalQuoteFromTransaction(
  t: Transaction,
  catalogs: SpecialDiscountCatalogLookup,
): { baseCommission: number; baseReceive: number } | null {
  const origin = Number(t.origin_amount);
  if (!Number.isFinite(origin) || origin <= 0) return null;

  const rateId = t.tax_rate_id?.trim();
  const commissionId = t.commission_id?.trim();
  if (!rateId || !commissionId) return null;

  const rateRow = catalogs.taxRates.find((row) => row.id === rateId);
  const commissionRow = catalogs.commissions.find((row) => row.id === commissionId);
  if (!rateRow || !commissionRow) return null;

  const rate = Number(rateRow.tax);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const pairCommissions = catalogs.commissions.filter(
    (row) =>
      row.coin_a === commissionRow.coin_a && row.coin_b === commissionRow.coin_b,
  );
  const bracket =
    pickCommissionBracketForAmount(origin, pairCommissions) ?? commissionRow;
  const catalogCommission = roundMoneyAmount(
    origin * (commissionRow.percentage / 100),
  );
  const bracketCommission = roundMoneyAmount(
    origin * (bracket.percentage / 100),
  );
  const baseCommission = Math.max(catalogCommission, bracketCommission);
  const totalToSend = roundMoneyAmount(origin - baseCommission);
  const baseReceive = roundMoneyAmount(totalToSend * rate);

  return { baseCommission, baseReceive };
}

export function transactionUsedSpecialCalculator(
  t: Pick<Transaction, "coupon_discount_code">,
): boolean {
  return isSpecialCalculatorDiscountCode(t.coupon_discount_code);
}

/**
 * Descuento especial visible en tabla: solo calculadora especial registrada (ESPECIAL)
 * o mejora/descuento inferido claramente por encima del umbral (transacciones antiguas).
 */
export function getTransactionSpecialDiscountForDisplay(
  t: Transaction,
  catalogs?: SpecialDiscountCatalogLookup,
): TransactionSpecialDiscountInfo | null {
  const info = getTransactionSpecialDiscountInfo(t, catalogs);
  if (!info) return null;
  if (info.persisted) return info;
  if (
    info.discountCommission >= SPECIAL_CALCULATOR_INFERRED_DISPLAY_MIN ||
    info.improvementReceive >= SPECIAL_CALCULATOR_INFERRED_DISPLAY_MIN
  ) {
    return info;
  }
  return null;
}

/**
 * Descuento de calculadora especial: lee `coupon_discount_code === ESPECIAL`
 * o infiere la mejora comparando la cotización normal del catálogo con los montos guardados.
 */
export function getTransactionSpecialDiscountInfo(
  t: Transaction,
  catalogs?: SpecialDiscountCatalogLookup,
): TransactionSpecialDiscountInfo | null {
  const origin = roundMoneyAmount(Number(t.origin_amount ?? 0));
  const finalReceive = roundMoneyAmount(Number(t.destination_amount ?? 0));
  const finalCommission = roundMoneyAmount(
    Number(t.resultado_comision ?? t.commission_result ?? 0),
  );

  if (origin <= 0 || finalReceive <= 0) return null;

  const persisted = isSpecialCalculatorDiscountCode(t.coupon_discount_code);
  if (
    !persisted &&
    (t.coupon_id ||
      (t.coupon_discount_code?.trim() &&
        !isSpecialCalculatorDiscountCode(t.coupon_discount_code)))
  ) {
    return null;
  }

  const normal = catalogs
    ? computeNormalQuoteFromTransaction(t, catalogs)
    : null;

  if (persisted) {
    const discountCommission = roundMoneyAmount(
      Number(t.coupon_discount_commission ?? 0),
    );
    const baseReceive = normal?.baseReceive ?? finalReceive;
    const baseCommission =
      normal?.baseCommission ??
      roundMoneyAmount(discountCommission + finalCommission);
    const improvementReceive = roundMoneyAmount(
      Math.max(0, finalReceive - baseReceive),
    );

    if (
      discountCommission < 0.01 &&
      improvementReceive < 0.01 &&
      !t.coupon_discount_percentage
    ) {
      return null;
    }

    return {
      code: SPECIAL_CALCULATOR_DISCOUNT_CODE,
      discountCommission,
      discountPercentage: t.coupon_discount_percentage ?? null,
      baseReceive,
      finalReceive,
      improvementReceive,
      baseCommission,
      finalCommission,
      totalToSend:
        t.total_a_enviar != null
          ? roundMoneyAmount(t.total_a_enviar)
          : t.total_to_send != null
            ? roundMoneyAmount(t.total_to_send)
            : null,
      persisted: true,
    };
  }

  if (!normal) return null;

  const discountCommission = roundMoneyAmount(
    normal.baseCommission - finalCommission,
  );
  const improvementReceive = roundMoneyAmount(finalReceive - normal.baseReceive);

  if (
    discountCommission < SPECIAL_CALCULATOR_INFERRED_DISPLAY_MIN &&
    improvementReceive < SPECIAL_CALCULATOR_INFERRED_DISPLAY_MIN
  ) {
    return null;
  }

  const discountPercentage =
    normal.baseCommission > 0
      ? roundMoneyAmount((discountCommission / normal.baseCommission) * 100)
      : null;

  return {
    code: SPECIAL_CALCULATOR_DISCOUNT_CODE,
    discountCommission: Math.max(0, discountCommission),
    discountPercentage,
    baseReceive: normal.baseReceive,
    finalReceive,
    improvementReceive: Math.max(0, improvementReceive),
    baseCommission: normal.baseCommission,
    finalCommission,
    totalToSend:
      t.total_a_enviar != null
        ? roundMoneyAmount(t.total_a_enviar)
        : t.total_to_send != null
          ? roundMoneyAmount(t.total_to_send)
          : null,
    persisted: false,
  };
}

/**
 * Día calendario local (`YYYY-MM-DD`) al que pertenece un envío.
 * Se agrupa por `send_date` (la fecha de envío que ve ventas) y solo cae en
 * `created_at` cuando el registro no la tiene.
 */
export function transactionDayKey(t: Transaction): string | null {
  const raw = t.send_date?.trim() || t.created_at?.trim() || "";
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Instante usado para ordenar dentro del día: el orden real de ingreso. */
function transactionSequenceMs(t: Transaction): number {
  const raw = t.created_at?.trim() || t.send_date?.trim() || "";
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Correlativo de cada envío **dentro de su día**: el primero de la mañana es el 1,
 * el siguiente el 2, y el último ingresado es el número más alto. Cada día reinicia.
 *
 * El número pertenece al envío, no a la pantalla: no depende del orden de la tabla,
 * del filtro ni de la página. Por eso hay que alimentar esta función con **todos**
 * los envíos del día, no con la página visible (ver `loadDailySequences` en el store).
 */
export function buildDailySequenceMap(
  transactions: Transaction[],
): Map<string, number> {
  const byDay = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!t.id) continue;
    const key = transactionDayKey(t);
    if (!key) continue;
    const bucket = byDay.get(key);
    if (bucket) bucket.push(t);
    else byDay.set(key, [t]);
  }

  const sequence = new Map<string, number>();
  for (const bucket of byDay.values()) {
    bucket
      .slice()
      .sort((a, b) => {
        const diff = transactionSequenceMs(a) - transactionSequenceMs(b);
        // Empate de timestamp: desempatamos por id para que el número sea estable
        // entre recargas en vez de depender del orden que devuelva el API.
        return diff !== 0 ? diff : (a.id ?? "").localeCompare(b.id ?? "");
      })
      .forEach((t, index) => {
        sequence.set(t.id as string, index + 1);
      });
  }
  return sequence;
}
