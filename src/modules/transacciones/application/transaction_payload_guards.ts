import type {
  CreateTransactionPayload,
  GetTransactionsParams,
} from "../infrastructure/adapters/transactions_repository";

export function assertValidTransactionId(id: string): void {
  if (!id?.trim()) {
    throw new Error("ID de transacción inválido");
  }
}

function trimOrUndef(v: string | null | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/**
 * Evita enviar strings vacíos al API; mantiene el contrato de filtros GET.
 */
export function normalizeGetTransactionsParams(
  params?: GetTransactionsParams,
): GetTransactionsParams | undefined {
  if (!params) return undefined;
  const o: GetTransactionsParams = {};
  const status = trimOrUndef(params.status ?? undefined);
  const user_id = trimOrUndef(params.user_id ?? undefined);
  const bank_account_id = trimOrUndef(params.bank_account_id ?? undefined);
  const bank_account_origin_id = trimOrUndef(
    params.bank_account_origin_id ?? undefined,
  );
  const bank_account_destination_id = trimOrUndef(
    params.bank_account_destination_id ?? undefined,
  );
  const created_at_from = trimOrUndef(params.created_at_from ?? undefined);
  const created_at_to = trimOrUndef(params.created_at_to ?? undefined);
  const send_date_from = trimOrUndef(params.send_date_from ?? undefined);
  const send_date_to = trimOrUndef(params.send_date_to ?? undefined);
  const search = trimOrUndef(params.search ?? undefined);
  const currency = trimOrUndef(params.currency ?? undefined);
  const origin_currency = trimOrUndef(params.origin_currency ?? undefined);
  const destination_currency = trimOrUndef(
    params.destination_currency ?? undefined,
  );
  if (status) o.status = status;
  if (user_id) o.user_id = user_id;
  if (bank_account_id) o.bank_account_id = bank_account_id;
  if (bank_account_origin_id) o.bank_account_origin_id = bank_account_origin_id;
  if (bank_account_destination_id)
    o.bank_account_destination_id = bank_account_destination_id;
  if (created_at_from) o.created_at_from = created_at_from;
  if (created_at_to) o.created_at_to = created_at_to;
  if (send_date_from) o.send_date_from = send_date_from;
  if (send_date_to) o.send_date_to = send_date_to;
  if (search) o.search = search;
  if (currency) o.currency = currency;
  if (origin_currency) o.origin_currency = origin_currency;
  if (destination_currency) o.destination_currency = destination_currency;
  if (typeof params.skip === "number" && params.skip >= 0) o.skip = params.skip;
  if (typeof params.limit === "number" && params.limit > 0)
    o.limit = params.limit;
  return Object.keys(o).length > 0 ? o : undefined;
}

export function assertCreateTransactionPayload(
  p: CreateTransactionPayload,
): void {
  const missing: string[] = [];
  if (!p.bank_account_destination?.trim()) missing.push("cuenta destino");
  if (!p.user_id?.trim()) missing.push("cliente");
  if (!p.tax_rate_id?.trim()) missing.push("tasa");
  if (!p.commission_id?.trim()) missing.push("comisión");
  if (!p.code?.trim()) missing.push("código");
  if (!Number.isFinite(p.origin_amount) || p.origin_amount < 0) {
    missing.push("monto origen válido");
  }
  if (!Number.isFinite(p.destination_amount) || p.destination_amount < 0) {
    missing.push("monto destino válido");
  }
  if (!p.bank_id?.trim()) missing.push("banco (desde cuenta destino)");
  if (missing.length > 0) {
    throw new Error(`Faltan datos obligatorios: ${missing.join(", ")}`);
  }
}
