import type { Transaction } from "./models/transaction";

/**
 * Estado de negocio normalizado (minúsculas, sin espacios) para comparar con API y filtros.
 */
export function normalizeTransactionStatus(status: string | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

/**
 * Checklist en UI: usa el flag `checked` de la API.
 * Legado: `status === "checked"` en datos antiguos.
 */
export function isTransactionChecked(
  t: Pick<Transaction, "checked" | "status">,
): boolean {
  if (t.checked === true) return true;
  return normalizeTransactionStatus(t.status) === "checked";
}

/**
 * Redondeo monetario a 2 decimales (coherente con payloads create/update).
 */
export function roundMoneyAmount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
