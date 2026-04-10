<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  reactive,
  watch,
  nextTick,
} from "vue";
import type { Ref } from "vue";
import { useTransactionsStore } from "../controllers/use_transactions_store_controller";
import { useCuentasBancariasStore } from "@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller";
import { useTasasStore } from "@modules/tasas/presentation/controllers/use_tasas_store_controller";
import { useComisionesStore } from "@modules/comisiones/presentation/controllers/use_comisiones_store_controller";
import { useCalculatorStore } from "@modules/calculator/presentation/controllers/use_calculator_store_controller";
import type { BankAccount } from "@modules/cuentas-bancarias/domain/models";
import type { Transaction } from "../../domain/models";
import type { GetTransactionsParams } from "../../infrastructure/adapters/transactions_repository";
import { parseSimpleImportExcel } from "../../infrastructure/utils/excel_simple_import";
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
} from "../../domain/models";
import AppDropdown from "@/interface/components/AppDropdown.vue";
import AppDateInput from "@/interface/components/AppDateInput.vue";
import CalculatorConversionCard from "@modules/calculator/presentation/components/CalculatorConversionCard.vue";
import { Domain } from "@/interface/infrastructure/services";
import { useTransactionPreviewController } from "../controllers/use_transaction_preview_controller";

const transactionsStore = useTransactionsStore();
const cuentasStore = useCuentasBancariasStore();
const tasasStore = useTasasStore();
const comisionesStore = useComisionesStore();
const calculatorStore = useCalculatorStore();

const { ensurePreviewCatalogLoaded, buildPreviewSections } =
  useTransactionPreviewController();

const showCreateModal = ref(false);
const showImportModal = ref(false);
const showImportSimpleModal = ref(false);
const importSimpleFile = ref<File | null>(null);
const fileInputSimple = ref<HTMLInputElement | null>(null);
const importingSimple = ref(false);
const importSimpleError = ref("");
const showPreviewModal = ref(false);
const previewTransaction = ref<Transaction | null>(null);
const previewLoading = ref(false);
const searchQuery = ref("");
const openMenuId = ref<string | null>(null);
const menuTriggerEl = ref<HTMLElement | null>(null);
const menuPosition = reactive({ top: 0, left: 0 });
const statusFilter = ref<string>("todos");
const userFilter = ref<string>("");
const bankAccountFilter = ref<string>("");
const createdAtFrom = ref<string>("");
const createdAtTo = ref<string>("");
const perPage = ref(10);
const currentPage = ref(1);
const fileInput = ref<HTMLInputElement | null>(null);
const importFile = ref<File | null>(null);
const deletingId = ref<string | null>(null);
const updatingCheckedId = ref<string | null>(null);

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

const bankAccountFilterOptions = computed(() => [
  { value: ALL_VALUE, label: "Todas" },
  ...cuentasStore.bankAccounts.map((a) => {
    const bank = cuentasStore.banks.find((b) => b.id === a.bank_id);
    const bankName = bank
      ? `${bank.bank}${bank.currency ? ` (${bank.currency})` : ""}`
      : "-";
    const holder =
      (a.account_holder_type ?? "").toLowerCase().includes("juridica") ||
      (a.account_holder_type ?? "").toLowerCase().includes("legal")
        ? (a.business_name ?? "-")
        : [a.holder_names, a.holder_surnames].filter(Boolean).join(" ") || "-";
    const accNum = a.account_number ?? "-";
    return { value: a.id, label: `${bankName} - ${accNum} (${holder})` };
  }),
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

const form = reactive<{
  bank_account_origin_id: string;
  bank_account_destination_id: string;
  user_id: string;
  tax_rate_id: string;
  commission_id: string;
  status: string;
  checked: boolean;
  origin_amount: number;
  destination_amount: number;
  resultado_comision: number | null;
  total_a_enviar: number | null;
  code: string;
  send_date: string;
  payment_date: string;
  send_voucher: string | File | null;
  payment_voucher: string | File | null;
}>({
  bank_account_origin_id: "",
  bank_account_destination_id: "",
  user_id: "",
  tax_rate_id: "",
  commission_id: "",
  status: "pending",
  checked: false,
  origin_amount: 0,
  destination_amount: 0,
  resultado_comision: null,
  total_a_enviar: null,
  code: "",
  send_date: "",
  payment_date: "",
  send_voucher: null,
  payment_voucher: null,
});

const editingId = ref<string | null>(null);

const CREATE_FLOW_STEPS = [
  {
    key: "calculadora" as const,
    title: "Cotización",
    subtitle: "Montos y tipo de cambio",
  },
  {
    key: "datos" as const,
    title: "Datos",
    subtitle: "Cliente y cuentas",
  },
  {
    key: "vouchers" as const,
    title: "Comprobantes",
    subtitle: "Vouchers opcionales",
  },
] as const;

const createStepIndex = ref(0);

const isLastCreateStep = computed(
  () => createStepIndex.value === CREATE_FLOW_STEPS.length - 1,
);

function goToCreateStep(index: number) {
  if (index < 0 || index >= CREATE_FLOW_STEPS.length) return;
  if (index > createStepIndex.value) return;
  createStepIndex.value = index;
  if (transactionsStore.error) transactionsStore.error = null;
}

function goCreateNext() {
  const i = createStepIndex.value;
  if (i === 0) {
    syncFromCalculator();
    if (
      !form.tax_rate_id?.trim() ||
      !form.commission_id?.trim() ||
      (Number(form.origin_amount) <= 0 && Number(form.destination_amount) <= 0)
    ) {
      transactionsStore.error =
        "Completa la cotización: montos y tasa/comisión antes de continuar.";
      return;
    }
    transactionsStore.error = null;
    createStepIndex.value = 1;
    return;
  }
  if (i === 1) {
    if (
      !form.user_id?.trim() ||
      !form.bank_account_origin_id?.trim() ||
      !form.bank_account_destination_id?.trim()
    ) {
      transactionsStore.error =
        "Indica cliente, cuenta origen y cuenta destino para continuar.";
      return;
    }
    transactionsStore.error = null;
    createStepIndex.value = 2;
  }
}

function goCreatePrev() {
  if (createStepIndex.value > 0) {
    createStepIndex.value--;
    if (transactionsStore.error) transactionsStore.error = null;
  }
}

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
  const accNum = a.account_number ?? "-";
  return { value: a.id, label: `${bankName} - ${accNum} (${holder})` };
}

const originAccountOptions = computed(() => {
  const userId = form.user_id?.trim();
  return cuentasStore.bankAccounts
    .filter((a) => (a.account_flow ?? "").toLowerCase() === "origin")
    .filter((a) => !userId || a.user_id === userId)
    .map(bankAccountToOption);
});

const destinationAccountOptions = computed(() => {
  const userId = form.user_id?.trim();
  return cuentasStore.bankAccounts
    .filter((a) => (a.account_flow ?? "").toLowerCase() === "destination")
    .filter((a) => !userId || a.user_id === userId)
    .map(bankAccountToOption);
});

const clientOptions = computed(() =>
  cuentasStore.clientUsers.map((u) => ({ value: u.id, label: u.name })),
);

const taxRateOptions = computed(() =>
  tasasStore.taxRates.map((r) => ({
    value: r.id,
    label: `${r.coin_a}-${r.coin_b} (${r.tax})`,
  })),
);

const commissionOptions = computed(() =>
  comisionesStore.commissions.map((c) => ({
    value: c.id,
    label: `${c.coin_a}-${c.coin_b} (${c.percentage}%)`,
  })),
);

const statusFormOptions = TRANSACTION_STATUSES.map((s) => ({
  value: s,
  label: TRANSACTION_STATUS_LABELS[s],
}));

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

const apiFilterParams = computed((): GetTransactionsParams | undefined => {
  const p: GetTransactionsParams = {};
  if (statusFilter.value && statusFilter.value !== "todos")
    p.status = statusFilter.value;
  if (userFilter.value?.trim()) p.user_id = userFilter.value.trim();
  if (bankAccountFilter.value?.trim())
    p.bank_account_id = bankAccountFilter.value.trim();
  if (createdAtFrom.value?.trim())
    p.created_at_from = new Date(createdAtFrom.value).toISOString();
  if (createdAtTo.value?.trim()) {
    const d = new Date(createdAtTo.value);
    d.setHours(23, 59, 59, 999);
    p.created_at_to = d.toISOString();
  }
  return Object.keys(p).length ? p : undefined;
});

const searchedTransactions = computed(() => {
  let list = transactionsStore.transactions;

  // Filtro por estado
  if (statusFilter.value && statusFilter.value !== "todos") {
    list = list.filter(
      (t) =>
        (t.status ?? "").toLowerCase() === statusFilter.value.toLowerCase(),
    );
  }

  // Filtro por cliente
  if (userFilter.value?.trim()) {
    list = list.filter((t) => (t.user_id ?? "") === userFilter.value.trim());
  }

  // Filtro por cuenta bancaria (origen o destino)
  if (bankAccountFilter.value?.trim()) {
    const accountId = bankAccountFilter.value.trim();
    list = list.filter(
      (t) =>
        (t.bank_account_origin_id ?? t.bank_account_id ?? "") === accountId ||
        (t.bank_account_destination_id ?? "") === accountId,
    );
  }

  // Filtro por rango de fechas (created_at o send_date)
  if (createdAtFrom.value?.trim()) {
    const from = new Date(createdAtFrom.value).getTime();
    list = list.filter((t) => {
      const d = t.created_at ?? t.send_date ?? "";
      return d ? new Date(d).getTime() >= from : false;
    });
  }
  if (createdAtTo.value?.trim()) {
    const to = new Date(createdAtTo.value);
    to.setHours(23, 59, 59, 999);
    const toMs = to.getTime();
    list = list.filter((t) => {
      const d = t.created_at ?? t.send_date ?? "";
      return d ? new Date(d).getTime() <= toMs : false;
    });
  }

  // Búsqueda por código
  const q = debouncedSearch.value.trim().toLowerCase();
  if (q) {
    list = list.filter((t) => {
      const code = (t.code ?? "").toLowerCase();
      const id = (t.id ?? "").toLowerCase();
      return code.includes(q) || id.includes(q);
    });
  }

  return list;
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(searchedTransactions.value.length / perPage.value)),
);

const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * perPage.value;
  return searchedTransactions.value.slice(start, start + perPage.value);
});

