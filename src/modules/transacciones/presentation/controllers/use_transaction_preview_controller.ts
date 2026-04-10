import type { Transaction } from "../../domain/models";
import { TRANSACTION_STATUS_LABELS } from "../../domain/models";
import { useTasasStore } from "@modules/tasas/presentation/controllers/use_tasas_store_controller";
import { useComisionesStore } from "@modules/comisiones/presentation/controllers/use_comisiones_store_controller";
import { useCuentasBancariasStore } from "@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller";
import type { BankAccount } from "@modules/cuentas-bancarias/domain/models";

export type PreviewItemVariant = "default" | "mono" | "status";

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
    const accNum = a.account_number ?? "—";
    return `${bankName} - ${accNum} (${holder})`;
  }

  function getBankLabel(id: string | undefined): string {
    if (!id?.trim()) return "—";
    const acc = cuentasStore.bankAccounts.find((a) => a.id === id);
    return acc ? bankAccountToLabel(acc) : id;
  }

  function getClientLabel(id: string | undefined): string {
    if (!id?.trim()) return "—";
    const u = cuentasStore.clientUsers.find((x) => x.id === id);
    return u?.name ?? id;
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
      pendiente: "pending",
      completado: "completed",
      finalizado: "completed",
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
    return r ? `${r.coin_a}-${r.coin_b} (${r.tax})` : id;
  }

  function getCommissionLabel(id: string | undefined): string {
    if (!id?.trim()) return "—";
    const c = comisionesStore.commissions.find((x) => x.id === id);
    return c ? `${c.coin_a}-${c.coin_b} (${c.percentage}%)` : id;
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
      maybe(cuentasStore.clientUsers.length === 0, () =>
        cuentasStore.loadClientUsers(),
      ),
      maybe(cuentasStore.banks.length === 0, () => cuentasStore.loadBanks()),
    ]);
  }

  function buildPreviewSections(t: Transaction): PreviewSection[] {
    const rec = t as Record<string, unknown>;
    const sections: PreviewSection[] = [];

    const code = (rec.code as string) ?? "";
    const status = rec.status as string | undefined;
    const checked = rec.checked;

    sections.push({
      id: "resumen",
      title: "Resumen",
      subtitle: "Identificación y estado",
      items: [
        {
          label: "Código",
          value: code || "—",
          variant: "mono",
        },
        {
          label: "Estado",
          value: getStatusLabel(status),
          variant: "status",
        },
        {
          label: "Verificada",
          value:
            checked === true || String(status).toLowerCase() === "checked"
              ? "Sí"
              : "No",
        },
      ],
    });

    sections.push({
      id: "participantes",
      title: "Participantes",
      subtitle: "Cliente y cuentas vinculadas",
      items: [
        { label: "Cliente", value: getClientLabel(rec.user_id as string) },
        {
          label: "Cuenta origen",
          value: getBankLabel(rec.bank_account_origin_id as string),
        },
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

    const amountItems: PreviewItem[] = [
      {
        label: "Monto origen",
        value: formatMoney(rec.origin_amount),
      },
      {
        label: "Monto destino",
        value: formatMoney(rec.destination_amount),
      },
    ];
    const commissionRes =
      rec.resultado_comision ?? rec.commission_result ?? null;
    if (commissionRes != null && commissionRes !== "")
      amountItems.push({
        label: "Resultado comisión",
        value: formatMoney(commissionRes),
      });
    const totalSend = rec.total_a_enviar ?? rec.total_to_send ?? null;
    if (totalSend != null && totalSend !== "")
      amountItems.push({
        label: "Total a enviar",
        value: formatMoney(totalSend),
      });

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

    const registroItems: PreviewItem[] = [
      {
        label: "ID transacción",
        value: (rec.id as string) || "—",
        variant: "mono",
      },
    ];
    if (rec.created_by != null && rec.created_by !== "")
      registroItems.push({
        label: "Creado por",
        value: String(rec.created_by),
        variant: "mono",
      });
    if (rec.coupon_id != null && rec.coupon_id !== "")
      registroItems.push({
        label: "Cupón",
        value: String(rec.coupon_id),
        variant: "mono",
      });

    sections.push({
      id: "registro",
      title: "Registro",
      subtitle: "Identificadores internos",
      items: registroItems,
    });

    const seen = new Set<string>([
      "code",
      "status",
      "checked",
      "user_id",
      "bank_account_origin_id",
      "bank_account_destination_id",
      "tax_rate_id",
      "commission_id",
      "origin_amount",
      "destination_amount",
      "resultado_comision",
      "commission_result",
      "total_a_enviar",
      "total_to_send",
      "send_date",
      "payment_date",
      "created_at",
      "updated_at",
      "id",
      "created_by",
      "coupon_id",
      "send_voucher",
      "payment_voucher",
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
