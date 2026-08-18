import type { Transaction } from "../../domain/models";
import {
  TRANSACTION_STATUS_LABELS,
  isTransactionChecked,
  resolveTransactionStatusForDisplay,
  formatTransactionCodeForDisplay,
  SPECIAL_CALCULATOR_DISCOUNT_CODE,
  isSpecialCalculatorDiscountCode,
  getTransactionSpecialDiscountInfo,
} from "../../domain/models";
import { useTasasStore } from "@modules/tasas/presentation/controllers/use_tasas_store_controller";
import { useComisionesStore } from "@modules/comisiones/presentation/controllers/use_comisiones_store_controller";
import { useCuentasBancariasStore } from "@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller";
import type { BankAccount } from "@modules/cuentas-bancarias/domain/models";

export type PreviewItemVariant = "default" | "mono" | "status" | "separator";

export type PreviewItem = {
  label: string;
  value: string;
  variant?: PreviewItemVariant;
};

export type PreviewSection = {
  id: string;
  title: string;
  subtitle?: string;
  items: PreviewItem[];
};

/** Fila estructurada de una cuenta destino para el preview (multicuentas). */
export type PreviewDestinationRow = {
  position: number;
  bankLabel: string;
  identifiers: Array<{
    label: "Cuenta" | "CCI" | "PIX" | "DNI" | "RUC" | "CPF" | "CNPJ";
    value: string;
  }>;
  /** Titular de la cuenta (usuario o razón social según el tipo). */
  holderLabel: string;
  amountLabel: string;
  /** Porcentaje del total a recibir; null con una sola cuenta. */
  shareLabel: string | null;
};

export type PreviewDestinationsSummary = {
  rows: PreviewDestinationRow[];
  totalLabel: string;
};

const SKIP_KEYS = new Set([
  "send_voucher",
  "payment_voucher",
  "bank_account_id",
]);

function formatMoney(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number")
    return value.toLocaleString("es", { minimumFractionDigits: 2 });
  return String(value);
}