function resetForm() {
  form.bank_account_origin_id = "";
  form.bank_account_destination_id = "";
  form.user_id = "";
  form.tax_rate_id = "";
  form.commission_id = "";
  form.status = "pending";
  form.checked = false;
  form.origin_amount = 0;
  form.destination_amount = 0;
  form.resultado_comision = null;
  form.total_a_enviar = null;
  form.code = "";
  form.send_date = "";
  form.payment_date = "";
  form.send_voucher = null;
  form.payment_voucher = null;
  editingId.value = null;
}

function syncFromCalculator() {
  form.origin_amount = calculatorStore.amountSend || 0;
  form.destination_amount = calculatorStore.amountReceive || 0;
  form.tax_rate_id = calculatorStore.selectedTaxRateId ?? "";
  form.commission_id = calculatorStore.selectedCommissionId ?? "";
  const res = calculatorStore.result;
  if (res) {
    form.resultado_comision = res.commission;
    form.total_a_enviar = res.totalToSend;
  } else {
    form.resultado_comision = null;
    form.total_a_enviar = null;
  }
}

function openCreateModal() {
  transactionsStore.error = null;
  resetForm();
  createStepIndex.value = 0;
  showCreateModal.value = true;
  loadFormOptions();
  calculatorStore.setDemoMode(false);
  calculatorStore.loadData();
}

async function loadFormOptions() {
  await Promise.all([
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadClientUsers(),
    cuentasStore.loadBanks(),
    tasasStore.loadTaxRates(),
    comisionesStore.loadCommissions(),
  ]);
}

function openEditModal(t: Transaction) {
  if (!t.id) return;
  transactionsStore.error = null;
  editingId.value = t.id;
  createStepIndex.value = 1;
  form.bank_account_origin_id = t.bank_account_origin_id ?? "";
  form.bank_account_destination_id =
    t.bank_account_destination_id ?? t.bank_account_id ?? "";
  form.user_id = t.user_id ?? "";
  form.tax_rate_id = t.tax_rate_id ?? "";
  form.commission_id = t.commission_id ?? "";
  form.status = (t.status ?? "pending").toLowerCase();
  form.checked =
    t.checked === true || (t.status ?? "").toLowerCase() === "checked";
  form.origin_amount = Number(t.origin_amount) || 0;
  form.destination_amount = Number(t.destination_amount) || 0;
  form.resultado_comision = null;
  form.total_a_enviar = null;
  form.code = t.code ?? "";
  form.send_date = t.send_date ? t.send_date.slice(0, 10) : "";
  form.payment_date = t.payment_date ? t.payment_date.slice(0, 10) : "";
  form.send_voucher = t.send_voucher ?? null;
  form.payment_voucher = t.payment_voucher ?? null;
  showCreateModal.value = true;
  calculatorStore.setDemoMode(false);
  loadFormOptions();
}

