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

/**
 * Los tres comprobantes (envío + pago + checklist); el formulario usa esto para
 * pasar a `verified` cuando los tres están presentes.
 */
export function hasTransactionVerificationVouchersComplete(
  t: Pick<Transaction, "checked_image" | "send_voucher" | "payment_voucher">,
): boolean {
  const send =
    typeof t.send_voucher === "string" && t.send_voucher.trim() !== "";
  const pay =
    typeof t.payment_voucher === "string" && t.payment_voucher.trim() !== "";
  const img =
    typeof t.checked_image === "string" && t.checked_image.trim() !== "";
  return send && pay && img;
}

/** Imagen de verificación / checklist ya persistida (path o URL). */
export function hasStoredCheckedVerificationImage(
  t: Pick<Transaction, "checked_image">,
): boolean {
  return typeof t.checked_image === "string" && t.checked_image.trim() !== "";
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