function formatMoneyWithCurrency(value: unknown, currency: string): string {
  const amount = formatMoney(value);
  const code = currency.trim().toUpperCase();
  return code && amount !== "—" ? `${amount} ${code}` : amount;
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("es");
  } catch {
    return value;
  }
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export function useTransactionPreviewController() {
  const tasasStore = useTasasStore();
  const comisionesStore = useComisionesStore();
  const cuentasStore = useCuentasBancariasStore();

  function bankAccountBankLabel(a: BankAccount): string {
    const bank = cuentasStore.banks.find((b) => b.id === a.bank_id);
    return bank
      ? `${bank.bank}${bank.currency ? ` (${bank.currency})` : ""}`
      : "—";
  }

  function bankAccountHolderLabel(a: BankAccount): string {
    const type = (a.account_holder_type ?? "").toLowerCase();
    if (
      type.includes("juridica") ||
      type.includes("jurídica") ||
      type.includes("legal")
    ) {
      return (a.business_name ?? "").trim() || "—";
    }
    return (
      [a.holder_names, a.holder_surnames].filter(Boolean).join(" ").trim() ||
      "—"
    );
  }

  function bankAccountNumbersLabel(a: BankAccount): string {
    const nums = [];
    if (a.account_number?.trim()) nums.push(a.account_number.trim());
    if (a.cci_number?.trim()) nums.push(`CCI: ${a.cci_number.trim()}`);
    if (a.pix_key?.trim()) nums.push(`PIX: ${a.pix_key.trim()}`);
    return nums.length > 0 ? nums.join(" / ") : "—";
  }

  function bankAccountDocumentIdentifier(
    a: BankAccount,
  ): PreviewDestinationRow["identifiers"][number] | null {
    const holderType = (a.account_holder_type ?? "").toLowerCase();
    const isLegal =
      holderType.includes("juridica") ||
      holderType.includes("jurídica") ||
      holderType.includes("legal");
    const isBrazil = (a.bank_country ?? "").trim().toLowerCase() === "br";

    if (isLegal && a.ruc_number?.trim()) {
      return {
        label: isBrazil ? "CNPJ" : "RUC",
        value: a.ruc_number.trim(),
      };
    }
    if (isBrazil && a.cpf?.trim()) {
      return { label: "CPF", value: a.cpf.trim() };
    }
    if (a.document_number?.trim()) {
      return { label: "DNI", value: a.document_number.trim() };
    }
    if (a.cpf?.trim()) return { label: "CPF", value: a.cpf.trim() };
    if (a.ruc_number?.trim()) {
      return {
        label: isBrazil ? "CNPJ" : "RUC",
        value: a.ruc_number.trim(),
      };
    }
    return null;
  }

  function bankAccountToLabel(a: BankAccount): string {
    return `${bankAccountBankLabel(a)} - ${bankAccountNumbersLabel(a)} (${bankAccountHolderLabel(a)})`;
  }

  function getBankLabel(id: string | undefined): string {
    if (!id?.trim()) return "—";
    const acc = cuentasStore.bankAccounts.find((a) => a.id === id);
    return acc ? bankAccountToLabel(acc) : "—";
  }

  function getBankAccountCurrency(id: string | undefined): string {
    if (!id?.trim()) return "";
    const acc = cuentasStore.bankAccounts.find((a) => a.id === id);
    if (!acc?.bank_id?.trim()) return "";
    const bank = cuentasStore.banks.find((b) => b.id === acc.bank_id);
    return String(bank?.currency ?? "").trim().toUpperCase();
  }

  function getTransactionCurrencies(rec: Record<string, unknown>) {
    const rateId = String(rec.tax_rate_id ?? "").trim();
    const rate = tasasStore.taxRates.find((x) => x.id === rateId);
    return {
      origin:
        String(rate?.coin_a ?? rec.origin_currency ?? "").trim().toUpperCase() ||
        getBankAccountCurrency(rec.bank_account_origin_id as string),
      destination:
        String(rate?.coin_b ?? rec.destination_currency ?? "").trim().toUpperCase() ||
        getBankAccountCurrency(rec.bank_account_destination_id as string),
    };
  }

  function getClientLabel(id: string | undefined): string {
    if (!id?.trim()) return "—";
    const u =
      cuentasStore.transactionFormUsers.find((x) => x.id === id) ??
      cuentasStore.clientUsers.find((x) => x.id === id);
    return u?.name ?? "—";
  }

  function getStatusLabel(status: string | undefined): string {
    if (!status) return "—";
    const s = status.toLowerCase().trim();
    if (s in TRANSACTION_STATUS_LABELS)
      return TRANSACTION_STATUS_LABELS[
        s as keyof typeof TRANSACTION_STATUS_LABELS
      ];
    const esToKey: Record<string, keyof typeof TRANSACTION_STATUS_LABELS> = {
      verificada: "checked",
      "en verificación": "verification",
      verificado: "verified",
      pendiente: "pending",
      completado: "completed",
      finalizado: "completed",
      finalizada: "completed",
      fallido: "failed",
      cancelado: "cancelled",
    };
    const k = esToKey[s];
    if (k) return TRANSACTION_STATUS_LABELS[k];
    return status;
  }

  function getTaxRateLabel(id: string | undefined): string {
    if (!id?.trim()) return "—";
    const r = tasasStore.taxRates.find((x) => x.id === id);
    return r ? `${r.coin_a}-${r.coin_b} (${r.tax})` : "—";
  }

  function getCommissionLabel(id: string | undefined): string {
    if (!id?.trim()) return "—";
    const c = comisionesStore.commissions.find((x) => x.id === id);
    return c ? `${c.coin_a}-${c.coin_b} (${c.percentage}%)` : "—";
  }

  async function ensurePreviewCatalogLoaded(): Promise<void> {
    const maybe = async (needsLoad: boolean, fn: () => Promise<unknown>) => {
      if (!needsLoad) return;
      try {
        await fn();
      } catch {
        /* catálogo parcial: la UI muestra UUIDs como respaldo */
      }
    };
    await Promise.all([
      maybe(tasasStore.taxRates.length === 0, () =>
        tasasStore.loadTaxRates(),
      ),
      maybe(comisionesStore.commissions.length === 0, () =>
        comisionesStore.loadCommissions(),
      ),
      maybe(cuentasStore.bankAccounts.length === 0, () =>
        cuentasStore.loadBankAccounts(),
      ),
      maybe(cuentasStore.transactionFormUsers.length === 0, () =>
        cuentasStore.loadTransactionFormUsers(),
      ),
      maybe(cuentasStore.banks.length === 0, () => cuentasStore.loadBanks()),
    ]);
  }

  /**
   * Cuentas destino estructuradas (banco, número, titular, monto y % del total).
   * Con transacciones legacy sin `destinations`, cae a la cuenta destino única.
   */
  function buildPreviewDestinations(t: Transaction): PreviewDestinationsSummary {
    const rec = t as Record<string, unknown>;
    const currencies = getTransactionCurrencies(rec);
    const total = Number(rec.destination_amount) || 0;

    const stored = Array.isArray(rec.destinations)
      ? rec.destinations
          .map((item) => {
            if (item == null || typeof item !== "object") return null;
            const destination = item as Record<string, unknown>;
            const accountId = String(destination.bank_account_id ?? "").trim();
            if (!accountId) return null;
            return { accountId, amount: Number(destination.amount) };
          })
          .filter((item): item is { accountId: string; amount: number } =>
            Boolean(item),
          )
      : [];

    const fallbackId = String(rec.bank_account_destination_id ?? "").trim();
    const items =
      stored.length > 0
        ? stored
        : fallbackId
          ? [{ accountId: fallbackId, amount: total }]
          : [];

    // Snapshot del banco destino que la transacción ya trae del API. Sirve de
    // respaldo cuando este operador no tiene la cuenta en sus catálogos —caso
    // típico de una fila recibida por WebSocket—, donde antes se mostraba el
    // UUID de la cuenta. Sólo aplica a la cuenta única: con reparto entre varias
    // el snapshot no distingue a cuál corresponde.
    const snapshotBankName =
      items.length === 1 && rec.bank_name != null
        ? String(rec.bank_name).trim()
        : "";

    const rows = items.map((item, index) => {
      const acc = cuentasStore.bankAccounts.find(
        (candidate) => candidate.id === item.accountId,
      );
      const amountValid = Number.isFinite(item.amount);
      const documentIdentifier = acc
        ? bankAccountDocumentIdentifier(acc)
        : null;
      const share =
        items.length > 1 && total > 0 && amountValid
          ? Math.round((item.amount / total) * 100)
          : null;
      return {
        position: index + 1,
        bankLabel: acc
          ? bankAccountBankLabel(acc)
          : snapshotBankName || "—",
        identifiers: acc
          ? [
              ...(acc.account_number?.trim()
                ? [{ label: "Cuenta" as const, value: acc.account_number.trim() }]
                : []),
              ...(acc.cci_number?.trim()
                ? [{ label: "CCI" as const, value: acc.cci_number.trim() }]
                : []),
              ...(acc.pix_key?.trim()
                ? [{ label: "PIX" as const, value: acc.pix_key.trim() }]
                : []),
              ...(documentIdentifier ? [documentIdentifier] : []),
            ]
          : [],
        holderLabel: acc ? bankAccountHolderLabel(acc) : "—",
        amountLabel: amountValid
          ? formatMoneyWithCurrency(item.amount, currencies.destination)
          : "—",
        shareLabel: share != null ? `${share}%` : null,
      };
    });

    return {
      rows,
      totalLabel: formatMoneyWithCurrency(total, currencies.destination),
    };
  }

  function buildPreviewSections(t: Transaction): PreviewSection[] {
    const rec = t as Record<string, unknown>;
    const sections: PreviewSection[] = [];

    const code = (rec.code as string) ?? "";
    const status = rec.status as string | undefined;
    const isVerified = isTransactionChecked(t);

    sections.push({
      id: "resumen",
      title: "Resumen",
      subtitle: "Identificación y estado",
      items: [
        {
          label: "Código",
          value: formatTransactionCodeForDisplay(code),
          variant: "mono",
        },
        {
          label: "Estado",
          value: getStatusLabel(
            resolveTransactionStatusForDisplay(t) ?? status,
          ),
          variant: "status",
        },
        {
          label: "Verificada",
          value: isVerified ? "Sí" : "No",
        },
        {
          label: "Ventas / asesor",
          value: getClientLabel(rec.agent_id as string),
        },
        {
          label: "N.º operación",
          value:
            rec.operation_number != null && String(rec.operation_number).trim()
              ? String(rec.operation_number).trim()
              : "—",
          variant: "mono",
        },
      ],
    });

    const razonSocial = typeof rec.company_name === "string" ? rec.company_name.trim() : "";

    // Las cuentas destino se muestran estructuradas vía buildPreviewDestinations.
    sections.push({
      id: "participantes",
      title: "Participantes",
      subtitle: "Cliente y razón social",
      items: [
        { label: "Cliente", value: getClientLabel(rec.user_id as string) },
        { label: "Razón social", value: razonSocial || "—" },
        {
          label: "Cuenta origen",
          value: getBankLabel(rec.bank_account_origin_id as string),
        },
      ],
    });

    sections.push({
      id: "condiciones",
      title: "Condiciones comerciales",
      subtitle: "Tasa y comisión aplicadas",
      items: [
        {
          label: "Tasa",
          value: getTaxRateLabel(rec.tax_rate_id as string),
        },
        {
          label: "Comisión",
          value: getCommissionLabel(rec.commission_id as string),
        },
      ],
    });

    const hasSpecialDiscount = Boolean(
      getTransactionSpecialDiscountInfo(rec as Transaction, {
        commissions: comisionesStore.commissions,
        taxRates: tasasStore.taxRates,
      }),
    );
    const hasCoupon = Boolean(
      !hasSpecialDiscount &&
        (rec.coupon_id ||
          (rec.coupon_discount_code && String(rec.coupon_discount_code).trim())),
    );
    const specialDiscount = hasSpecialDiscount
      ? getTransactionSpecialDiscountInfo(rec as Transaction, {
          commissions: comisionesStore.commissions,
          taxRates: tasasStore.taxRates,
        })
      : null;
    const currencies = getTransactionCurrencies(rec);

    // Montos finales: si hay cupón se usan los valores ajustados
    const displayOrigin = hasCoupon && rec.coupon_origin_amount != null && rec.coupon_origin_amount !== ""
      ? rec.coupon_origin_amount
      : rec.origin_amount;
    const displayDestination = hasCoupon && rec.coupon_destination_amount != null && rec.coupon_destination_amount !== ""
      ? rec.coupon_destination_amount
      : rec.destination_amount;

    const from = currencies.origin || "?";
    const to = currencies.destination || "?";

    // Flujo de remesa: envías → tipo de cambio → recibe | comisión → cupón → total
    const amountItems: PreviewItem[] = [
      {
        label: "Envías",
        value: formatMoneyWithCurrency(displayOrigin, currencies.origin),
      },
    ];

    if (rec.tax_amount != null && rec.tax_amount !== "") {
      amountItems.push({
        label: "Tipo de cambio",
        value: `1 ${from} = ${formatMoney(rec.tax_amount)} ${to}`,
      });
    }

    amountItems.push({
      label: "El destinatario recibe",
      value: formatMoneyWithCurrency(displayDestination, currencies.destination),
    });

    if (
      specialDiscount &&
      specialDiscount.improvementReceive > 0.005
    ) {
      amountItems.push({
        label: "Recibe base (catálogo)",
        value: formatMoneyWithCurrency(
          specialDiscount.baseReceive,
          currencies.destination,
        ),
      });
      amountItems.push({
        label: "Mejora calculadora especial",
        value: `+${formatMoneyWithCurrency(
          specialDiscount.improvementReceive,
          currencies.destination,
        )}`,
      });
    }

    // Separador visual entre el bloque de conversión y el bloque de fees
    amountItems.push({ label: "", value: "", variant: "separator" });

    // Comisión (base si hay cupón)
    const commissionRes = rec.resultado_comision ?? rec.commission_result ?? null;
    if (commissionRes != null && commissionRes !== "")
      amountItems.push({
        label:
          hasCoupon || hasSpecialDiscount ? "Comisión (aplicada)" : "Comisión",
        value: formatMoneyWithCurrency(commissionRes, currencies.origin),
      });

    if (
      specialDiscount &&
      specialDiscount.discountCommission > 0.005
    ) {
      amountItems.push({
        label: "Comisión base (catálogo)",
        value: formatMoneyWithCurrency(
          specialDiscount.baseCommission,
          currencies.origin,
        ),
      });
      amountItems.push({
        label: `Calculadora especial (${SPECIAL_CALCULATOR_DISCOUNT_CODE})`,
        value: `-${formatMoneyWithCurrency(
          specialDiscount.discountCommission,
          currencies.origin,
        )}`,
      });
    }

    // Descuento cupón
    if (hasCoupon && rec.coupon_discount_commission != null && rec.coupon_discount_commission !== "") {
      const code = rec.coupon_discount_code ? ` ${String(rec.coupon_discount_code).trim()}` : "";
      amountItems.push({
        label: `Cupón${code}`,
        value: `-${formatMoneyWithCurrency(rec.coupon_discount_commission, currencies.origin)}`,
      });
    }

    sections.push({
      id: "importes",
      title: "Importes",
      items: amountItems,
    });

    sections.push({
      id: "fechas",
      title: "Fechas",
      subtitle: "Operación y registro",
      items: [
        {
          label: "Fecha envío",
          value: formatDate(rec.send_date as string),
        },
        {
          label: "Fecha pago",
          value: formatDate(rec.payment_date as string),
        },
        {
          label: "Creado",
          value: formatDateTime(rec.created_at as string),
        },
        {
          label: "Actualizado",
          value: formatDateTime(rec.updated_at as string),
        },
      ],
    });

    const registroItems: PreviewItem[] = [];
    if (hasSpecialDiscount) {
      registroItems.push({
        label: "Calculadora especial",
        value: SPECIAL_CALCULATOR_DISCOUNT_CODE,
      });
    } else if (
      rec.coupon_discount_code != null &&
      rec.coupon_discount_code !== "" &&
      !isSpecialCalculatorDiscountCode(String(rec.coupon_discount_code))
    ) {
      registroItems.push({
        label: "Cupón aplicado",
        value: String(rec.coupon_discount_code),
      });
    }

    if (registroItems.length > 0) {
      sections.push({
        id: "registro",
        title: "Registro",
        items: registroItems,
      });
    }

    const seen = new Set<string>([
      "code",
      "status",
      "checked",
      "user_id",
      "agent_id",
      "user",
      "bank_account_origin_id",
      "bank_account_destination_id",
      "tax_rate_id",
      "commission_id",
      "tax_amount",
      "origin_amount",
      "destination_amount",
      "resultado_comision",
      "commission_result",
      "comision_final_interna",
      "impuesto_final_interno",
      "venta_final",
      "fecha_emision",
      "observaciones",
      "dias_atraso",
      "total_a_enviar",
      "total_to_send",
      "send_date",
      "payment_date",
      "created_at",
      "updated_at",
      "id",
      "created_by",
      "coupon_id",
      "coupon_discount_code",
      "coupon_origin_amount",
      "coupon_destination_amount",
      "coupon_discount_percentage",
      "coupon_discount_commission",
      "coupon_discount_total_to_send",
      "send_voucher",
      "payment_voucher",
      "checked_image",
      "bank_account_id",
      // Ya representados en otras secciones del preview (comprobantes,
      // participantes, resumen); no repetirlos como texto crudo.
      "send_vouchers",
      "payment_vouchers",
      "checked_images",
      "send_voucher_files",
      "payment_voucher_files",
      "checked_image_files",
      "destinations",
      "bank_id",
      "bank_name",
      "company_name",
      "social_reason_bank_id",
      "operation_number",
      "numero_operacion",
      "agent",
    ]);

    const extra: PreviewItem[] = [];
    for (const key of Object.keys(rec)) {
      if (key.startsWith("_") || seen.has(key) || SKIP_KEYS.has(key))
        continue;
      const val = rec[key];
      if (val == null || val === "") continue;
      extra.push({
        label: key,
        value:
          typeof val === "object" ? JSON.stringify(val) : String(val),
        variant: "mono",
      });
    }
    if (extra.length > 0) {
      sections.push({
        id: "extra",
        title: "Otros campos",
        subtitle: "Datos adicionales devueltos por la API",
        items: extra,
      });
    }

    return sections;
  }

  return {
    ensurePreviewCatalogLoaded,
    buildPreviewSections,
    buildPreviewDestinations,
  };
}
