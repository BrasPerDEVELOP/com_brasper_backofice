<script setup lang="ts">
import { ref, computed, onMounted, shallowRef, watch } from "vue";
import { useTransactionsStore } from "@modules/transacciones/presentation/controllers/use_transactions_store_controller";
import { useCuentasBancariasStore } from "@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller";
import type { BankAccount } from "@modules/cuentas-bancarias/domain/models";
import type { Transaction } from "@modules/transacciones/domain/models";
import type { GetTransactionsParams } from "@modules/transacciones/infrastructure/adapters/transactions_repository";
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
  isTransactionChecked,
  normalizeTransactionStatus,
  resolveTransactionStatusForDisplay,
  formatTransactionCodeForDisplay,
  localDateInputStartMs,
  localDateInputEndMs,
} from "@modules/transacciones/domain/models";
import AppDropdown from "@/interface/components/AppDropdown.vue";
import AppDateInput from "@/interface/components/AppDateInput.vue";
import { MediaViewerDialog } from "@interface/widgets";
import { Domain } from "@/interface/infrastructure/services";

const transactionsStore = useTransactionsStore();
const cuentasStore = useCuentasBancariasStore();

const searchQuery = ref("");
const statusFilter = ref<string>("todos");
const userFilter = ref<string>("");
const bankAccountFilter = ref<string>("");
const createdAtFrom = ref<string>("");
const createdAtTo = ref<string>("");
const perPage = ref(10);
const currentPage = ref(1);
const updatingCheckedId = ref<string | null>(null);
const showMediaViewer = shallowRef(false);
const mediaViewerSource = shallowRef("");
const mediaViewerTitle = shallowRef("Comprobante");

function openMediaViewer(source: string, title = "Comprobante") {
  const normalizedSource = source.trim();
  if (!normalizedSource) return;
  mediaViewerSource.value = normalizedSource;
  mediaViewerTitle.value = title;
  showMediaViewer.value = true;
}

const statusOptions = computed(() => [
  { value: "todos", label: "Todos" },
  ...TRANSACTION_STATUSES.map((s) => ({
    value: s,
    label: TRANSACTION_STATUS_LABELS[s],
  })),
]);

const ALL_VALUE = "";
const userFilterOptions = computed(() => [
  { value: ALL_VALUE, label: "Todos" },
  ...cuentasStore.clientUsers.map((u) => ({ value: u.id, label: u.name })),
]);

function bankAccountToOption(a: BankAccount) {
  const bank = cuentasStore.banks.find((b) => b.id === a.bank_id);
  const bankName = bank
    ? `${bank.bank}${bank.currency ? ` (${bank.currency})` : ""}`
    : "-";
  const holder =
    (a.account_holder_type ?? "").toLowerCase().includes("juridica") ||
    (a.account_holder_type ?? "").toLowerCase().includes("legal")
      ? (a.business_name ?? "-")
      : [a.holder_names, a.holder_surnames].filter(Boolean).join(" ") || "-";
  const nums = [];
  if (a.account_number?.trim()) nums.push(a.account_number.trim());
  if (a.cci_number?.trim()) nums.push(`CCI: ${a.cci_number.trim()}`);
  if (a.pix_key?.trim()) nums.push(`PIX: ${a.pix_key.trim()}`);
  const accNum = nums.length > 0 ? nums.join(" / ") : "-";
  return { value: a.id, label: `${bankName} - ${accNum} (${holder})` };
}

const bankAccountFilterOptions = computed(() => [
  { value: ALL_VALUE, label: "Todas" },
  ...cuentasStore.bankAccounts.map(bankAccountToOption),
]);

const perPageOptions = [
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

const perPageStr = computed({
  get: () => String(perPage.value),
  set: (v) => {
    perPage.value = Number(v) || 10;
  },
});

const debouncedSearch = ref("");
let searchDebounceId: ReturnType<typeof setTimeout>;
watch(
  searchQuery,
  (q) => {
    clearTimeout(searchDebounceId);
    searchDebounceId = setTimeout(() => {
      debouncedSearch.value = q;
    }, 150);
  },
  { immediate: true },
);

/**
 * Parámetros que se envían al API. El filtrado (estado efectivo, cuenta,
 * rango por `send_date`, búsqueda) y la paginación se resuelven en el servidor.
 */
const apiFilterParams = computed((): GetTransactionsParams => {
  const p: GetTransactionsParams = {
    skip: (currentPage.value - 1) * perPage.value,
    limit: perPage.value,
  };
  if (statusFilter.value && statusFilter.value !== "todos")
    p.status = statusFilter.value;
  if (userFilter.value?.trim()) p.user_id = userFilter.value.trim();
  if (bankAccountFilter.value?.trim())
    p.bank_account_id = bankAccountFilter.value.trim();
  const fromMs = localDateInputStartMs(createdAtFrom.value);
  const toMs = localDateInputEndMs(createdAtTo.value);
  if (fromMs != null) p.send_date_from = new Date(fromMs).toISOString();
  if (toMs != null) p.send_date_to = new Date(toMs).toISOString();
  const q = debouncedSearch.value.trim();
  if (q) p.search = q;
  return p;
});

/** Página actual (ya filtrada y paginada por el servidor). */
const paginatedTransactions = computed(() => transactionsStore.transactions);

const totalResults = computed(() => transactionsStore.total);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalResults.value / perPage.value)),
);

function formatValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "number")
    return value.toLocaleString("es", { minimumFractionDigits: 2 });
  return String(value);
}

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  try {
    const d = new Date(value);
    return d.toLocaleDateString("es");
  } catch {
    return value;
  }
}

/** Contabilidad: moneda PEN como en reportes (S/ 0.00). */
function formatPen(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  return `S/ ${n.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function comisionFinalInterna(t: Transaction): number | undefined {
  const v =
    t.comision_final_interna ??
    t.resultado_comision ??
    t.commission_result;
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const IMPUESTO_INTERNO_RATE = 0.18;

/** 18% de la comisión final interna. */
function impuestoFinalInterno(t: Transaction): number | undefined {
  const c = comisionFinalInterna(t);
  if (c == null) return undefined;
  return Math.round(c * IMPUESTO_INTERNO_RATE * 100) / 100;
}

function ventaFinalMonto(t: Transaction): number | undefined {
  if (t.venta_final != null) {
    const n = Number(t.venta_final);
    if (Number.isFinite(n)) return n;
  }
  const c = comisionFinalInterna(t);
  const i = impuestoFinalInterno(t);
  if (c != null && i != null) return Math.round((c + i) * 100) / 100;
  const tot = t.total_a_enviar ?? t.total_to_send;
  if (tot != null) {
    const n = Number(tot);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Tabla: razón social de la empresa (`company_name` en API). */
function transactionCompanyNameTable(t: Transaction): string {
  const s = t.company_name != null ? String(t.company_name).trim() : "";
  return s || "—";
}

function voucherMediaHref(path: unknown): string {
  if (Array.isArray(path)) {
    const first = path.find((item) => typeof item === "string" && item.trim());
    return first ? voucherMediaHref(first) : "";
  }
  if (path == null || typeof path !== "string") return "";
  const s = path.trim();
  if (!s) return "";
  return Domain.mediaUrl(s);
}

function getStatusLabel(status: string | undefined): string {
  if (!status) return "-";
  const s = normalizeTransactionStatus(status);
  return (
    TRANSACTION_STATUS_LABELS[s as keyof typeof TRANSACTION_STATUS_LABELS] ??
    status
  );
}

function statusRowBadgeClass(status: string | undefined): string {
  const s = normalizeTransactionStatus(status ?? "");
  switch (s) {
    case "verification":
    case "pending":
      return "bg-amber-100 text-amber-900";
    case "verified":
      return "bg-violet-100 text-violet-900";
    case "completed":
      return "bg-emerald-100 text-emerald-900";
    case "failed":
      return "bg-red-100 text-red-800";
    case "checked":
      return "bg-sky-100 text-sky-900";
    case "cancelled":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-[#dbeafe] text-brasper-indigoDark";
  }
}

/** Tabla: solo banco + moneda (sin número de cuenta ni titular). */
function getBankCurrencyTableLabel(id: string | undefined): string {
  if (!id) return "-";
  const acc = cuentasStore.bankAccounts.find((a) => a.id === id);
  if (!acc) return id;
  const bank = cuentasStore.banks.find((b) => b.id === acc.bank_id);
  if (!bank) return "-";
  return bank.currency
    ? `${bank.bank} (${bank.currency})`
    : bank.bank;
}

function getClientLabel(id: string | undefined): string {
  if (!id) return "-";
  const u = cuentasStore.clientUsers.find((u) => u.id === id);
  return u?.name ?? id;
}

function normalizeCurrencyCode(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().toLowerCase();
}

function getBankAccountCurrencyById(id: string | undefined): string {
  if (!id?.trim()) return "";
  const acc = cuentasStore.bankAccounts.find((a) => a.id === id);
  if (!acc) return "";
  const bank = cuentasStore.banks.find((b) => b.id === acc.bank_id);
  return normalizeCurrencyCode(bank?.currency);
}

function getTransactionCurrencies(t: Transaction) {
  const rec = t as Record<string, unknown>;
  return {
    origin:
      normalizeCurrencyCode(rec.origin_currency) ||
      getBankAccountCurrencyById(t.bank_account_origin_id) ||
      getBankAccountCurrencyById(t.bank_account_id),
    destination:
      normalizeCurrencyCode(rec.destination_currency) ||
      getBankAccountCurrencyById(t.bank_account_destination_id),
  };
}

function getTransactionExchangeRate(t: Transaction): number | null {
  const rec = t as Record<string, unknown>;
  const raw = t.tax_amount ?? rec.tipo_cambio ?? rec.rate;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getTransactionExchangeLabel(t: Transaction): string {
  const rate = getTransactionExchangeRate(t);
  if (rate == null) return "—";
  return formatValue(rate);
}

function getTransactionExchangeTitle(t: Transaction): string {
  const { origin, destination } = getTransactionCurrencies(t);
  const from = origin || "—";
  const to = destination || "—";
  const rate = getTransactionExchangeRate(t);
  if (rate != null && from !== "—" && to !== "—") {
    return `1 ${from.toUpperCase()} = ${formatValue(rate)} ${to.toUpperCase()}`;
  }
  if (from !== "—" && to !== "—") return `${from.toUpperCase()} → ${to.toUpperCase()}`;
  return "—";
}

async function toggleChecked(t: Transaction) {
  if (!t.id || updatingCheckedId.value) return;
  const newChecked = !isTransactionChecked(t);
  updatingCheckedId.value = t.id;
  transactionsStore.error = null;
  try {
    await transactionsStore.updateTransaction(t.id, { checked: newChecked });
  } catch {
    // Error en store
  } finally {
    updatingCheckedId.value = null;
  }
}

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value));
}

function loadTransactions() {
  void transactionsStore.loadTransactions(apiFilterParams.value);
}

// Al cambiar filtros/búsqueda/tamaño de página, vuelve a la primera página.
watch(
  [
    statusFilter,
    userFilter,
    bankAccountFilter,
    createdAtFrom,
    createdAtTo,
    debouncedSearch,
    perPage,
  ],
  () => {
    currentPage.value = 1;
  },
);

// Cualquier cambio de filtros o de página recarga desde el servidor.
watch(apiFilterParams, () => loadTransactions(), { deep: true });

onMounted(() => {
  transactionsStore.error = null;
  void loadTransactions();
  void Promise.all([
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadClientUsers(),
    cuentasStore.loadBanks(),
  ]);
});
</script>

<template>
  <div class="space-y-6">
    <div class="mb-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p
            class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong"
          >
            Operaciones
          </p>
          <h1 class="text-2xl font-semibold text-[#232b4d]">Contabilidad</h1>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4 text-sm">
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Estado</label>
          <AppDropdown
            v-model="statusFilter"
            :options="statusOptions"
            placeholder="Todos"
            :searchable="false"
            size="sm"
            min-width="120px"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Cliente</label>
          <AppDropdown
            v-model="userFilter"
            :options="userFilterOptions"
            placeholder="Todos"
            :searchable="userFilterOptions.length > 10"
            size="sm"
            min-width="160px"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Cuenta bancaria</label>
          <AppDropdown
            v-model="bankAccountFilter"
            :options="bankAccountFilterOptions"
            placeholder="Todas"
            :searchable="true"
            size="sm"
            min-width="180px"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Envío desde</label>
          <AppDateInput
            v-model="createdAtFrom"
            size="sm"
            class="min-w-[150px]"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Envío hasta</label>
          <AppDateInput v-model="createdAtTo" size="sm" class="min-w-[150px]" />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Total</label>
          <div
            class="flex h-9 min-w-[3rem] items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm font-medium text-[#374151]"
          >
            {{ totalResults }}
          </div>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <div class="relative min-w-[220px] max-w-sm">
        <svg
          class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por código"
          class="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white py-2.5 pl-10 pr-4 text-sm text-[#374151] placeholder-[#9ca3af] focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
        />
      </div>
    </div>

    <p
      v-if="transactionsStore.error"
      class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]"
    >
      {{ transactionsStore.error }}
    </p>

    <div
      class="relative overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white"
    >
      <div
        v-if="
          transactionsStore.isLoading && transactionsStore.transactions.length === 0
        "
        class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80"
      >
        <span class="text-sm text-[#6b7280]">Cargando...</span>
      </div>
      <div
        v-else-if="transactionsStore.isRefreshing"
        class="pointer-events-none absolute right-3 top-2 z-10"
      >
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#64748b] shadow-sm ring-1 ring-[#e2e8f0]"
        >
          <span
            class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brasper-indigoStrong"
            aria-hidden="true"
          />
          Actualizando…
        </span>
      </div>

      <table class="w-full min-w-[1300px] text-left text-sm">
        <thead>
          <tr class="bg-[#dbeafe]">
            <th class="w-10 px-2 py-3" title="Verificada">
              <span class="sr-only">Verificada</span>
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Código
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Fecha envío
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              N° operación
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Cliente
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Cuenta destino
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Razón social
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 text-center font-semibold text-brasper-indigoDark"
            >
              Monto de envío
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 text-center font-semibold text-brasper-indigoDark"
            >
              Monto a recibir
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Tipo cambio
            </th>
            <th
              class="whitespace-nowrap px-2 py-3 text-right text-[10px] font-bold uppercase leading-tight tracking-wide text-white bg-[#1e3a8a]"
            >
              Comisión<br />final interna
            </th>
            <th
              class="whitespace-nowrap px-2 py-3 text-right text-[10px] font-bold uppercase leading-tight tracking-wide text-white bg-[#1e3a8a]"
            >
              Impuesto<br />final interno
            </th>
            <th
              class="whitespace-nowrap px-2 py-3 text-right text-[10px] font-bold uppercase leading-tight tracking-wide text-white bg-emerald-600"
            >
              Venta final
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Estado
            </th>
            <th
              class="whitespace-nowrap px-2 py-3 text-center text-xs font-semibold leading-tight text-brasper-indigoDark"
              title="Comprobante de envío (imagen)"
            >
              Comp.<br />envío
            </th>
            <th
              class="whitespace-nowrap px-2 py-3 text-center text-xs font-semibold leading-tight text-brasper-indigoDark"
              title="Comprobante de pago (imagen)"
            >
              Comp.<br />pago
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-if="paginatedTransactions.length === 0"
            class="border-t border-[#e5e7eb]"
          >
            <td
              colspan="16"
              class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-6 py-12 text-center text-[#666]"
            >
              {{
                totalResults === 0
                  ? "No hay movimientos que coincidan con los filtros."
                  : "No hay movimientos en esta página."
              }}
            </td>
          </tr>
          <tr
            v-for="t in paginatedTransactions"
            :key="t.id ?? ''"
            class="border-t border-[#e5e7eb] bg-white transition hover:bg-[#f9fafb]"
          >
            <td class="px-2 py-3">
              <button
                type="button"
                class="flex h-6 w-6 items-center justify-center rounded border transition"
                :class="
                  isTransactionChecked(t)
                    ? 'border-brasper-indigoStrong bg-brasper-indigoStrong text-white'
                    : 'border-[#d1d5db] bg-white text-transparent hover:border-[#9ca3af]'
                "
                :disabled="updatingCheckedId === t.id"
                :title="
                  isTransactionChecked(t)
                    ? 'Verificada (clic para desmarcar)'
                    : 'Marcar como verificada'
                "
                @click.stop="toggleChecked(t)"
              >
                <svg
                  v-if="isTransactionChecked(t)"
                  class="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </td>
            <td class="px-4 py-3 font-medium text-[#374151]">
              {{ formatTransactionCodeForDisplay(t.code) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-[#374151]">
              {{ formatDate(t.send_date) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-[#374151]">
              {{ t.operation_number || "—" }}
            </td>
            <td class="max-w-[160px] truncate px-4 py-3 text-[#374151]">
              {{ getClientLabel(t.user_id) }}
            </td>
            <td
              class="max-w-[180px] truncate px-4 py-3 text-[#374151]"
              :title="getBankCurrencyTableLabel(t.bank_account_destination_id)"
            >
              {{ getBankCurrencyTableLabel(t.bank_account_destination_id) }}
            </td>
            <td
              class="max-w-[180px] truncate px-4 py-3 text-[#374151]"
              :title="transactionCompanyNameTable(t)"
            >
              {{ transactionCompanyNameTable(t) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-center tabular-nums text-[#374151]">
              {{ formatValue(t.origin_amount) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-center tabular-nums text-[#374151]">
              {{ formatValue(t.destination_amount) }}
            </td>
            <td
              class="whitespace-nowrap px-4 py-3 tabular-nums text-[#374151]"
              :title="getTransactionExchangeTitle(t)"
            >
              {{ getTransactionExchangeLabel(t) }}
            </td>
            <td
              class="whitespace-nowrap bg-slate-50/80 px-2 py-3 text-right tabular-nums text-[#111827]"
            >
              {{ formatPen(comisionFinalInterna(t)) }}
            </td>
            <td
              class="whitespace-nowrap bg-slate-50/80 px-2 py-3 text-right tabular-nums text-[#111827]"
            >
              {{ formatPen(impuestoFinalInterno(t)) }}
            </td>
            <td
              class="whitespace-nowrap bg-emerald-50/90 px-2 py-3 text-right text-sm font-semibold tabular-nums text-emerald-900"
            >
              {{ formatPen(ventaFinalMonto(t)) }}
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="
                  statusRowBadgeClass(
                    resolveTransactionStatusForDisplay(t) ?? t.status,
                  )
                "
              >
                {{
                  getStatusLabel(
                    resolveTransactionStatusForDisplay(t) ?? t.status,
                  )
                }}
              </span>
            </td>
            <td class="px-2 py-2 align-middle text-center">
              <template v-if="voucherMediaHref(t.send_voucher)">
                <button
                  type="button"
                  class="inline-flex max-w-[5rem] flex-col items-center gap-1"
                  title="Ver comprobante de envío"
                  @click="openMediaViewer(voucherMediaHref(t.send_voucher), 'Comprobante de envío')"
                >
                  <img
                    :src="voucherMediaHref(t.send_voucher)"
                    alt=""
                    class="h-11 w-11 rounded border border-[#e5e7eb] bg-[#f3f4f6] object-cover"
                    loading="lazy"
                    @error="
                      ($event.target as HTMLImageElement).style.display =
                        'none'
                    "
                  />
                  <span
                    class="text-[10px] font-medium leading-tight text-brasper-indigoStrong underline decoration-transparent hover:decoration-current"
                  >
                    Abrir
                  </span>
                </button>
              </template>
              <span v-else class="text-[#9ca3af]">—</span>
            </td>
            <td class="px-2 py-2 align-middle text-center">
              <template v-if="voucherMediaHref(t.payment_voucher)">
                <button
                  type="button"
                  class="inline-flex max-w-[5rem] flex-col items-center gap-1"
                  title="Ver comprobante de pago"
                  @click="openMediaViewer(voucherMediaHref(t.payment_voucher), 'Comprobante de pago')"
                >
                  <img
                    :src="voucherMediaHref(t.payment_voucher)"
                    alt=""
                    class="h-11 w-11 rounded border border-[#e5e7eb] bg-[#f3f4f6] object-cover"
                    loading="lazy"
                    @error="
                      ($event.target as HTMLImageElement).style.display =
                        'none'
                    "
                  />
                  <span
                    class="text-[10px] font-medium leading-tight text-brasper-indigoStrong underline decoration-transparent hover:decoration-current"
                  >
                    Abrir
                  </span>
                </button>
              </template>
              <span v-else class="text-[#9ca3af]">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="totalResults > 0"
      class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e5e7eb] pt-4"
    >
      <div class="flex items-center gap-4 text-sm text-[#6b7280]">
        <span>Página {{ currentPage }} de {{ totalPages }}</span>
        <AppDropdown
          v-model="perPageStr"
          :options="perPageOptions"
          placeholder="10"
          :searchable="false"
          size="sm"
          min-width="3rem"
        />
      </div>
      <div class="flex items-center gap-2 text-sm text-[#6b7280]">
        <span>{{ totalResults }} resultados</span>
        <div class="flex gap-1">
          <button
            type="button"
            class="rounded p-2 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
            :disabled="currentPage <= 1"
            @click="goToPage(1)"
          >
            &laquo;
          </button>
          <button
            type="button"
            class="rounded p-2 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
            :disabled="currentPage <= 1"
            @click="goToPage(currentPage - 1)"
          >
            &lsaquo;
          </button>
          <button
            type="button"
            class="rounded p-2 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
            :disabled="currentPage >= totalPages"
            @click="goToPage(currentPage + 1)"
          >
            &rsaquo;
          </button>
          <button
            type="button"
            class="rounded p-2 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-40"
            :disabled="currentPage >= totalPages"
            @click="goToPage(totalPages)"
          >
            &raquo;
          </button>
        </div>
      </div>
    </div>

    <MediaViewerDialog
      v-model="showMediaViewer"
      :source="mediaViewerSource"
      :title="mediaViewerTitle"
    />
  </div>
</template>
