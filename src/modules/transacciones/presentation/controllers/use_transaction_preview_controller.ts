import type { Transaction } from "../../domain/models";
import {
  TRANSACTION_STATUS_LABELS,
  isTransactionChecked,
  resolveTransactionStatusForDisplay,
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

function formatTransactionCodeShort(code: string | undefined): string {
  if (!code?.trim()) return "—";
  const digits = code.replace(/\D/g, "");
  if (digits.length > 0) return digits.slice(-4).padStart(4, "0");
  return code.trim().slice(-4);
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

  function bankAccountToLabel(a: BankAccount): string {
    const bank = cuentasStore.banks.find((b) => b.id === a.bank_id);
    const bankName = bank
      ? `${bank.bank}${bank.currency ? ` (${bank.currency})` : ""}`
      : "—";
    const holder =
      (a.account_holder_type ?? "").toLowerCase().includes("juridica") ||
      (a.account_holder_type ?? "").toLowerCase().includes("legal")
        ? (a.business_name ?? "—")
        : [a.holder_names, a.holder_surnames].filter(Boolean).join(" ") ||
          "—";
    const nums = [];
    if (a.account_number?.trim()) nums.push(a.account_number.trim());
    if (a.cci_number?.trim()) nums.push(`CCI: ${a.cci_number.trim()}`);
    if (a.pix_key?.trim()) nums.push(`PIX: ${a.pix_key.trim()}`);
    const accNum = nums.length > 0 ? nums.join(" / ") : "—";
    return `${bankName} - ${accNum} (${holder})`;
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
          value: formatTransactionCodeShort(code),
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
      ],
    });

    const razonSocial = typeof rec.company_name === "string" ? rec.company_name.trim() : "";

    sections.push({
      id: "participantes",
      title: "Participantes",
      subtitle: "Cliente y cuentas vinculadas",
      items: [
        { label: "Cliente", value: getClientLabel(rec.user_id as string) },
        { label: "Razón social", value: razonSocial || "—" },
        {
          label: "Cuenta destino",
          value: getBankLabel(rec.bank_account_destination_id as string),
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

    const hasCoupon = Boolean(
      rec.coupon_id ||
        (rec.coupon_discount_code && String(rec.coupon_discount_code).trim()),
    );
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

    // Separador visual entre el bloque de conversión y el bloque de fees
    amountItems.push({ label: "", value: "", variant: "separator" });

    // Comisión (base si hay cupón)
    const commissionRes = rec.resultado_comision ?? rec.commission_result ?? null;
    if (commissionRes != null && commissionRes !== "")
      amountItems.push({
        label: hasCoupon ? "Comisión (base)" : "Comisión",
        value: formatMoneyWithCurrency(commissionRes, currencies.origin),
      });

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
    if (rec.coupon_discount_code != null && rec.coupon_discount_code !== "")
      registroItems.push({
        label: "Cupón aplicado",
        value: String(rec.coupon_discount_code),
      });

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
  };
}