async function submitForm() {
  syncFromCalculator();
  if (
    !form.bank_account_origin_id ||
    !form.bank_account_destination_id ||
    !form.user_id
  ) {
    transactionsStore.error =
      "Cuenta origen, cuenta destino y cliente son obligatorios";
    return;
  }
  if (!form.tax_rate_id || !form.commission_id) {
    transactionsStore.error =
      "Tasa y comisión son obligatorios (usa la calculadora primero)";
    return;
  }
  try {
    const sendVoucher = form.send_voucher;
    const paymentVoucher = form.payment_voucher;
    const bothVouchersUploaded =
      (sendVoucher instanceof File ||
        (typeof sendVoucher === "string" && sendVoucher)) &&
      (paymentVoucher instanceof File ||
        (typeof paymentVoucher === "string" && paymentVoucher));
    const status = bothVouchersUploaded ? "completed" : form.status;

    const code =
      form.code?.trim() ||
      `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const basePayload = {
      bank_account_origin: form.bank_account_origin_id,
      bank_account_destination: form.bank_account_destination_id,
      user_id: form.user_id,
      tax_rate_id: form.tax_rate_id,
      commission_id: form.commission_id,
      status,
      origin_amount: round2(form.origin_amount),
      destination_amount: round2(form.destination_amount),
      resultado_comision:
        form.resultado_comision != null
          ? round2(form.resultado_comision)
          : undefined,
      total_a_enviar:
        form.total_a_enviar != null ? round2(form.total_a_enviar) : undefined,
      code,
      send_date: form.send_date || undefined,
      payment_date: form.payment_date || undefined,
      send_voucher: sendVoucher ?? undefined,
      payment_voucher: paymentVoucher ?? undefined,
    };
    if (editingId.value) {
      await transactionsStore.updateTransaction(editingId.value, {
        ...basePayload,
        checked: form.checked,
      });
    } else {
      await transactionsStore.createTransaction(basePayload);
    }
    showCreateModal.value = false;
    resetForm();
  } catch {
    // Error en store
  }
}

async function handleDelete(t: Transaction) {
  if (!t.id) return;
  if (!confirm(`¿Eliminar transacción ${t.code ?? t.id}?`)) return;
  openMenuId.value = null;
  deletingId.value = t.id;
  transactionsStore.error = null;
  try {
    await transactionsStore.deleteTransaction(t.id);
  } catch {
    // Error en store
  } finally {
    deletingId.value = null;
  }
}

async function toggleChecked(t: Transaction) {
  if (!t.id || updatingCheckedId.value) return;
  const newChecked = !isChecked(t);
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

function isChecked(t: Transaction): boolean {
  return t.checked === true || (t.status ?? "").toLowerCase() === "checked";
}

const selectedMenuTransaction = computed(() => {
  const id = openMenuId.value;
  if (!id) return null;
  return (
    paginatedTransactions.value.find((t) => (t.id ?? "") === id) ??
    transactionsStore.transactions.find((t) => (t.id ?? "") === id) ??
    null
  );
});

function updateMenuPosition() {
  if (!menuTriggerEl.value) return;
  const rect = menuTriggerEl.value.getBoundingClientRect();
  const menuWidth = 168;
  const menuHeight = 96;
  const padding = 8;
  let left = rect.right - menuWidth;
  if (left < padding) left = padding;
  if (left + menuWidth > window.innerWidth - padding)
    left = window.innerWidth - menuWidth - padding;
  let top = rect.bottom + 4;
  if (top + menuHeight > window.innerHeight - padding)
    top = rect.top - menuHeight - 4;
  if (top < padding) top = padding;
  menuPosition.top = top;
  menuPosition.left = left;
}

const previewSections = computed(() => {
  const t = previewTransaction.value;
  if (!t) return [];
  return buildPreviewSections(t);
});

async function openPreviewModal(t: Transaction | null) {
  if (!t) return;
  openMenuId.value = null;
  previewTransaction.value = null;
  showPreviewModal.value = true;
  previewLoading.value = true;
  await ensurePreviewCatalogLoaded();
  previewTransaction.value = { ...t };
  previewLoading.value = false;
}

function closePreviewModal() {
  showPreviewModal.value = false;
  previewTransaction.value = null;
}

function openEditFromPreview() {
  const t = previewTransaction.value;
  if (!t?.id) return;
  closePreviewModal();
  openEditModal(t);
}

/** Cerrar menú contextual de fila (sin perder la ref a la transacción antes de usarla). */
function closeRowActionMenu() {
  openMenuId.value = null;
  menuTriggerEl.value = null;
}

/**
 * Editar / Borrar deben capturar la fila antes de poner openMenuId en null:
 * si no, selectedMenuTransaction queda null en el mismo tick y el modal no abre / el borrado no corre.
 */
function confirmEditFromMenu() {
  const t = selectedMenuTransaction.value;
  closeRowActionMenu();
  if (t) openEditModal(t);
}

function confirmDeleteFromMenu() {
  const t = selectedMenuTransaction.value;
  closeRowActionMenu();
  if (t) void handleDelete(t);
}

function toggleMenu(id: string, event?: Event) {
  if (openMenuId.value === id) {
    closeRowActionMenu();
    return;
  }
  menuTriggerEl.value =
    (event?.target as HTMLElement)?.closest("td") ??
    (event?.target as HTMLElement) ??
    null;
  openMenuId.value = id;
  nextTick(() => {
    updateMenuPosition();
    const scrollParent = menuTriggerEl.value?.closest(".overflow-x-auto");
    const close = () => {
      closeRowActionMenu();
      document.removeEventListener("click", close);
      window.removeEventListener("resize", updateMenuPosition);
      scrollParent?.removeEventListener("scroll", updateMenuPosition);
    };
    window.addEventListener("resize", updateMenuPosition);
    scrollParent?.addEventListener("scroll", updateMenuPosition);
    setTimeout(() => document.addEventListener("click", close), 0);
  });
}

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value));
}

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

function getStatusLabel(status: string | undefined): string {
  if (!status) return "-";
  const s = status.toLowerCase();
  return (
    TRANSACTION_STATUS_LABELS[s as keyof typeof TRANSACTION_STATUS_LABELS] ??
    status
  );
}

function getBankAccountLabel(id: string | undefined): string {
  if (!id) return "-";
  const acc = cuentasStore.bankAccounts.find((a) => a.id === id);
  if (!acc) return id;
  return bankAccountToOption(acc).label;
}

function getClientLabel(id: string | undefined): string {
  if (!id) return "-";
  const u = cuentasStore.clientUsers.find((u) => u.id === id);
  return u?.name ?? id;
}

function getVoucherLabel(v: unknown): string {
  return v != null &&
    typeof v === "object" &&
    "name" in v &&
    typeof (v as File).name === "string"
    ? (v as File).name
    : "Archivo seleccionado";
}

const sendVoucherPreviewSrc = ref<string | null>(null);
const paymentVoucherPreviewSrc = ref<string | null>(null);

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function updateVoucherPreview(target: Ref<string | null>, v: unknown) {
  revokeIfBlob(target.value);
  target.value = null;
  if (v instanceof File) target.value = URL.createObjectURL(v);
  else if (typeof v === "string" && v.trim())
    target.value = Domain.mediaUrl(v.trim());
}

watch(
  () => form.send_voucher,
  (v) => updateVoucherPreview(sendVoucherPreviewSrc, v),
);
watch(
  () => form.payment_voucher,
  (v) => updateVoucherPreview(paymentVoucherPreviewSrc, v),
);

onBeforeUnmount(() => {
  revokeIfBlob(sendVoucherPreviewSrc.value);
  revokeIfBlob(paymentVoucherPreviewSrc.value);
});

async function submitImport() {
  if (!importFile.value) return;
  try {
    await transactionsStore.importExcel(
      importFile.value,
      apiFilterParams.value,
    );
    showImportModal.value = false;
    importFile.value = null;
    if (fileInput.value) fileInput.value.value = "";
  } catch {
    // Error en store
  }
}

async function submitImportSimple() {
  if (!importSimpleFile.value) return;
  importingSimple.value = true;
  importSimpleError.value = "";
  transactionsStore.error = null;
  try {
    const payloads = await parseSimpleImportExcel(importSimpleFile.value);
    if (payloads.length === 0) {
      importSimpleError.value = "No se encontraron filas válidas en el archivo";
      importingSimple.value = false;
      return;
    }
    let created = 0;
    const errors: string[] = [];
    for (const p of payloads) {
      try {
        await transactionsStore.createTransaction(p);
        created++;
      } catch (e) {
        errors.push(`${p.code}: ${e instanceof Error ? e.message : "Error"}`);
      }
    }
    showImportSimpleModal.value = false;
    importSimpleFile.value = null;
    if (fileInputSimple.value) fileInputSimple.value.value = "";
    loadTransactions();
    if (errors.length > 0) {
      transactionsStore.error = `Importados ${created}. Errores: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? ` ... +${errors.length - 3} más` : ""}`;
    }
  } catch (e) {
    importSimpleError.value =
      e instanceof Error ? e.message : "Error al procesar el archivo";
  } finally {
    importingSimple.value = false;
  }
}

function loadTransactions() {
  transactionsStore.loadTransactions(apiFilterParams.value);
}

watch(
  () => form.user_id,
  () => {
    form.bank_account_origin_id = "";
    form.bank_account_destination_id = "";
  },
);

watch([searchQuery, perPage], () => {
  currentPage.value = 1;
});

watch(
  [statusFilter, userFilter, bankAccountFilter, createdAtFrom, createdAtTo],
  () => {
    currentPage.value = 1;
    loadTransactions();
  },
);

onMounted(() => {
  Promise.all([
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadClientUsers(),
    cuentasStore.loadBanks(),
  ]).then(() => loadTransactions());
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="mb-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p
            class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong"
          >
            Operaciones
          </p>
          <h1 class="text-2xl font-semibold text-[#232b4d]">Transacciones</h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-brasper-cyan/40 bg-white px-4 py-2.5 text-sm font-medium text-brasper-indigoStrong transition hover:bg-brasper-cyanLight/10"
            @click="showImportModal = true"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Importar
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
            @click="showImportSimpleModal = true"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Importar simple
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark"
            @click="openCreateModal"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Crear
          </button>
        </div>
      </div>

      <!-- Filtros -->
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
          <label class="text-[11px] text-[#6b7280]">Desde</label>
          <AppDateInput
            v-model="createdAtFrom"
            size="sm"
            class="min-w-[150px]"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Hasta</label>
          <AppDateInput v-model="createdAtTo" size="sm" class="min-w-[150px]" />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Total</label>
          <div
            class="flex h-9 min-w-[3rem] items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm font-medium text-[#374151]"
          >
            {{ searchedTransactions.length }}
          </div>
        </div>
      </div>
    </div>

    <!-- Search -->
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

    <!-- Error -->
    <p
      v-if="transactionsStore.error"
      class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]"
    >
      {{ transactionsStore.error }}
    </p>

    <!-- Tabla -->
    <div
      class="relative overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white"
    >
      <div
        v-if="transactionsStore.isLoading"
        class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80"
      >
        <span class="text-sm text-[#6b7280]">Cargando...</span>
      </div>

      <table
        v-show="!transactionsStore.isLoading"
        class="w-full min-w-[800px] text-left text-sm"
      >
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
              Cuenta de origen
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Cuenta destino
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Cliente
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Monto origen
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Monto destino
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Estado
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Fecha envío
            </th>
            <th class="w-12 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-if="paginatedTransactions.length === 0"
            class="border-t border-[#e5e7eb]"
          >
            <td
              colspan="10"
              class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-6 py-12 text-center text-[#666]"
            >
              No hay transacciones. Importa un archivo Excel o crea una nueva.
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
                  isChecked(t)
                    ? 'border-brasper-indigoStrong bg-brasper-indigoStrong text-white'
                    : 'border-[#d1d5db] bg-white text-transparent hover:border-[#9ca3af]'
                "
                :disabled="updatingCheckedId === t.id"
                :title="
                  isChecked(t)
                    ? 'Verificada (clic para desmarcar)'
                    : 'Marcar como verificada'
                "
                @click.stop="toggleChecked(t)"
              >
                <svg
                  v-if="isChecked(t)"
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
              {{ t.code ?? "-" }}
            </td>
            <td
              class="max-w-[180px] truncate px-4 py-3 text-[#374151]"
              :title="getBankAccountLabel(t.bank_account_origin_id)"
            >
              {{ getBankAccountLabel(t.bank_account_origin_id) }}
            </td>
            <td
              class="max-w-[180px] truncate px-4 py-3 text-[#374151]"
              :title="getBankAccountLabel(t.bank_account_destination_id)"
            >
              {{ getBankAccountLabel(t.bank_account_destination_id) }}
            </td>
            <td class="px-4 py-3 text-[#374151]">
              {{ getClientLabel(t.user_id) }}
            </td>
            <td class="px-4 py-3 text-[#374151]">
              {{ formatValue(t.origin_amount) }}
            </td>
            <td class="px-4 py-3 text-[#374151]">
              {{ formatValue(t.destination_amount) }}
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="{
                  'bg-amber-100 text-amber-800':
                    (t.status ?? '').toLowerCase() === 'pending',
                  'bg-indigo-100 text-indigo-900':
                    (t.status ?? '').toLowerCase() === 'completed',
                  'bg-red-100 text-red-800':
                    (t.status ?? '').toLowerCase() === 'failed',
                  'bg-sky-100 text-sky-900':
                    (t.status ?? '').toLowerCase() === 'checked',
                  'bg-gray-100 text-gray-800':
                    (t.status ?? '').toLowerCase() === 'cancelled',
                  'bg-[#dbeafe] text-brasper-indigoDark': ![
                    'pending',
                    'completed',
                    'failed',
                    'checked',
                    'cancelled',
                  ].includes((t.status ?? '').toLowerCase()),
                }"
              >
                {{ getStatusLabel(t.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-[#374151]">
              {{ formatDate(t.send_date) }}
            </td>
            <td class="relative px-2 py-3">
              <button
                type="button"
                class="rounded p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
                @click.stop="toggleMenu(t.id ?? '', $event)"
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                  />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Menú acciones (Teleport para evitar overflow y posicionamiento responsive) -->
    <Teleport to="body">
      <div
        v-if="openMenuId && selectedMenuTransaction"
        class="fixed z-[100] min-w-[160px] rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg"
        :style="{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
        }"
        @click.stop
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
          @click="openPreviewModal(selectedMenuTransaction)"
        >
          <svg
            class="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          Previsualizar
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
          @click="confirmEditFromMenu"
        >
          <svg
            class="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          Editar
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#dc3545] hover:bg-[#fef2f2]"
          :disabled="deletingId === selectedMenuTransaction.id"
          @click="confirmDeleteFromMenu"
        >
          <svg
            class="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Borrar
        </button>
      </div>
    </Teleport>

    <!-- Modal Previsualizar -->
    <Teleport to="body">
      <div
        v-if="showPreviewModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="closePreviewModal"
      >
        <div
          class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#d8e5fb] bg-white shadow-xl"
        >
          <div
            class="flex items-center justify-between border-b border-[#e5e7eb] bg-[#fafbfc] px-6 py-4"
          >
            <div>
              <h2 class="text-lg font-semibold text-[#1f2937]">
                Previsualizar transacción
              </h2>
              <p class="mt-0.5 text-xs text-[#6b7280]">
                Datos resueltos con tasas, comisiones y cuentas del backoffice
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6]"
              aria-label="Cerrar"
              @click="closePreviewModal"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <p
              v-if="previewLoading"
              class="flex items-center justify-center gap-2 py-12 text-sm text-[#6b7280]"
            >
              <span
                class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brasper-indigoStrong border-t-transparent"
              />
              Cargando catálogo (tasas, comisiones, cuentas)…
            </p>
            <template v-else-if="previewTransaction">
              <div class="space-y-5">
                <section
                  v-for="section in previewSections"
                  :key="section.id"
                  class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-5 shadow-sm"
                >
                  <div class="mb-4 border-b border-[#e5e7eb]/80 pb-3">
                    <h3
                      class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong"
                    >
                      {{ section.title }}
                    </h3>
                    <p
                      v-if="section.subtitle"
                      class="mt-1 text-xs text-[#6b7280]"
                    >
                      {{ section.subtitle }}
                    </p>
                  </div>
                  <dl class="space-y-3">
                    <div
                      v-for="(item, i) in section.items"
                      :key="`${section.id}-${i}-${item.label}`"
                      class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                    >
                      <dt
                        class="shrink-0 text-xs font-medium uppercase tracking-wide text-[#6b7280] sm:min-w-[9rem]"
                      >
                        {{ item.label }}
                      </dt>
                      <dd class="min-w-0 text-right text-sm font-medium sm:flex-1">
                        <span
                          v-if="item.variant === 'status'"
                          class="inline-flex rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-semibold text-brasper-indigoDark"
                        >
                          {{ item.value }}
                        </span>
                        <span
                          v-else-if="item.variant === 'mono'"
                          class="break-all font-mono text-xs text-[#374151]"
                        >
                          {{ item.value }}
                        </span>
                        <span v-else class="text-[#111827]">
                          {{ item.value }}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </section>

                <section
                  v-if="
                    previewTransaction.send_voucher ||
                    previewTransaction.payment_voucher
                  "
                  class="rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm"
                >
                  <div class="mb-4 border-b border-[#e5e7eb]/80 pb-3">
                    <h3
                      class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong"
                    >
                      Comprobantes
                    </h3>
                    <p class="mt-1 text-xs text-[#6b7280]">
                      Vista previa e imagen a tamaño completo en nueva pestaña
                    </p>
                  </div>
                  <div class="grid gap-5 sm:grid-cols-2">
                    <div
                      v-if="previewTransaction.send_voucher"
                      class="flex flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f9fafb]"
                    >
                      <div
                        class="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-3 py-2"
                      >
                        <span class="text-xs font-semibold text-[#374151]"
                          >Envío</span
                        >
                        <a
                          :href="
                            Domain.mediaUrl(previewTransaction.send_voucher)
                          "
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-xs font-medium text-brasper-indigoStrong hover:underline"
                        >
                          Abrir imagen
                        </a>
                      </div>
                      <a
                        :href="
                          Domain.mediaUrl(previewTransaction.send_voucher)
                        "
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block bg-[#f3f4f6]"
                      >
                        <img
                          :src="
                            Domain.mediaUrl(previewTransaction.send_voucher)
                          "
                          alt="Comprobante envío"
                          class="mx-auto max-h-56 w-full object-contain"
                          @error="
                            ($event.target as HTMLImageElement).style.display =
                              'none'
                          "
                        />
                      </a>
                    </div>
                    <div
                      v-if="previewTransaction.payment_voucher"
                      class="flex flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f9fafb]"
                    >
                      <div
                        class="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-3 py-2"
                      >
                        <span class="text-xs font-semibold text-[#374151]"
                          >Pago</span
                        >
                        <a
                          :href="
                            Domain.mediaUrl(previewTransaction.payment_voucher)
                          "
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-xs font-medium text-brasper-indigoStrong hover:underline"
                        >
                          Abrir imagen
                        </a>
                      </div>
                      <a
                        :href="
                          Domain.mediaUrl(previewTransaction.payment_voucher)
                        "
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block bg-[#f3f4f6]"
                      >
                        <img
                          :src="
                            Domain.mediaUrl(previewTransaction.payment_voucher)
                          "
                          alt="Comprobante pago"
                          class="mx-auto max-h-56 w-full object-contain"
                          @error="
                            ($event.target as HTMLImageElement).style.display =
                              'none'
                          "
                        />
                      </a>
                    </div>
                  </div>
                </section>
              </div>
            </template>
          </div>
          <div
            v-if="previewTransaction && !previewLoading"
            class="flex flex-wrap items-center justify-end gap-2 border-t border-[#e5e7eb] bg-[#fafbfc] px-6 py-4"
          >
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] hover:bg-white"
              @click="closePreviewModal"
            >
              Cerrar
            </button>
            <button
              v-if="previewTransaction.id"
              type="button"
              class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white hover:bg-brasper-indigoDark"
              @click="openEditFromPreview"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              Editar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Paginación -->
    <div
      v-if="transactionsStore.transactions.length > 0"
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
        <span>{{ searchedTransactions.length }} resultados</span>
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

    <!-- Modal Crear/Editar -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="showCreateModal = false"
      >
        <div
          class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-xl"
        >
          <div
            class="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4"
          >
            <div>
              <h2 class="text-lg font-semibold text-[#1f2937]">
                {{ editingId ? "Editar transacción" : "Nueva transacción" }}
              </h2>
              <p class="mt-0.5 text-xs text-[#6b7280]">
                Paso {{ createStepIndex + 1 }} de {{ CREATE_FLOW_STEPS.length }}
                · {{ CREATE_FLOW_STEPS[createStepIndex]?.title }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6]"
              aria-label="Cerrar"
              @click="showCreateModal = false"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Stepper -->
          <nav
            class="border-b border-[#e5e7eb] bg-[#fafbfc] px-4 py-4 sm:px-6"
            aria-label="Pasos de creación"
          >
            <ol class="flex w-full items-start">
              <li
                v-for="(step, idx) in CREATE_FLOW_STEPS"
                :key="step.key"
                class="relative flex min-w-0 flex-1 flex-col items-center"
              >
                <div class="flex w-full min-h-[2.75rem] items-center">
                  <div
                    v-if="idx > 0"
                    class="h-0.5 min-w-[8px] flex-1"
                    :class="
                      createStepIndex >= idx
                        ? 'bg-brasper-indigoStrong'
                        : 'bg-[#e5e7eb]'
                    "
                  />
                  <button
                    type="button"
                    class="group flex shrink-0 flex-col items-center gap-1 px-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brasper-indigoStrong focus-visible:ring-offset-2 disabled:pointer-events-none"
                    :disabled="idx > createStepIndex"
                    :aria-current="idx === createStepIndex ? 'step' : undefined"
                    @click="goToCreateStep(idx)"
                  >
                    <span
                      class="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition sm:h-10 sm:w-10"
                      :class="
                        idx < createStepIndex
                          ? 'bg-brasper-indigoStrong text-white shadow-sm'
                          : idx === createStepIndex
                            ? 'bg-white text-brasper-indigoStrong ring-2 ring-brasper-indigoStrong ring-offset-2 ring-offset-[#fafbfc]'
                            : 'bg-[#e5e7eb] text-[#9ca3af]'
                      "
                    >
                      <svg
                        v-if="idx < createStepIndex"
                        class="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span v-else>{{ idx + 1 }}</span>
                    </span>
                    <span
                      class="max-w-[5.5rem] text-center text-[10px] font-semibold leading-tight sm:max-w-[6.5rem] sm:text-[11px]"
                      :class="
                        idx === createStepIndex
                          ? 'text-brasper-indigoStrong'
                          : 'text-[#6b7280] group-hover:text-[#374151]'
                      "
                    >
                      {{ step.title }}
                    </span>
                  </button>
                  <div
                    v-if="idx < CREATE_FLOW_STEPS.length - 1"
                    class="h-0.5 min-w-[8px] flex-1"
                    :class="
                      createStepIndex > idx
                        ? 'bg-brasper-indigoStrong'
                        : 'bg-[#e5e7eb]'
                    "
                  />
                </div>
                <p
                  class="mt-0.5 max-w-[6.5rem] text-center text-[9px] leading-snug text-[#9ca3af] sm:text-[10px]"
                >
                  {{ step.subtitle }}
                </p>
              </li>
            </ol>
          </nav>

          <!-- Contenido -->
          <div class="flex-1 overflow-y-auto p-6">
            <div
              v-if="createStepIndex === 0"
              class="min-w-0 space-y-5"
            >
              <p
                class="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-brasper-indigoStrong"
              >
                Producción
              </p>
              <CalculatorConversionCard
                variant="production"
                :show-send-cta="false"
              />
            </div>

            <form
              v-else-if="createStepIndex === 1"
              class="space-y-5"
              @submit.prevent="goCreateNext"
            >
              <p class="text-sm leading-relaxed text-[#6b7280]">
                Asocia el movimiento a un cliente y sus cuentas. Los montos y
                tasa vienen de la cotización; ajústalos solo si hace falta.
              </p>

              <section
                class="rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5"
              >
                <div class="mb-4 flex items-center gap-2">
                  <span
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-brasper-cyanLight/40 text-brasper-indigoStrong"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3
                      class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brasper-indigoStrong"
                    >
                      Cliente y cuentas
                    </h3>
                    <p class="text-xs text-[#6b7280]">
                      Filtradas por el cliente seleccionado
                    </p>
                  </div>
                </div>
                <div class="grid gap-5 sm:grid-cols-2">
                  <div class="space-y-1.5 sm:col-span-2">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Cliente *</label
                    >
                    <AppDropdown
                      v-model="form.user_id"
                      :options="clientOptions"
                      placeholder="Seleccionar cliente"
                      :searchable="clientOptions.length > 10"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Cuenta origen *</label
                    >
                    <AppDropdown
                      v-model="form.bank_account_origin_id"
                      :options="originAccountOptions"
                      placeholder="Cuenta de origen"
                      :searchable="originAccountOptions.length > 5"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Cuenta destino *</label
                    >
                    <AppDropdown
                      v-model="form.bank_account_destination_id"
                      :options="destinationAccountOptions"
                      placeholder="Cuenta de destino"
                      :searchable="destinationAccountOptions.length > 5"
                    />
                  </div>
                </div>
              </section>

              <section
                class="rounded-xl border border-[#d8e5fb] bg-[#fbfdff] p-5 shadow-sm shadow-brasper-indigoStrong/5"
              >
                <div class="mb-4 flex items-center gap-2">
                  <span
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brasper-indigoStrong shadow-sm"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3
                      class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brasper-indigoStrong"
                    >
                      Importes y condiciones
                    </h3>
                    <p class="text-xs text-[#6b7280]">
                      Heredados del paso de cotización; editables si es
                      necesario
                    </p>
                  </div>
                </div>
                <div class="grid gap-5 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Tasa</label
                    >
                    <AppDropdown
                      v-model="form.tax_rate_id"
                      :options="taxRateOptions"
                      placeholder="Par de monedas / tasa"
                      :searchable="taxRateOptions.length > 10"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Comisión</label
                    >
                    <AppDropdown
                      v-model="form.commission_id"
                      :options="commissionOptions"
                      placeholder="Comisión aplicable"
                      :searchable="commissionOptions.length > 10"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Monto origen</label
                    >
                    <input
                      v-model.number="form.origin_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      class="form-input w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Monto destino</label
                    >
                    <input
                      v-model.number="form.destination_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      class="form-input w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </section>

              <section
                class="rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5"
              >
                <div class="mb-4 flex items-center gap-2">
                  <span
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-brasper-cyanLight/40 text-brasper-indigoStrong"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3
                      class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brasper-indigoStrong"
                    >
                      Referencia y fechas
                    </h3>
                    <p class="text-xs text-[#6b7280]">
                      Código interno y fechas de envío / pago
                    </p>
                  </div>
                </div>
                <div class="grid gap-5 sm:grid-cols-2">
                  <div class="space-y-1.5 sm:col-span-2">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Código</label
                    >
                    <input
                      v-model="form.code"
                      type="text"
                      class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm"
                      placeholder="Se genera si lo dejas vacío"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Fecha envío</label
                    >
                    <AppDateInput v-model="form.send_date" />
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Fecha pago</label
                    >
                    <AppDateInput v-model="form.payment_date" />
                  </div>
                </div>
              </section>

              <section
                v-if="editingId"
                class="rounded-xl border border-amber-200/80 bg-amber-50/60 p-5"
              >
                <h3
                  class="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900/90"
                >
                  Estado en el sistema
                </h3>
                <div
                  class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
                >
                  <div class="min-w-0 flex-1 space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Estado</label
                    >
                    <AppDropdown
                      v-model="form.status"
                      :options="statusFormOptions"
                      placeholder="Pendiente"
                      :searchable="false"
                    />
                  </div>
                  <label
                    class="flex cursor-pointer items-center gap-3 rounded-lg border border-amber-200/90 bg-white/80 px-4 py-3 sm:shrink-0"
                  >
                    <input
                      v-model="form.checked"
                      type="checkbox"
                      class="h-4 w-4 rounded border-[#d1d5db] text-brasper-indigoStrong focus:ring-brasper-indigoStrong"
                    />
                    <span class="text-sm font-medium text-[#374151]">
                      Verificada
                    </span>
                  </label>
                </div>
                <p class="mt-3 text-xs text-amber-900/70">
                  Si marcas verificada, el backend puede reflejar el estado
                  correspondiente.
                </p>
              </section>
            </form>

            <form
              v-else-if="createStepIndex === 2"
              class="space-y-5"
              @submit.prevent="submitForm"
            >
              <p class="text-sm leading-relaxed text-[#6b7280]">
                Sube capturas o comprobantes en imagen. Son opcionales; si
                cargas ambos, al guardar se puede marcar la operación como
                finalizada según tu flujo.
              </p>

              <div
                v-if="form.send_voucher && form.payment_voucher"
                class="flex items-start gap-3 rounded-xl border border-brasper-indigoStrong/25 bg-brasper-cyanLight/15 px-4 py-3 text-sm text-brasper-indigoDark"
              >
                <svg
                  class="mt-0.5 h-5 w-5 shrink-0 text-brasper-indigoStrong"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  Tienes ambos comprobantes listos. Al guardar, el estado puede
                  pasar a finalizado si aplica.
                </span>
              </div>

              <div class="grid gap-5 md:grid-cols-2">
                <div
                  class="flex flex-col rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5"
                >
                  <div class="mb-4 flex items-start gap-3">
                    <span
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brasper-cyanLight/50 text-brasper-indigoStrong"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </span>
                    <div class="min-w-0">
                      <h3 class="text-base font-semibold text-[#232b4d]">
                        Envío
                      </h3>
                      <p class="mt-0.5 text-xs text-[#6b7280]">
                        Comprobante del envío al destinatario (send_voucher)
                      </p>
                    </div>
                  </div>
                  <label
                    class="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbef] bg-[#fbfdff] px-4 py-10 transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      class="sr-only"
                      @change="
                        form.send_voucher =
                          ($event.target as HTMLInputElement).files?.[0] ?? null
                      "
                    />
                    <svg
                      class="mb-2 h-10 w-10 text-[#93c5fd]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span
                      class="text-sm font-semibold text-brasper-indigoStrong"
                    >
                      Elegir imagen
                    </span>
                    <span class="mt-1 text-center text-xs text-[#6b7280]">
                      PNG o JPG · arrastra o haz clic
                    </span>
                  </label>
                  <img
                    v-if="sendVoucherPreviewSrc"
                    :src="sendVoucherPreviewSrc"
                    alt="Vista previa comprobante de envío"
                    class="mt-4 max-h-44 w-full rounded-lg border border-[#e5e7eb] object-contain"
                  />
                  <p
                    v-if="form.send_voucher"
                    class="mt-3 truncate text-xs font-medium text-[#374151]"
                    :title="getVoucherLabel(form.send_voucher)"
                  >
                    {{ getVoucherLabel(form.send_voucher) }}
                  </p>
                </div>

                <div
                  class="flex flex-col rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5"
                >
                  <div class="mb-4 flex items-start gap-3">
                    <span
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                      </svg>
                    </span>
                    <div class="min-w-0">
                      <h3 class="text-base font-semibold text-[#232b4d]">
                        Pago
                      </h3>
                      <p class="mt-0.5 text-xs text-[#6b7280]">
                        Comprobante del pago recibido (payment_voucher)
                      </p>
                    </div>
                  </div>
                  <label
                    class="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbef] bg-[#fbfdff] px-4 py-10 transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      class="sr-only"
                      @change="
                        form.payment_voucher =
                          ($event.target as HTMLInputElement).files?.[0] ?? null
                      "
                    />
                    <svg
                      class="mb-2 h-10 w-10 text-[#6ee7b7]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span
                      class="text-sm font-semibold text-brasper-indigoStrong"
                    >
                      Elegir imagen
                    </span>
                    <span class="mt-1 text-center text-xs text-[#6b7280]">
                      PNG o JPG · arrastra o haz clic
                    </span>
                  </label>
                  <img
                    v-if="paymentVoucherPreviewSrc"
                    :src="paymentVoucherPreviewSrc"
                    alt="Vista previa comprobante de pago"
                    class="mt-4 max-h-44 w-full rounded-lg border border-[#e5e7eb] object-contain"
                  />
                  <p
                    v-if="form.payment_voucher"
                    class="mt-3 truncate text-xs font-medium text-[#374151]"
                    :title="getVoucherLabel(form.payment_voucher)"
                  >
                    {{ getVoucherLabel(form.payment_voucher) }}
                  </p>
                </div>
              </div>
            </form>
          </div>

          <!-- Error dentro del modal -->
          <p
            v-if="showCreateModal && transactionsStore.error"
            class="mx-6 mb-2 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]"
          >
            {{ transactionsStore.error }}
          </p>

          <!-- Footer -->
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-6 py-4"
          >
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb]"
              @click="showCreateModal = false"
            >
              Cancelar
            </button>
            <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <button
                v-if="createStepIndex > 0"
                type="button"
                class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-brasper-indigoStrong hover:bg-[#f9fafb]"
                @click="goCreatePrev"
              >
                Atrás
              </button>
              <button
                v-if="!isLastCreateStep"
                type="button"
                class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white hover:bg-brasper-indigoDark"
                @click="goCreateNext"
              >
                Siguiente
              </button>
              <button
                v-else
                type="button"
                class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white hover:bg-brasper-indigoDark disabled:opacity-60"
                :disabled="
                  transactionsStore.isCreating || transactionsStore.isUpdating
                "
                @click="submitForm"
              >
                {{
                  transactionsStore.isCreating || transactionsStore.isUpdating
                    ? "Guardando..."
                    : "Guardar"
                }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal Importar -->
    <Teleport to="body">
      <div
        v-if="showImportModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="showImportModal = false"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-[#dbe7fb] bg-white p-6 shadow-xl"
        >
          <h2 class="mb-4 text-lg font-semibold text-[#232b4d]">
            Importar transacciones
          </h2>
          <div class="mb-4 rounded-lg bg-[#fbfdff] p-4 text-sm text-[#666]">
            <p class="mb-2 font-medium text-[#333]">
              Formatos aceptados: JSON o Excel (.xlsx, .xls)
            </p>
            <p class="mb-2 font-medium text-brasper-indigoStrong">
              Formato Brasper:
            </p>
            <p class="mb-2">
              Si el Excel tiene columnas <strong>Nombre</strong>,
              <strong>Correo</strong>, <strong>ENVÍA (PEN)</strong>,
              <strong>RECIBE (BRL)</strong>, etc., se detecta automáticamente.
            </p>
            <p class="mb-2">Formato alternativo (JSON o Excel con columnas):</p>
            <p class="mb-2">Columnas del Excel (primera fila = encabezados):</p>
            <ul class="list-inside list-disc space-y-1">
              <li>
                <strong>origin_amount</strong> / monto_origen — Monto origen
              </li>
              <li>
                <strong>destination_amount</strong> / monto_destino — Monto
                destino
              </li>
              <li>
                <strong>tax_rate_id</strong>, <strong>commission_id</strong> —
                IDs de tasa y comisión
              </li>
              <li>
                <strong>origin_names</strong>,
                <strong>origin_lastnames</strong>,
                <strong>origin_email</strong> — Usuario origen
              </li>
              <li>
                <strong>dest_names</strong>, <strong>dest_lastnames</strong>,
                <strong>dest_email</strong> — Usuario destino
              </li>
              <li>
                <strong>origin_bank_id</strong>, <strong>dest_bank_id</strong> —
                IDs de bancos
              </li>
              <li>
                <strong>send_date</strong> / fecha_envio,
                <strong>payment_date</strong> / fecha_pago
              </li>
            </ul>
          </div>
          <form class="space-y-4" @submit.prevent="submitImport">
            <div>
              <label class="mb-1 block text-sm font-medium text-[#333]"
                >Archivo (.json, .xlsx, .xls)</label
              >
              <input
                ref="fileInput"
                type="file"
                accept=".json,.xlsx,.xls"
                required
                class="w-full rounded-xl border border-[#cfdbef] px-4 py-2.5 text-sm"
                @change="
                  importFile =
                    ($event.target as HTMLInputElement).files?.[0] ?? null
                "
              />
            </div>
            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                class="rounded-xl bg-gradient-to-r from-brasper-cyanLight to-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                :disabled="transactionsStore.isImporting || !importFile"
              >
                {{
                  transactionsStore.isImporting ? "Importando..." : "Importar"
                }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-brasper-indigoStrong/30 px-4 py-2.5 text-sm text-brasper-indigoDark hover:bg-brasper-indigoStrong/10"
                @click="showImportModal = false"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Modal Importar simple (usa mismo POST que Crear) -->
    <Teleport to="body">
      <div
        v-if="showImportSimpleModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="showImportSimpleModal = false"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl"
        >
          <h2 class="mb-4 text-lg font-semibold text-[#1f2937]">
            Importar simple
          </h2>
          <p class="mb-4 text-sm text-[#6b7280]">
            Usa el mismo endpoint que Crear. Cada fila del Excel se envía como
            una transacción individual.
          </p>
          <div class="mb-4 rounded-lg bg-[#f9fafb] p-4 text-sm text-[#6b7280]">
            <p class="mb-2 font-medium text-[#374151]">
              Columnas (IDs obligatorios):
            </p>
            <ul class="list-inside list-disc space-y-1">
              <li><strong>bank_account_origin</strong> / cuenta_origen</li>
              <li>
                <strong>bank_account_destination</strong> / cuenta_destino
              </li>
              <li><strong>user_id</strong> / cliente</li>
              <li><strong>tax_rate_id</strong> / tasa</li>
              <li><strong>commission_id</strong> / comision</li>
              <li><strong>origin_amount</strong> / monto_origen</li>
              <li><strong>destination_amount</strong> / monto_destino</li>
              <li><strong>code</strong> / codigo (opcional)</li>
            </ul>
          </div>
          <form class="space-y-4" @submit.prevent="submitImportSimple">
            <div>
              <label class="mb-1 block text-sm font-medium text-[#374151]"
                >Archivo (.xlsx, .xls)</label
              >
              <input
                ref="fileInputSimple"
                type="file"
                accept=".xlsx,.xls"
                required
                class="w-full rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm"
                @change="
                  importSimpleFile =
                    ($event.target as HTMLInputElement).files?.[0] ?? null
                "
              />
            </div>
            <p
              v-if="importSimpleError"
              class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]"
            >
              {{ importSimpleError }}
            </p>
            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                class="rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-60"
                :disabled="importingSimple || !importSimpleFile"
              >
                {{ importingSimple ? "Importando..." : "Importar" }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
                @click="showImportSimpleModal = false"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
