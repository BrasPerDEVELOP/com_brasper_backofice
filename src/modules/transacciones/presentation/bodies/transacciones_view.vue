<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  onActivated,
  reactive,
  watch,
  nextTick,
} from "vue";
import { useTransactionPageContext } from "../composables/use_transaction_page_context";
import { useTableDragScroll } from "../composables/use_table_drag_scroll";
import { RouterLink } from "vue-router";
import { useTagsStore } from "../controllers/use_tags_store_controller";
import {
  TRANSACTION_EXPORT_HEADERS,
  buildTransactionExportRows,
  transactionExportFilename,
} from "../../infrastructure/utils/transactions_export";
import { isClientProfileIncomplete } from "@modules/auth/infrastructure/parse_user";
import { useAuthStore } from "@modules/auth/presentation/controllers/use_auth_store_controller";
import type { BankAccount } from "@modules/cuentas-bancarias/domain/models";
import type { Transaction } from "../../domain/models";
import type { GetTransactionsParams } from "../../infrastructure/adapters/transactions_repository";
import { resolveSocialReasonBankId } from "../../infrastructure/mappers/resolve_social_reason_bank_id";
import { parseSimpleImportExcel } from "../../infrastructure/utils/excel_simple_import";
import {
  buildSpecialDiscountMetaFromSnapshot,
  saveTransactionSpecialDiscountMeta,
  enrichTransactionWithSpecialDiscountMeta,
  getTransactionSpecialDiscountMeta,
  syncSpecialDiscountMetaAfterSave,
} from "../../infrastructure/utils/transaction_special_discount_meta";
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
  isTransactionChecked,
  resolveTransactionStatusForDisplay,
  roundMoneyAmount,
  localDateInputStartMs,
  localDateInputEndMs,
  normalizeCurrencyCode,
  resolveTransactionCurrencyPair,
  inferOriginCurrencyFromTransactionCode,
  formatTransactionCodeForDisplay,
  transactionDayKey,
  tagColorStyle,
  SPECIAL_CALCULATOR_DISCOUNT_CODE,
  isSpecialCalculatorDiscountCode,
  getTransactionSpecialDiscountForDisplay,
} from "../../domain/models";
import type { TransactionSpecialDiscountInfo } from "../../domain/models";
import AppDropdown from "@/interface/components/AppDropdown.vue";
import AppDateInput from "@/interface/components/AppDateInput.vue";
import { blockNumberInputWheel } from "@/interface/helpers/block_number_input_wheel";
import UsuarioCreateFormModal from "@/interface/components/UsuarioCreateFormModal.vue";
import CuentaBancariaCreateFormModal from "@/interface/components/CuentaBancariaCreateFormModal.vue";
import BancoCrudModal from "@/interface/components/BancoCrudModal.vue";
import { ConfirmDialog } from "@interface/widgets";
import type { BankOption } from "@modules/cuentas-bancarias/infrastructure/adapters/banks_api_adapter";
import type { UserListItem } from "@modules/auth/infrastructure/adapters/users_management_api_adapter";
import CalculatorConversionCard from "@modules/calculator/presentation/components/CalculatorConversionCard.vue";
import TasasDemoCompact from "@modules/tasas/presentation/components/tasas_demo_compact.vue";
import type { CurrencyCode } from "@modules/calculator/domain/models";
import { CURRENCY_FLAG_SRC_BY_CODE } from "@modules/calculator/presentation/utils/calculator_format";
import { Domain } from "@/interface/infrastructure/services";
import { useTransactionPreviewController } from "../controllers/use_transaction_preview_controller";
import { useTransactionStatusLabels } from "../composables/use_transaction_status_labels";
import { fetchUsers } from "@modules/auth/infrastructure/adapters/users_management_api_adapter";
import TransactionDestinationsEditor from "../components/TransactionDestinationsEditor.vue";
import TransactionVoucherFileList from "../components/TransactionVoucherFileList.vue";
import {
  emptyTransactionDestination,
  formatDestinationAccountOptionLabel,
  validateTransactionDestinations,
  type TransactionDestinationDraft,
} from "../composables/use_transaction_destinations";

// C1 (Fase C, H3) — facade multi-store en lugar de 5 useXStore() en la vista.
const { transactionsStore, cuentasStore, tasasStore, comisionesStore, calculatorStore } =
  useTransactionPageContext();
const authStore = useAuthStore();

// B4 (Fase B) — gates de permisos para acciones mutables (admin siempre pasa).
const canCreateTransactions = computed(() => authStore.hasPermission("transactions.create"));
const canUpdateTransactions = computed(() => authStore.hasPermission("transactions.update"));
const canDeleteTransactions = computed(() => authStore.hasPermission("transactions.delete"));

// C1 (Fase C) — labels/badges de estado extraídos a composable puro y testeado.
const { getStatusLabel, statusRowBadgeClass } = useTransactionStatusLabels();

/** Catálogo coin listo para el paso Cotización sin parpadeo de carga. */
function transactionCatalogReadyForCurrentMode(): boolean {
  return (
    calculatorStore.taxRates.length > 0 &&
    calculatorStore.commissions.length > 0 &&
    calculatorStore.lastCoinCatalogWasTrial === calculatorStore.demoMode
  );
}

const {
  ensurePreviewCatalogLoaded,
  buildPreviewSections,
  buildPreviewDestinations,
} = useTransactionPreviewController();

const showCreateModal = ref(false);
const showImportModal = ref(false);
const showImportSimpleModal = ref(false);
const importSimpleFile = ref<File | null>(null);
const fileInputSimple = ref<HTMLInputElement | null>(null);
const importingSimple = ref(false);
const importSimpleError = ref("");
const showPreviewModal = ref(false);
const showTransactionClientModal = ref(false);
const showBankAccountCreateModal = ref(false);
const showBancoCrudModal = ref(false);
/** Abre `BancoCrudModal` directo en formulario de alta (tuerca junto a Banco). */
const bancoCrudOpenForCreate = ref(false);
const bankAccountCreateFlow = ref<"origin" | "destination">("origin");
const transactionBankModalHolder = ref<"natural" | "juridica">("natural");
const previewTransaction = ref<Transaction | null>(null);
const previewLoading = ref(false);
const editModalLoading = ref(false);
const searchQuery = ref("");
const openMenuId = ref<string | null>(null);
const menuTriggerEl = ref<HTMLElement | null>(null);
const menuPosition = reactive({ top: 0, left: 0 });
/** Coordenadas del cursor cuando el menú se abre con clic derecho. */
const menuAnchorPoint = ref<{ x: number; y: number } | null>(null);

const tagsStore = useTagsStore();

/** Etiquetas ofrecidas al registrar: activas, más las que el envío ya tenía. */
const availableTags = computed(() => {
  const selected = new Set(form.tag_ids);
  return tagsStore.tags.filter((t) => t.active || selected.has(t.id));
});

function toggleFormTag(id: string) {
  const at = form.tag_ids.indexOf(id);
  if (at === -1) form.tag_ids.push(id);
  else form.tag_ids.splice(at, 1);
}

function tagChipStyle(color: string | undefined) {
  const c = tagColorStyle(color);
  return { background: c.bg, color: c.fg, borderColor: c.bd };
}

/** Etiquetas de una fila, resueltas contra el catálogo. */
function transactionTags(t: Transaction) {
  const ids = Array.isArray(t.tag_ids) ? t.tag_ids : [];
  return ids
    .map((id) => tagsStore.tagById(id))
    .filter((tag): tag is NonNullable<typeof tag> => tag != null);
}

/** La tabla es ancha: se puede desplazar arrastrando, sin buscar la barra. */
const {
  containerRef: tableScrollRef,
  isDragging: isDraggingTable,
  onPointerDown: onTablePointerDown,
} = useTableDragScroll();
const statusFilter = ref<string>("todos");
const userFilter = ref<string>("");
const bankAccountFilter = ref<string>("");
/** Par origen-destino (p. ej. `brl-pen`); vacío = todas las monedas. */
const currencyPairFilter = ref<string>("");
const createdAtFrom = ref<string>("");
const createdAtTo = ref<string>("");

/**
 * La operación de ventas es diaria: por defecto la tabla muestra un solo día,
 * que es también la unidad del correlativo `#`. `"todas"` levanta el recorte
 * para buscar en el histórico.
 */
type TransactionScope = "day" | "all";

function todayDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const transactionScope = ref<TransactionScope>("day");
const selectedDay = ref<string>(todayDayKey());

const isToday = computed(() => selectedDay.value === todayDayKey());

const selectedDayLabel = computed(() => {
  const [y, m, d] = selectedDay.value.split("-").map(Number);
  if (!y || !m || !d) return selectedDay.value;
  const label = new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
});

function shiftSelectedDay(days: number) {
  const [y = 0, m = 1, d = 1] = selectedDay.value.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  selectedDay.value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
    next.getDate(),
  ).padStart(2, "0")}`;
}

function goToToday() {
  selectedDay.value = todayDayKey();
  transactionScope.value = "day";
}

const isExporting = ref(false);
const exportError = ref("");

/**
 * Descarga en Excel lo mismo que anuncia el contador de resultados, no la
 * página visible: el usuario espera el día completo (o el histórico si está en
 * «Todas»), con los filtros de estado, cliente, moneda y búsqueda aplicados.
 */
async function exportTransactionsToExcel() {
  if (isExporting.value) return;
  isExporting.value = true;
  exportError.value = "";
  try {
    const rows = await transactionsStore.fetchAllForExport(apiFilterParams.value);

    // El correlativo se resuelve con el día completo: calcularlo sobre las filas
    // exportadas daría números corridos en cuanto haya un filtro de estado.
    const days = Array.from(
      new Set(rows.map((t) => transactionDayKey(t)).filter((d): d is string => !!d)),
    );
    await transactionsStore.loadDailySequences(days);

    const XLSX = await import("xlsx");
    const data = buildTransactionExportRows(rows, {
      dailySequenceById: transactionsStore.dailySequenceById,
      clientLabel: getClientLabel,
      companyName: transactionCompanyNameTable,
      destinationAccounts: getTransactionDestinationAccountsLabel,
      currencies: (t) => getTransactionCurrencies(t),
      tagById: (id) => tagsStore.tagById(id),
    });
    const sheet = XLSX.utils.aoa_to_sheet([
      [...TRANSACTION_EXPORT_HEADERS],
      ...data,
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Transacciones");
    XLSX.writeFile(
      book,
      transactionExportFilename(
        transactionScope.value,
        selectedDay.value,
        todayDayKey(),
      ),
    );
  } catch (e) {
    exportError.value =
      e instanceof Error ? e.message : "No se pudo generar el Excel";
  } finally {
    isExporting.value = false;
  }
}
/** Razón social Brasper (catálogo): filtrada por moneda de envío; independiente de cuenta destino del cliente. */
const destinationBankFilterId = ref("");
/**
 * Empresa guardada en la transacción que se edita. Se conserva mientras llegan
 * los catálogos y como respaldo para registros legacy sin banco exacto.
 */
const editStoredCompanyName = ref("");
/** ID exacto persistido para la razón social; nunca se reconstruye por orden de catálogo. */
const editStoredSocialReasonBankId = ref("");
/** Distingue un FK nuevo (incluso `null`) de una transacción legacy sin el campo. */
const editHasStoredSocialReasonBankIdField = ref(false);
/** Distingue un vacío elegido por el usuario de un catálogo que todavía no resolvió. */
const socialReasonSelectionTouched = ref(false);
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
const EDITABLE_USER_ROLES = [
  "admin",
  "commercial",
  "comercial",
  "sales",
  "advisor",
  "asesor",
  "ventas",
] as const;
const editableUsers = ref<
  { id: string; name: string; email: string; role?: string }[]
>([]);
const editableUsersLoaded = ref(false);

const userFilterOptions = computed(() => [
  { value: ALL_VALUE, label: "Todos" },
  ...cuentasStore.transactionFormUsers.map((u) => ({
    value: u.id,
    label: u.name,
  })),
]);

const currencyPairFilterOptions = computed(() => {
  // Pares válidos desde el catálogo de tasas (fuente autoritativa),
  // independiente de la página de transacciones cargada.
  const pairs = new Map<string, string>();
  for (const rate of tasasStore.taxRates) {
    const origin = (rate.coin_a ?? "").toUpperCase();
    const destination = (rate.coin_b ?? "").toUpperCase();
    if (!origin || !destination) continue;
    const key = `${origin.toLowerCase()}-${destination.toLowerCase()}`;
    pairs.set(key, `${origin}-${destination}`);
  }
  return [
    { value: ALL_VALUE, label: "Todas" },
    ...Array.from(pairs.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label })),
  ];
});

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
    const nums = [];
    if (a.account_number?.trim()) nums.push(a.account_number.trim());
    if (a.cci_number?.trim()) nums.push(`CCI: ${a.cci_number.trim()}`);
    if (a.pix_key?.trim()) nums.push(`PIX: ${a.pix_key.trim()}`);
    const accNum = nums.length > 0 ? nums.join(" / ") : "-";
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

type VoucherField = "send_voucher" | "payment_voucher" | "checked_image";
type VoucherFormValue = string | File;

const form = reactive<{
  bank_account_origin_id: string;
  bank_account_destination_id: string;
  destinations: TransactionDestinationDraft[];
  user_id: string;
  agent_id: string;
  tax_rate_id: string;
  commission_id: string;
  status: string;
  checked: boolean;
  tag_ids: string[];
  origin_amount: number;
  destination_amount: number;
  resultado_comision: number | null;
  total_a_enviar: number | null;
  tax_amount: number | null;
  code: string;
  operation_number: string;
  coupon_id: string;
  send_date: string;
  payment_date: string;
  send_voucher: VoucherFormValue[];
  payment_voucher: VoucherFormValue[];
  checked_image: VoucherFormValue[];
}>({
  bank_account_origin_id: "",
  bank_account_destination_id: "",
  destinations: [emptyTransactionDestination()],
  user_id: "",
  agent_id: "",
  tax_rate_id: "",
  commission_id: "",
  status: "verification",
  checked: false,
  tag_ids: [],
  origin_amount: 0,
  destination_amount: 0,
  resultado_comision: null,
  total_a_enviar: null,
  tax_amount: null,
  code: "",
  operation_number: "",
  coupon_id: "",
  send_date: "",
  payment_date: "",
  send_voucher: [],
  payment_voucher: [],
  checked_image: [],
});

const editingId = ref<string | null>(null);
const editSourceTransaction = ref<Transaction | null>(null);
const isEditingMode = computed(() => Boolean(editingId.value));
const isHydratingTransactionForm = ref(false);

/**
 * Comprobantes ya persistidos que el usuario quitó durante la edición.
 * Al guardar se envía `<campo>s_keep` con los que se conservan; el backend
 * borra los demás y agrega los archivos nuevos del mismo request.
 */
const removedPersistedVouchers = reactive<Record<VoucherField, string[]>>({
  send_voucher: [],
  payment_voucher: [],
  checked_image: [],
});

const destinationDraftsModel = computed({
  get: () => form.destinations,
  set: (value: TransactionDestinationDraft[]) => {
    form.destinations = value.length > 0 ? value : [emptyTransactionDestination()];
    form.bank_account_destination_id =
      form.destinations[0]?.bank_account_id?.trim() ?? "";
  },
});

const destinationDistributionValidation = computed(() =>
  validateTransactionDestinations(form.destinations, form.destination_amount),
);

/**
 * Con una sola cuenta destino, su monto sigue automáticamente al monto a
 * recibir (calculadora o corrección de montos). Sin esto, corregir la
 * cotización dejaba la distribución desfasada y bloqueaba el guardado.
 * Con varias cuentas el usuario redistribuye manualmente.
 */
watch(
  () => form.destination_amount,
  (amount) => {
    if (form.destinations.length !== 1) return;
    const destination = form.destinations[0];
    if (!destination) return;
    const rounded = roundMoneyAmount(Number(amount) || 0);
    if (rounded <= 0) return;
    if (roundMoneyAmount(Number(destination.amount) || 0) === rounded) return;
    form.destinations = [{ ...destination, amount: rounded }];
  },
);

function clearStoredSocialReasonSelection() {
  editStoredCompanyName.value = "";
  editStoredSocialReasonBankId.value = "";
  editHasStoredSocialReasonBankIdField.value = false;
}

/** Contrato v-model: solo una elección emitida por el dropdown toma control del valor. */
const destinationBankSelectionModel = computed({
  get: () => destinationBankFilterId.value,
  set: (value: string) => {
    destinationBankFilterId.value = value?.trim() ?? "";
    // La hidratación escribe directamente en `destinationBankFilterId`; este setter
    // solo representa una decisión de UI y debe ganar incluso si un GET tardío sigue activo.
    socialReasonSelectionTouched.value = true;
    clearStoredSocialReasonSelection();
  },
});

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
const confirmedNegativeSpecialDiscountSignature = ref<string | null>(null);
const editQuoteCorrectionMode = ref(false);

type CreateQuoteSnapshot = {
  calculationMode: "normal" | "special";
  origin_amount: number;
  destination_amount: number;
  resultado_comision: number | null;
  total_a_enviar: number | null;
  tax_amount: number | null;
  tax_rate_id: string;
  commission_id: string;
  specialDiscountAmount?: number;
  specialDiscountPercentage?: number;
  specialBaseReceive?: number;
};

const createQuoteSnapshot = ref<CreateQuoteSnapshot | null>(null);

const isLastCreateStep = computed(
  () => createStepIndex.value === CREATE_FLOW_STEPS.length - 1,
);

function goToCreateStep(index: number) {
  if (index < 0 || index >= CREATE_FLOW_STEPS.length) return;
  if (index > createStepIndex.value) return;
  createStepIndex.value = index;
  if (transactionsStore.error) transactionsStore.error = null;
}

function negativeSpecialDiscountSignature(): string | null {
  const res = calculatorStore.result;
  if (
    calculatorStore.calculationMode !== "special" ||
    !res ||
    res.specialDiscountAmount >= -0.005
  ) {
    return null;
  }

  return [
    calculatorStore.currencyFrom,
    calculatorStore.currencyTo,
    roundMoneyAmount(res.amountSend),
    roundMoneyAmount(res.specialTargetReceive),
    roundMoneyAmount(res.specialDiscountAmount),
  ].join("|");
}

const showNegativeDiscountConfirm = ref(false);
const negativeDiscountMessage = ref("");

/**
 * Gate del descuento especial negativo. Si aún no se confirmó para la firma
 * actual, abre el ConfirmDialog y devuelve `false` (bloquea el avance). Tras
 * confirmar, `confirmNegativeSpecialDiscount()` registra la firma y reintenta
 * `goCreateNext()`, de modo que el flujo prosigue igual que con el confirm nativo.
 */
function confirmNegativeSpecialDiscountIfNeeded(): boolean {
  const signature = negativeSpecialDiscountSignature();
  if (!signature || confirmedNegativeSpecialDiscountSignature.value === signature) {
    return true;
  }

  const res = calculatorStore.result;
  if (!res) return true;

  negativeDiscountMessage.value = `El descuento especial calculado es negativo (${formatValue(
    res.specialDiscountAmount,
  )}). ¿Deseas consignar este monto negativo?`;
  showNegativeDiscountConfirm.value = true;
  return false;
}

function confirmNegativeSpecialDiscount() {
  showNegativeDiscountConfirm.value = false;
  const signature = negativeSpecialDiscountSignature();
  if (signature) confirmedNegativeSpecialDiscountSignature.value = signature;
  transactionsStore.error = null;
  goCreateNext();
}

function cancelNegativeSpecialDiscount() {
  showNegativeDiscountConfirm.value = false;
  transactionsStore.error =
    "Confirma si deseas consignar el descuento especial en negativo para continuar.";
}

function goCreateNext() {
  const i = createStepIndex.value;
  if (i === 0) {
    syncFromCalculatorIfSafe();
    const calculatorError = getCalculatorBlockingError();
    if (calculatorError) {
      transactionsStore.error = calculatorError;
      return;
    }
    if (
      !form.tax_rate_id?.trim() ||
      !form.commission_id?.trim() ||
      (Number(form.origin_amount) <= 0 && Number(form.destination_amount) <= 0)
    ) {
      transactionsStore.error =
        "Completa la cotización: montos y tasa/comisión antes de continuar.";
      return;
    }
    if (!confirmNegativeSpecialDiscountIfNeeded()) {
      // Descuento negativo sin confirmar: el ConfirmDialog quedó abierto y, al
      // confirmar, se reintenta este avance; al cancelar se muestra el aviso.
      return;
    }
    transactionsStore.error = null;
    form.origin_amount = roundMoneyAmount(Number(form.origin_amount) || 0);
    form.destination_amount = roundMoneyAmount(
      Number(form.destination_amount) || 0,
    );
    createQuoteSnapshot.value = buildCreateQuoteSnapshot();
    createStepIndex.value = 1;
    return;
  }
  if (i === 1) {
    if (!form.user_id?.trim() || !form.bank_account_destination_id?.trim()) {
      transactionsStore.error =
        "Indica cliente y cuenta destino para continuar.";
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

function openEditQuoteCorrection() {
  if (!isEditingMode.value) return;
  transactionsStore.error = null;
  syncCalculatorFromForm();
  editQuoteCorrectionMode.value = true;
}

function cancelEditQuoteCorrection() {
  editQuoteCorrectionMode.value = false;
  if (transactionsStore.error) transactionsStore.error = null;
}

function applyEditQuoteCorrection() {
  const calculatorError = getCalculatorBlockingError();
  if (calculatorError) {
    transactionsStore.error = calculatorError;
    return;
  }
  syncFromCalculator();
  form.origin_amount = roundMoneyAmount(Number(form.origin_amount) || 0);
  form.destination_amount = roundMoneyAmount(
    Number(form.destination_amount) || 0,
  );
  transactionsStore.error = null;
  editQuoteCorrectionMode.value = false;
}

function openTransactionClientModal() {
  transactionsStore.error = null;
  showTransactionClientModal.value = true;
}

function onTransactionClientCreated(user: UserListItem) {
  form.user_id = user.id;
  void cuentasStore.loadTransactionFormUsers(true);
  void cuentasStore.loadClientUsers(true);
}

function openBankAccountModalFromTransaction(flow: "origin" | "destination") {
  if (!form.user_id?.trim()) {
    transactionsStore.error =
      "Selecciona un cliente antes de crear una cuenta bancaria.";
    return;
  }
  transactionsStore.error = null;
  bankAccountCreateFlow.value = flow;
  showBankAccountCreateModal.value = true;
}

async function onTransactionBankAccountCreated(account: BankAccount) {
  const userId = form.user_id?.trim();
  if (userId) {
    await cuentasStore.loadBankAccountsForTransactionUser(userId);
  }
  if (bankAccountCreateFlow.value === "origin") {
    form.bank_account_origin_id = account.id;
  } else {
    const emptyIndex = form.destinations.findIndex(
      (destination) => !destination.bank_account_id.trim(),
    );
    const next = [...form.destinations];
    if (emptyIndex >= 0) {
      next[emptyIndex] = {
        ...(next[emptyIndex] ?? emptyTransactionDestination()),
        bank_account_id: account.id,
      };
    } else {
      next.push({ bank_account_id: account.id, amount: null });
    }
    destinationDraftsModel.value = next;
  }
}

function bankAccountToOption(a: BankAccount) {
  const bank = cuentasStore.banks.find((b) => b.id === a.bank_id);
  const bankName = bank
    ? `${bank.bank}${bank.currency ? ` (${bank.currency})` : ""}`
    : "-";
  const holder =
    (a.account_holder_type ?? "").toLowerCase().includes("juridica") ||
    (a.account_holder_type ?? "").toLowerCase().includes("jurídica") ||
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

/** Cuenta destino: mínimo en lista; metadatos de banco vía `bankMetaFromDestinationAccount`. */
function destinationBankAccountToOption(a: BankAccount): {
  value: string;
  label: string;
} {
  const bank = cuentasStore.banks.find((b) => b.id === a.bank_id);
  const bankName = (bank?.bank ?? "—").trim();
  return {
    value: String(a.id).trim(),
    label: formatDestinationAccountOptionLabel(a, bankName),
  };
}

function findBankAccountById(accountId: string): BankAccount | undefined {
  const id = accountId?.trim();
  if (!id) return undefined;
  const userId = form.user_id?.trim();
  const fromClient = bankAccountsForSelectedClient().find(
    (a) => String(a.id).trim() === id,
  );
  if (fromClient) return fromClient;
  const fromGlobal = cuentasStore.bankAccounts.find(
    (a) => String(a.id).trim() === id,
  );
  if (fromGlobal && userId && bankAccountBelongsToClient(fromGlobal, userId)) {
    return fromGlobal;
  }
  const fromTxn = cuentasStore.transactionFormBankAccounts.find(
    (a) => String(a.id).trim() === id,
  );
  if (fromTxn && userId && bankAccountBelongsToClient(fromTxn, userId)) {
    return fromTxn;
  }
  return undefined;
}

/** Metadatos de banco desde el catálogo (razón social / empresa que recibe el envío). */
function bankMetaFromCatalogBankId(
  bankId: string,
): {
  bank_id: string;
  bank_name: string;
  company_name: string;
  social_reason_bank_id: string;
} | null {
  const trimmed = bankId?.trim();
  if (!trimmed) return null;
  const bank = cuentasStore.banks.find((b) => String(b.id).trim() === trimmed);
  if (!bank) return null;
  const bank_name = (bank.bank ?? "").trim();
  const company_name =
    (bank.company ?? "").toString().trim() || bank_name || trimmed;
  return {
    bank_id: trimmed,
    bank_name,
    company_name,
    social_reason_bank_id: trimmed,
  };
}

/**
 * Resuelve la selección persistida. El fallback legacy por empresa + moneda solo
 * devuelve un ID cuando existe una coincidencia inequívoca.
 */
function resolveStoredSocialReasonBankId(
  persistedBankId: string,
  companyName: string,
): string {
  return resolveSocialReasonBankId({
    persistedBankId,
    companyName,
    originCurrency: selectedAccountCurrencies.value.origin,
    banks: cuentasStore.banks,
  });
}

/** Metadatos de banco para POST/PUT desde la cuenta destino del cliente. */
function bankMetaFromDestinationAccount(
  accountId: string,
): { bank_id: string; bank_name: string; company_name: string } | null {
  const trimmed = accountId?.trim();
  if (!trimmed) return null;
  const account = findBankAccountById(trimmed);
  if (!account?.bank_id?.trim()) return null;
  const bank = cuentasStore.banks.find((b) => b.id === account.bank_id);
  const bank_name = (bank?.bank ?? "").trim();
  const holderType = (account.account_holder_type ?? "").toLowerCase();
  const isLegal =
    holderType.includes("juridica") ||
    holderType.includes("jurídica") ||
    holderType.includes("legal");
  const holderLine = [account.holder_names, account.holder_surnames]
    .filter(Boolean)
    .join(" ")
    .trim();
  const company_name =
    (isLegal ? (account.business_name ?? "").trim() : holderLine) ||
    bank_name ||
    "";
  return {
    bank_id: account.bank_id.trim(),
    bank_name,
    company_name,
  };
}

/**
 * Metadatos para POST/PUT. El API exige que `bank_id` sea el de `bank_account_destination`.
 * La razón social (catálogo en moneda de envío) solo aporta `company_name`.
 */
function resolveTransactionBankMeta(): {
  bank_id: string;
  bank_name: string;
  company_name: string;
  social_reason_bank_id?: string | null;
} | null {
  const fromAccount = bankMetaFromDestinationAccount(
    form.bank_account_destination_id,
  );
  const razonSocial = bankMetaFromCatalogBankId(destinationBankFilterId.value);
  const socialReasonBankId = (
    destinationBankFilterId.value ||
    (editingId.value ? editStoredSocialReasonBankId.value : "")
  ).trim();
  const socialReasonBankPayload = socialReasonBankId
    ? socialReasonBankId
    : editingId.value && socialReasonSelectionTouched.value
      ? null
      : undefined;
  // Empresa a persistir: la elegida en el dropdown; o —en edición y sin selección
  // nueva— la que ya traía la transacción, para no perderla si no está en catálogo.
  const razonSocialCompany = (
    razonSocial?.company_name ??
    (editingId.value ? editStoredCompanyName.value : "")
  ).trim();
  if (fromAccount) {
    return {
      ...fromAccount,
      ...(razonSocialCompany ? { company_name: razonSocialCompany } : {}),
      ...(socialReasonBankPayload !== undefined
        ? { social_reason_bank_id: socialReasonBankPayload }
        : {}),
    };
  }
  if (!razonSocial) return null;
  return {
    ...razonSocial,
    ...(socialReasonBankPayload !== undefined
      ? { social_reason_bank_id: socialReasonBankPayload }
      : {}),
  };
}

function getBankAccountCurrency(a: BankAccount): string {
  const bank = cuentasStore.banks.find((b) => b.id === a.bank_id);
  return normalizeCurrencyCode(bank?.currency);
}

function getBankAccountCurrencyById(id: string | undefined): string {
  if (!id?.trim()) return "";
  const account = findBankAccountById(id);
  return account ? getBankAccountCurrency(account) : "";
}

const selectedAccountCurrencies = computed(() => {
  const selectedRate = tasasStore.taxRates.find(
    (item) => item.id === form.tax_rate_id,
  );
  return {
    origin: normalizeCurrencyCode(
      selectedRate?.coin_a ?? calculatorStore.currencyFrom,
    ),
    destination: normalizeCurrencyCode(
      selectedRate?.coin_b ?? calculatorStore.currencyTo,
    ),
  };
});

/** País del modal de cuenta según moneda de destino de la cotización (BR para BRL, PE para PEN). */
const transactionBankModalCountry = computed((): "pe" | "br" => {
  const dest = selectedAccountCurrencies.value.destination;
  if (dest === "BRL") return "br";
  if (dest === "PEN") return "pe";
  const to = (calculatorStore.currencyTo ?? "").trim().toLowerCase();
  return to === "brl" ? "br" : "pe";
});

const currencyResolutionLookups = computed(() => ({
  taxRateById: (id: string) =>
    tasasStore.taxRates.find((item) => item.id === id),
  commissionById: (id: string) =>
    comisionesStore.commissions.find((item) => item.id === id),
  bankAccountCurrencyById: (id: string) => getBankAccountCurrencyById(id),
}));

function getTransactionCurrencies(t: Transaction, fallbackToSelected = false) {
  const pair = resolveTransactionCurrencyPair(
    t,
    currencyResolutionLookups.value,
  );
  return {
    origin:
      pair.origin ||
      (fallbackToSelected ? selectedAccountCurrencies.value.origin : ""),
    destination:
      pair.destination ||
      (fallbackToSelected ? selectedAccountCurrencies.value.destination : ""),
  };
}

function asCurrencyCode(value: string): CurrencyCode | null {
  const code = value.trim().toLowerCase();
  if (code === "pen" || code === "usd" || code === "brl") return code;
  return null;
}

function getTransactionOriginCurrency(t: Transaction): string {
  return (
    getTransactionCurrencies(t).origin ||
    inferOriginCurrencyFromTransactionCode(t.code)
  );
}

function getTransactionOriginFlag(
  t: Transaction,
): { src: string; label: string } | null {
  const origin = getTransactionOriginCurrency(t);
  const code = asCurrencyCode(origin);
  if (!code) return null;
  return {
    src: CURRENCY_FLAG_SRC_BY_CODE[code],
    label: origin ? `Envía ${origin}` : "Moneda de envío",
  };
}

function getTransactionExchangeRate(t: Transaction): number | null {
  const rec = t as Record<string, unknown>;
  const raw = t.tax_amount ?? rec.tipo_cambio ?? rec.rate;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Tabla: solo el valor numérico del tipo de cambio (p. ej. `0,653`). */
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
  const conversion =
    rate != null && from !== "—" && to !== "—"
      ? `1 ${from} = ${formatValue(rate)} ${to}`
      : from !== "—" && to !== "—"
        ? `${from} → ${to}`
        : "—";
  const rateCatalog = getTaxRatePreviewLabel(t.tax_rate_id);
  if (!rateCatalog || rateCatalog === "—" || rateCatalog === t.tax_rate_id) {
    return conversion;
  }
  return `${conversion} · Catálogo ${rateCatalog}`;
}

watch(
  () => [
    calculatorStore.result?.amountSend,
    calculatorStore.result?.amountReceive,
    calculatorStore.result?.baseCommission,
    calculatorStore.result?.finalCommission,
    calculatorStore.result?.rate,
    calculatorStore.calculationMode,
    calculatorStore.inputMode,
  ],
  () => {
    if (!showCreateModal.value || isEditingMode.value || createStepIndex.value !== 0) return;
    syncFromCalculatorIfSafe();
  },
  { flush: "post" },
);

function bankAccountMatchesCurrency(
  account: BankAccount,
  expectedCurrency: string,
): boolean {
  const currency = normalizeCurrencyCode(expectedCurrency);
  if (!currency) return true;
  const accountCurrency = getBankAccountCurrency(account);
  if (!accountCurrency) return true;
  return accountCurrency === currency;
}

function getBankAccountCountry(a: BankAccount): string {
  return (a.bank_country ?? "").trim().toLowerCase();
}

function bankAccountMatchesFlow(
  account: BankAccount,
  flow: "origin" | "destination",
): boolean {
  const accountFlow = (account.account_flow ?? "").trim().toLowerCase();
  if (!accountFlow) return true;
  return accountFlow === flow;
}

function bankAccountMatchesSide(
  account: BankAccount,
  flow: "origin" | "destination",
): boolean {
  if (bankAccountMatchesFlow(account, flow)) return true;
  const country = getBankAccountCountry(account);
  if (!country) return true;
  return flow === "origin" ? country === "pe" : country === "br";
}

function mergeMissingSelectedAccount(
  options: { value: string; label: string }[],
  selectedId: string,
  expectedCurrency = "",
  mapAccount: (a: BankAccount) => { value: string; label: string } = bankAccountToOption,
): { value: string; label: string }[] {
  const id = selectedId?.trim();
  if (!id) return options;
  if (options.some((o) => String(o.value) === id)) return options;
  const acc = findBankAccountById(id);
  if (!acc) return options;
  const userId = form.user_id?.trim();
  if (userId && !bankAccountBelongsToClient(acc, userId)) return options;
  if (!bankAccountMatchesCurrency(acc, expectedCurrency)) return options;
  return [...options, mapAccount(acc)];
}

function bankAccountBelongsToClient(account: BankAccount, userId: string): boolean {
  const uid = userId.trim();
  if (!uid) return false;
  return String(account.user_id ?? "").trim() === uid;
}

function bankAccountsBelongingToClient(
  userId: string,
  accounts: BankAccount[],
): BankAccount[] {
  return accounts.filter((a) => bankAccountBelongsToClient(a, userId));
}

function bankAccountsForSelectedClient(): BankAccount[] {
  const userId = form.user_id?.trim();
  if (!userId) return [];
  const storeUserId = cuentasStore.transactionFormBankAccountsUserId?.trim() ?? "";
  const loadedForUser = storeUserId === userId;
  if (cuentasStore.transactionFormBankAccountsLoading && !loadedForUser) {
    return [];
  }
  if (loadedForUser) {
    return bankAccountsBelongingToClient(
      userId,
      cuentasStore.transactionFormBankAccounts,
    );
  }
  if (cuentasStore.transactionFormBankAccountsLoading) return [];
  return bankAccountsBelongingToClient(userId, cuentasStore.bankAccounts);
}

function isBankAccountSelectable(
  id: string,
  flow: "origin" | "destination",
  expectedCurrency: string,
): boolean {
  const accountId = id?.trim();
  if (!accountId) return true;
  const userId = form.user_id?.trim();
  const account = findBankAccountById(accountId);
  if (!account) return false;
  if (flow === "origin" && !bankAccountMatchesSide(account, flow)) return false;
  if (flow === "destination") {
    if (!bankAccountMatchesSide(account, flow)) return false;
    if (userId && !bankAccountBelongsToClient(account, userId)) return false;
  }
  return bankAccountMatchesCurrency(account, expectedCurrency);
}

/** IDs desde API (string, número u objeto `{ id }`) → string para v-model y dropdowns. */
function normalizeSelectId(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "object" && v !== null && "id" in v) {
    const id = (v as { id: unknown }).id;
    return id != null && id !== "" ? String(id).trim() : "";
  }
  return String(v).trim();
}

const destinationAccountOptions = computed(() => {
  const userId = form.user_id?.trim();
  if (!userId) return [];
  const currency = selectedAccountCurrencies.value.destination;
  const base = bankAccountsForSelectedClient()
    .filter((a) => String(a.id ?? "").trim())
    .filter((a) => bankAccountMatchesSide(a, "destination"))
    .filter((a) => bankAccountMatchesCurrency(a, currency))
    .map(destinationBankAccountToOption);
  return mergeMissingSelectedAccount(
    base,
    form.bank_account_destination_id,
    currency,
    destinationBankAccountToOption,
  );
});

const showDestinationAccountsEmptyHint = computed(() => {
  if (!form.user_id?.trim()) return false;
  if (cuentasStore.transactionFormBankAccountsLoading) return false;
  return destinationAccountOptions.value.length === 0;
});

const destinationAccountsLoading = computed(
  () =>
    Boolean(form.user_id?.trim()) &&
    cuentasStore.transactionFormBankAccountsLoading,
);

function bankCatalogOptionLabel(b: BankOption): string {
  const parts: string[] = [];
  const comp = (b.company ?? "").toString().trim();
  if (comp) parts.push(comp);
  const name = (b.bank ?? "").trim();
  if (name) parts.push(name);
  const cur = (b.currency ?? "").trim();
  if (cur) parts.push(cur.toUpperCase());
  const ctry = (b.country ?? "").trim();
  if (ctry) parts.push(ctry.toUpperCase());
  return parts.length ? parts.join(" · ") : "—";
}

function bankCatalogCompanySortKey(b: BankOption): string {
  const company = (b.company ?? "").toString().trim();
  return company || bankCatalogOptionLabel(b);
}

const bancoCrudHintCountry = computed((): "pe" | "br" =>
  (calculatorStore.currencyFrom ?? "").toLowerCase() === "brl" ? "br" : "pe",
);

function openBancoCrudForCreate() {
  bancoCrudOpenForCreate.value = true;
  showBancoCrudModal.value = true;
}

function onBancoCrudSaved(payload?: {
  selectBankId?: string;
  deletedBankId?: string;
}) {
  if (payload?.deletedBankId) {
    const deletedId = payload.deletedBankId.trim();
    cuentasStore.removeBankFromCatalog(deletedId);
    if (destinationBankFilterId.value === deletedId) {
      destinationBankSelectionModel.value = "";
    }
    return;
  }
  if (payload?.selectBankId?.trim()) {
    destinationBankSelectionModel.value = payload.selectBankId.trim();
  }
  void cuentasStore.loadBanks(true);
}

/** Bancos del catálogo (razón social) filtrados por la moneda de envío de la cotización. */
const destinationBankFilterOptions = computed(() => {
  const currency = selectedAccountCurrencies.value.origin;
  const opts = cuentasStore.banks
    .filter((b) => {
      const bankCurrency = normalizeCurrencyCode(b.currency);
      return !currency || !bankCurrency || bankCurrency === currency;
    })
    .sort((a, b) => {
      const byCompany = bankCatalogCompanySortKey(a).localeCompare(
        bankCatalogCompanySortKey(b),
        "es",
      );
      if (byCompany !== 0) return byCompany;
      return bankCatalogOptionLabel(a).localeCompare(bankCatalogOptionLabel(b), "es");
    })
    .map((b) => ({
      value: b.id,
      label: bankCatalogOptionLabel(b),
    }));
  const selectedId = destinationBankFilterId.value?.trim();
  if (
    selectedId &&
    !opts.some((o) => String(o.value) === selectedId)
  ) {
    const bank = cuentasStore.banks.find((b) => String(b.id).trim() === selectedId);
    if (bank) {
      // Mostrar SIEMPRE la razón social seleccionada, aunque su moneda no sea la de
      // envío (p. ej. transacciones antiguas cuyo company_name venía de la cuenta destino).
      // Un filtro no debe ocultar el valor que ya está elegido.
      opts.push({ value: bank.id, label: bankCatalogOptionLabel(bank) });
    }
  }
  return [{ value: "", label: "Todos" }, ...opts];
});

function mergeMissingTransactionUser(
  options: { value: string; label: string }[],
  selectedId: string,
): { value: string; label: string }[] {
  const id = selectedId?.trim();
  if (!id) return options;
  if (options.some((o) => String(o.value) === id)) return options;
  const u = cuentasStore.transactionFormUsers.find((x) => String(x.id) === id);
  if (!u) return options;
  return [...options, { value: u.id, label: u.name }];
}

function mergeMissingEditableUser(
  options: { value: string; label: string }[],
  selectedId: string,
): { value: string; label: string }[] {
  const id = selectedId?.trim();
  if (!id) return options;
  if (options.some((o) => String(o.value) === id)) return options;

  const existing =
    editableUsers.value.find((u) => String(u.id) === id) ??
    cuentasStore.transactionFormUsers.find((u) => String(u.id) === id) ??
    cuentasStore.clientUsers.find((u) => String(u.id) === id);

  if (existing) {
    return [...options, { value: existing.id, label: existing.name }];
  }

  return [...options, { value: id, label: id }];
}

const clientOptions = computed(() => {
  const byId = new Map<string, { value: string; label: string }>();
  for (const u of cuentasStore.clientUsers) {
    byId.set(u.id, { value: u.id, label: u.name });
  }
  for (const u of cuentasStore.transactionFormUsers) {
    const role = (u.role ?? "").toLowerCase();
    if (role && !["client", "cliente"].includes(role)) continue;
    byId.set(u.id, { value: u.id, label: u.name });
  }
  const base = Array.from(byId.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
  return mergeMissingTransactionUser(base, form.user_id);
});

const editableUserOptions = computed(() => {
  const base = editableUsers.value.map((u) => ({
    value: u.id,
    label: u.name,
  }));
  return mergeMissingEditableUser(base, form.user_id);
});

function isSalesAdvisorRole(role?: string | null): boolean {
  return [
    "sales",
    "ventas",
    "commercial",
    "comercial",
    "advisor",
    "asesor",
  ].includes((role ?? "").trim().toLowerCase());
}

function getTransactionUserRoleLabel(role?: string | null): string {
  const normalized = (role ?? "").trim().toLowerCase();
  if (["sales", "ventas"].includes(normalized)) return "Ventas";
  if (["commercial", "comercial", "advisor", "asesor"].includes(normalized))
    return "Asesor";
  if (["client", "cliente"].includes(normalized)) return "Cliente";
  return "";
}

function isCurrentUserSalesAdvisor(): boolean {
  const user = authStore.user;
  if (!user) return false;
  return isSalesAdvisorRole(user.role) || user.is_agent === true;
}

function getCurrentUserEditableOption():
  | { id: string; name: string; email: string; role?: string }
  | null {
  const user = authStore.user;
  if (!user || !isCurrentUserSalesAdvisor()) return null;
  return {
    id: user.id,
    name:
      user.name ||
      [user.names, user.lastnames].filter(Boolean).join(" ") ||
      user.email,
    email: user.email,
    role: user.role ?? "advisor",
  };
}

function ensureCurrentSalesAdvisorOption() {
  const currentUser = getCurrentUserEditableOption();
  if (!currentUser) return;
  if (editableUsers.value.some((u) => String(u.id) === currentUser.id)) return;
  editableUsers.value = [...editableUsers.value, currentUser].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
}

function applyDefaultAgentForCurrentUser(force = false) {
  const currentUser = getCurrentUserEditableOption();
  if (!currentUser) return;
  ensureCurrentSalesAdvisorOption();
  if (force || !form.agent_id?.trim()) {
    form.agent_id = currentUser.id;
  }
}

const salesAdvisorOptions = computed(() =>
  editableUsers.value
    .filter((u) => isSalesAdvisorRole(u.role))
    .map((u) => {
      const roleLabel = getTransactionUserRoleLabel(u.role);
      return {
        value: u.id,
        label: roleLabel ? `${u.name} - ${roleLabel}` : u.name,
      };
    }),
);

/** Par de cotización para acotar listas de tasa/comisión en paso Datos. */
function transactionQuoteCoinPair(): { from: string; to: string } {
  const from = (calculatorStore.currencyFrom ?? "").toLowerCase();
  const to = (calculatorStore.currencyTo ?? "").toLowerCase();
  return { from, to };
}

const taxRateOptions = computed(() => {
  const { from, to } = transactionQuoteCoinPair();
  const all = tasasStore.taxRates;
  const filtered =
    from && to
      ? all.filter(
          (r) =>
            (r.coin_a ?? "").toLowerCase() === from &&
            (r.coin_b ?? "").toLowerCase() === to,
        )
      : [];
  const list = filtered.length > 0 ? filtered : all;
  return list.map((r) => ({
    value: r.id,
    label: `${r.coin_a}-${r.coin_b} (${r.tax})`,
  }));
});

const commissionOptions = computed(() => {
  const { from, to } = transactionQuoteCoinPair();
  const all = comisionesStore.commissions;
  const filtered =
    from && to
      ? all.filter(
          (c) =>
            (c.coin_a ?? "").toLowerCase() === from &&
            (c.coin_b ?? "").toLowerCase() === to,
        )
      : [];
  const list = filtered.length > 0 ? filtered : all;
  return list.map((c) => ({
    value: c.id,
    label: `${c.coin_a}-${c.coin_b} (${c.percentage}%)`,
  }));
});

/** Razón social o cuenta destino sin banco resoluble en catálogo local (aviso ámbar). */
const showDestinationBankCatalogWarning = computed(
  () =>
    Boolean(
      destinationBankFilterId.value?.trim() ||
        form.bank_account_destination_id?.trim(),
    ) && resolveTransactionBankMeta() === null,
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

/**
 * Parámetros enviados al API. El filtrado (estado efectivo, cuenta origen/destino,
 * par de monedas, rango por `send_date`, búsqueda) y la paginación se resuelven
 * en el servidor.
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
  const pair = currencyPairFilter.value?.trim();
  if (pair) {
    const [origin, destination] = pair.split("-");
    if (origin) p.origin_currency = origin.toUpperCase();
    if (destination) p.destination_currency = destination.toUpperCase();
  }
  // En modo día el recorte lo define `selectedDay`; los campos desde/hasta solo
  // se usan al mirar el histórico completo.
  const fromMs =
    transactionScope.value === "day"
      ? localDateInputStartMs(selectedDay.value)
      : localDateInputStartMs(createdAtFrom.value);
  const toMs =
    transactionScope.value === "day"
      ? localDateInputEndMs(selectedDay.value)
      : localDateInputEndMs(createdAtTo.value);
  if (fromMs != null) p.send_date_from = new Date(fromMs).toISOString();
  if (toMs != null) p.send_date_to = new Date(toMs).toISOString();
  const q = debouncedSearch.value.trim();
  if (q) p.search = q;
  return p;
});

/** Página actual (ya filtrada y paginada por el servidor). */
const paginatedTransactions = computed(() => transactionsStore.transactions);

/** Días (`YYYY-MM-DD`) presentes en la página visible. */
const visibleDayKeys = computed(() => {
  const keys = new Set<string>();
  for (const t of paginatedTransactions.value) {
    const key = transactionDayKey(t);
    if (key) keys.add(key);
  }
  return Array.from(keys);
});

/**
 * Correlativo del envío dentro de su día. Se pide al store porque la página
 * visible no basta para numerar el día completo (paginación de servidor).
 */
const dailySequenceById = computed(() => transactionsStore.dailySequenceById);

function transactionDailyNumber(t: Transaction): string {
  const id = t.id ?? "";
  const n = id ? dailySequenceById.value[id] : undefined;
  return n != null ? String(n) : "—";
}

watch(
  // La generación entra en la fuente para que, tras guardar o borrar, el
  // correlativo se vuelva a pedir aunque los días visibles no hayan cambiado.
  [visibleDayKeys, () => transactionsStore.sequenceGeneration],
  ([keys]) => {
    if (keys.length) void transactionsStore.loadDailySequences(keys);
  },
  { immediate: true },
);

watch(
  paginatedTransactions,
  (rows) => {
    if (rows.length) void resolveMissingClientNames(rows);
  },
  { immediate: true },
);

const totalResults = computed(() => transactionsStore.total);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalResults.value / perPage.value)),
);

function syncCurrentPageToTotal() {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value;
  }
}

function resetForm() {
  form.bank_account_origin_id = "";
  form.bank_account_destination_id = "";
  form.destinations = [emptyTransactionDestination()];
  form.user_id = "";
  form.agent_id = "";
  form.tax_rate_id = "";
  form.commission_id = "";
  form.status = "verification";
  form.checked = false;
  form.tag_ids = [];
  form.origin_amount = 0;
  form.destination_amount = 0;
  form.resultado_comision = null;
  form.total_a_enviar = null;
  form.tax_amount = null;
  form.code = "";
  form.operation_number = "";
  form.coupon_id = "";
  form.send_date = "";
  form.payment_date = "";
  form.send_voucher = [];
  form.payment_voucher = [];
  form.checked_image = [];
  removedPersistedVouchers.send_voucher = [];
  removedPersistedVouchers.payment_voucher = [];
  removedPersistedVouchers.checked_image = [];
  revokeVoucherFileObjectUrls();
  editingId.value = null;
  editSourceTransaction.value = null;
  editQuoteCorrectionMode.value = false;
  confirmedNegativeSpecialDiscountSignature.value = null;
  createQuoteSnapshot.value = null;
  destinationBankFilterId.value = "";
  clearStoredSocialReasonSelection();
  socialReasonSelectionTouched.value = false;
  void cuentasStore.loadBankAccountsForTransactionUser(undefined);
  calculatorStore.resetCalculatorMode();
  calculatorStore.resetAmounts();
  calculatorStore.clearEditRateLock();
  calculatorStore.updateSelectedIds();
}

function getCalculatorBlockingError(): string | null {
  const res = calculatorStore.result;
  if (!res) return "Completa la cotización: montos y tasa/comisión antes de continuar.";
  if (
    calculatorStore.calculationMode === "special" &&
    !res.specialDiscountValid
  ) {
    return (
      res.specialDiscountInvalidReason ??
      "El descuento especial calculado no es válido para esta cotización."
    );
  }
  return null;
}

/** ¿La transacción en edición se creó con la calculadora especial? */
function isEditingSpecialTransaction(): boolean {
  if (!editingId.value) return false;
  if (getTransactionSpecialDiscountMeta(editingId.value)) return true;
  const src = editSourceTransaction.value;
  return Boolean(src && isSpecialCalculatorDiscountCode(src.coupon_discount_code));
}

function syncCalculatorFromForm() {
  calculatorStore.resetCalculatorMode();
  const rate = calculatorStore.taxRates.find(
    (item) => item.id === form.tax_rate_id,
  );
  if (rate) {
    calculatorStore.setCurrencyFrom(rate.from);
    calculatorStore.setCurrencyTo(rate.to);
  }

  // Al editar, la calculadora debe usar el tipo de cambio guardado en la transacción
  // (no el catálogo vivo). Así los montos no cambian al corregir ni al guardar.
  const storedRate = Number(form.tax_amount);
  if (rate && editingId.value && Number.isFinite(storedRate) && storedRate > 0) {
    calculatorStore.setEditRateLock(rate.from, rate.to, storedRate);
  } else {
    calculatorStore.clearEditRateLock();
  }

  const originAmount = Number(form.origin_amount) || 0;
  const destinationAmount = Number(form.destination_amount) || 0;

  // Si la transacción en edición es ESPECIAL, "Corregir montos" abre la calculadora
  // directamente en modo especial con el monto destino guardado (p. ej. 1450), en vez de
  // recalcular la cotización normal (que daría 1449.18) y confundir.
  if (
    isEditingSpecialTransaction() &&
    originAmount > 0 &&
    destinationAmount > 0
  ) {
    calculatorStore.setSpecialQuote(originAmount, destinationAmount);
    return;
  }

  if (originAmount > 0) {
    calculatorStore.setAmountSend(originAmount);
    calculatorStore.recalcFromSend();
    return;
  }

  if (destinationAmount > 0) {
    calculatorStore.setAmountReceive(destinationAmount);
    calculatorStore.recalcFromReceive();
    return;
  }

  calculatorStore.resetAmounts();
  calculatorStore.updateSelectedIds();
}

function syncFromCalculator() {
  const res = calculatorStore.result;
  form.origin_amount = roundMoneyAmount(
    res?.amountSend ?? calculatorStore.amountSend ?? 0,
  );
  form.destination_amount = roundMoneyAmount(
    res?.amountReceive ?? calculatorStore.amountReceive ?? 0,
  );
  form.tax_rate_id = calculatorStore.selectedTaxRateId ?? "";
  form.commission_id = calculatorStore.selectedCommissionId ?? "";
  form.coupon_id = "";
  if (res) {
    const isSpecialCalculation =
      calculatorStore.calculationMode === "special" ||
      res.calculationMode === "special";
    const commissionResult =
      isSpecialCalculation && Number.isFinite(res.finalCommission)
        ? res.finalCommission
        : res.commission;
    const totalToSend =
      isSpecialCalculation && Number.isFinite(res.totalToSend)
        ? res.totalToSend
        : res.amountSend - commissionResult;

    form.resultado_comision = commissionResult;
    form.total_a_enviar = totalToSend;
    form.tax_amount = res.rate;
  } else {
    form.resultado_comision = null;
    form.total_a_enviar = null;
    form.tax_amount = null;
  }
}

function hasSpecialCalculatorValuesToPreserve(): boolean {
  if (!editingId.value || calculatorStore.calculationMode === "special") {
    return false;
  }

  const res = calculatorStore.result;
  if (!res || form.resultado_comision == null || form.total_a_enviar == null) {
    return false;
  }

  const normalCommission = roundMoneyAmount(res.commission);
  const normalTotal = roundMoneyAmount(res.amountSend - res.commission);
  const savedCommission = roundMoneyAmount(form.resultado_comision);
  const savedTotal = roundMoneyAmount(form.total_a_enviar);

  return savedCommission !== normalCommission || savedTotal !== normalTotal;
}

function syncFromCalculatorIfSafe() {
  if (hasSpecialCalculatorValuesToPreserve()) return;
  syncFromCalculator();
}

function buildCreateQuoteSnapshot(): CreateQuoteSnapshot | null {
  const res = calculatorStore.result;
  if (!res) return null;
  const isSpecial =
    calculatorStore.calculationMode === "special" ||
    res.calculationMode === "special" ||
    res.specialDiscountAmount > 0.005;
  return {
    calculationMode: isSpecial ? "special" : "normal",
    origin_amount: roundMoneyAmount(
      isSpecial ? res.amountSend : form.origin_amount,
    ),
    destination_amount: roundMoneyAmount(
      isSpecial ? res.amountReceive : form.destination_amount,
    ),
    resultado_comision: roundMoneyAmount(
      isSpecial
        ? res.finalCommission
        : (form.resultado_comision ?? res.commission),
    ),
    total_a_enviar: roundMoneyAmount(
      isSpecial ? res.totalToSend : (form.total_a_enviar ?? res.totalToSend),
    ),
    tax_amount: res.rate,
    tax_rate_id: form.tax_rate_id,
    commission_id: form.commission_id,
    ...(isSpecial
      ? {
          specialDiscountAmount: roundMoneyAmount(res.specialDiscountAmount),
          specialDiscountPercentage: res.specialDiscountPercentage,
          specialBaseReceive: roundMoneyAmount(res.specialBaseReceive),
        }
      : {}),
  };
}

function applyCreateQuoteSnapshot(snapshot: CreateQuoteSnapshot) {
  form.origin_amount = snapshot.origin_amount;
  form.destination_amount = snapshot.destination_amount;
  form.resultado_comision = snapshot.resultado_comision;
  form.total_a_enviar = snapshot.total_a_enviar;
  form.tax_amount = snapshot.tax_amount;
  form.tax_rate_id = snapshot.tax_rate_id;
  form.commission_id = snapshot.commission_id;
}

function getSpecialDiscountCatalogLookup() {
  return {
    commissions: comisionesStore.commissions,
    taxRates: tasasStore.taxRates,
  };
}

function getTransactionSpecialDiscount(
  t: Transaction,
): TransactionSpecialDiscountInfo | null {
  const meta = getTransactionSpecialDiscountMeta(t.id);
  if (meta) {
    return {
      code: SPECIAL_CALCULATOR_DISCOUNT_CODE,
      discountCommission: meta.discountCommission,
      discountPercentage: meta.discountPercentage,
      baseReceive: meta.baseReceive ?? meta.finalReceive,
      finalReceive: meta.finalReceive,
      improvementReceive: meta.improvementReceive,
      baseCommission: roundMoneyAmount(
        meta.discountCommission + Number(meta.finalCommission ?? 0),
      ),
      finalCommission: roundMoneyAmount(Number(meta.finalCommission ?? 0)),
      totalToSend: meta.totalToSend,
      persisted: true,
    };
  }
  return getTransactionSpecialDiscountForDisplay(
    t,
    getSpecialDiscountCatalogLookup(),
  );
}

function openCreateModal() {
  if (!canCreateTransactions.value) return;
  transactionsStore.error = null;
  resetForm();
  applyDefaultAgentForCurrentUser(true);
  createStepIndex.value = 0;
  showCreateModal.value = true;
  loadFormOptions();
  void loadEditableUsers();
  calculatorStore.setCalculationMode("normal");
  void calculatorStore.loadData({
    background: transactionCatalogReadyForCurrentMode(),
  });
}

async function loadFormOptions() {
  await Promise.all([
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadClientUsers(),
    cuentasStore.loadTransactionFormUsers(),
    cuentasStore.loadBanks(),
    tasasStore.loadTaxRates(),
    comisionesStore.loadCommissions(),
  ]);
}

async function loadEditableUsers() {
  if (editableUsersLoaded.value) return;
  const byId = new Map<
    string,
    { id: string; name: string; email: string; role?: string }
  >();

  await Promise.all(
    EDITABLE_USER_ROLES.map(async (role) => {
      try {
        const users = await fetchUsers({ role });
        for (const user of users) {
          if (!byId.has(user.id)) {
            byId.set(user.id, user);
          }
        }
      } catch {
        /* si un alias no existe en backend, seguimos con los demás */
      }
    }),
  );

  editableUsers.value = Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
  ensureCurrentSalesAdvisorOption();
  if (!isEditingMode.value) {
    applyDefaultAgentForCurrentUser();
  }
  editableUsersLoaded.value = true;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function hydrateEditForm(row: Transaction) {
  const resolvedUserId = normalizeSelectId(row.user_id);
  const resolvedAgentId = normalizeSelectId(row.agent_id);
  if (resolvedUserId) {
    void cuentasStore.ensureTransactionFormUser(resolvedUserId);
  }
  if (resolvedAgentId && resolvedAgentId !== resolvedUserId) {
    void cuentasStore.ensureTransactionFormUser(resolvedAgentId);
  }
  isHydratingTransactionForm.value = true;
  try {
    form.user_id = resolvedUserId;
    if (resolvedUserId) {
      await cuentasStore.loadBankAccountsForTransactionUser(resolvedUserId);
    }
    form.agent_id = resolvedAgentId;
    form.bank_account_origin_id = normalizeSelectId(
      row.bank_account_origin_id ??
        (row as Record<string, unknown>).bank_account_origin,
    );
    form.bank_account_destination_id =
      normalizeSelectId(
        row.bank_account_destination_id ??
          (row as Record<string, unknown>).bank_account_destination,
      ) || normalizeSelectId(row.bank_account_id);
    const storedDestinations = Array.isArray(row.destinations)
      ? row.destinations
          .map((destination) => ({
            bank_account_id: normalizeSelectId(destination.bank_account_id),
            amount: roundMoneyAmount(Number(destination.amount) || 0),
          }))
          .filter((destination) => destination.bank_account_id)
      : [];
    form.destinations = storedDestinations.length > 0
      ? storedDestinations
      : [{
          bank_account_id: form.bank_account_destination_id,
          amount: roundMoneyAmount(Number(row.destination_amount) || 0),
        }];
    form.bank_account_destination_id = form.destinations[0]?.bank_account_id ?? "";
    form.tax_rate_id = row.tax_rate_id ?? "";
    form.commission_id = row.commission_id ?? "";
    form.status = (row.status ?? "verification").toLowerCase();
    form.checked =
      row.checked === true || (row.status ?? "").toLowerCase() === "checked";
    form.tag_ids = [...(row.tag_ids ?? [])];
    form.origin_amount = roundMoneyAmount(Number(row.origin_amount) || 0);
    form.destination_amount = roundMoneyAmount(
      Number(row.destination_amount) || 0,
    );
    {
      const rec = row as Record<string, unknown>;
      const rc = rec.resultado_comision ?? rec.commission_result;
      const ts = rec.total_a_enviar ?? rec.total_to_send;
      const ta = rec.tax_amount ?? rec.tipo_cambio ?? rec.rate;
      form.resultado_comision =
        rc != null && rc !== "" ? Number(rc) || null : null;
      form.total_a_enviar = ts != null && ts !== "" ? Number(ts) || null : null;
      form.tax_amount = ta != null && ta !== "" ? Number(ta) || null : null;
    }
    form.code = row.code ?? "";
    form.operation_number = row.operation_number ?? "";
    form.coupon_id = "";
    form.send_date = apiDateTimeToFormValue(row.send_date);
    form.payment_date = apiDateTimeToFormValue(row.payment_date);
    form.send_voucher = [];
    form.payment_voucher = [];
    form.checked_image = [];
    editSourceTransaction.value = row;
    if (!socialReasonSelectionTouched.value) {
      // `row.bank_id` es el banco de la cuenta destino, NO la razón social.
      // El ID exacto tiene prioridad y se conserva aunque el catálogo llegue después.
      // Si el usuario ya eligió otro valor, un GET de detalle tardío no puede pisarlo.
      const storedCompany =
        (row.company_name ?? "").toString().trim() || editStoredCompanyName.value;
      const rowHasSocialReasonBankId = Object.prototype.hasOwnProperty.call(
        row,
        "social_reason_bank_id",
      );
      const hasStoredSocialReasonBankIdField =
        rowHasSocialReasonBankId || editHasStoredSocialReasonBankIdField.value;
      const storedSocialReasonBankId = rowHasSocialReasonBankId
        ? (row.social_reason_bank_id ?? "").toString().trim()
        : editStoredSocialReasonBankId.value;
      editStoredCompanyName.value = storedCompany;
      editStoredSocialReasonBankId.value = storedSocialReasonBankId;
      editHasStoredSocialReasonBankIdField.value =
        hasStoredSocialReasonBankIdField;
      destinationBankFilterId.value = hasStoredSocialReasonBankIdField
        ? storedSocialReasonBankId
        : resolveStoredSocialReasonBankId("", storedCompany);
    }
    await nextTick();
  } finally {
    isHydratingTransactionForm.value = false;
  }
}

async function openEditModal(t: Transaction) {
  if (!canUpdateTransactions.value) return;
  if (!t.id) return;
  const transactionId = t.id;
  transactionsStore.error = null;
  resetForm();
  editingId.value = transactionId;
  createStepIndex.value = 0;
  editQuoteCorrectionMode.value = false;
  showCreateModal.value = true;
  editModalLoading.value = true;
  try {
    await hydrateEditForm(enrichTransactionWithSpecialDiscountMeta(t));
    editModalLoading.value = false;
    const catalogReady = transactionCatalogReadyForCurrentMode();
    await calculatorStore.loadData({ background: catalogReady });
    syncCalculatorFromForm();
    void loadFormOptions();
    void loadEditableUsers();
    void (async () => {
      try {
        const fresh = await withTimeout(
          transactionsStore.getTransactionById(transactionId),
          2500,
          null,
        );
        if (fresh) {
          // El GET por id no viene enriquecido: sin esto, el monto especial (p. ej. 1450)
          // se "degradaría" al valor del catálogo (1449.18) que guarda el backend.
          await hydrateEditForm(
            enrichTransactionWithSpecialDiscountMeta({ ...t, ...fresh }),
          );
          syncCalculatorFromForm();
        }
      } catch {
        /* conservar fallback inicial */
      }
    })();
  } catch {
    transactionsStore.error =
      "No se pudo preparar el formulario de edición. Intenta nuevamente.";
  } finally {
    editModalLoading.value = false;
  }
}

/**
 * PUT: enviar `destinations` solo cuando la distribución realmente cambió
 * (cuentas agregadas/quitadas/cambiadas o montos redistribuidos en multicuenta).
 * Con cuenta única sin cambio de cuenta, el backend sincroniza el monto de la
 * fila desde `destination_amount`; omitir la lista evita reemplazar filas
 * (el reemplazo con la misma cuenta provocaba un 500 por la restricción única).
 */
function destinationsChangedForUpdate(): boolean {
  const source = editSourceTransaction.value;
  const stored = (source?.destinations ?? [])
    .map((destination) => ({
      id: normalizeSelectId(destination.bank_account_id),
      amount: roundMoneyAmount(Number(destination.amount) || 0),
    }))
    .filter((destination) => destination.id);
  const current = form.destinations.map((destination) => ({
    id: destination.bank_account_id.trim(),
    amount: roundMoneyAmount(Number(destination.amount) || 0),
  }));
  if (stored.length <= 1 && current.length === 1) {
    const storedId =
      stored[0]?.id || normalizeSelectId(source?.bank_account_destination_id);
    return current[0]?.id !== storedId;
  }
  if (stored.length !== current.length) return true;
  return stored.some(
    (row, index) =>
      row.id !== current[index]?.id || row.amount !== current[index]?.amount,
  );
}

async function submitForm() {
  // B4 — el submit sirve para crear y editar; exige el permiso según el modo.
  if (editingId.value ? !canUpdateTransactions.value : !canCreateTransactions.value) return;
  if (!editingId.value && createQuoteSnapshot.value) {
    applyCreateQuoteSnapshot(createQuoteSnapshot.value);
  } else {
    syncFromCalculatorIfSafe();
  }
  syncStatusFromVoucherFiles();
  const calculatorError = getCalculatorBlockingError();
  if (calculatorError) {
    transactionsStore.error = calculatorError;
    return;
  }
  if (!form.bank_account_destination_id || !form.user_id) {
    transactionsStore.error =
      "Cuenta destino y cliente son obligatorios";
    return;
  }
  if (destinationDistributionValidation.value.error) {
    transactionsStore.error = destinationDistributionValidation.value.error;
    return;
  }
  if (!form.tax_rate_id || !form.commission_id) {
    transactionsStore.error =
      editingId.value
        ? "La transacción debe conservar tasa y comisión válidas para guardar"
        : "Tasa y comisión son obligatorios (usa la calculadora primero)";
    return;
  }
  if (!editingId.value && !form.operation_number.trim()) {
    transactionsStore.error =
      "Indica el número de operación antes de guardar.";
    return;
  }
  const bankMeta = resolveTransactionBankMeta();
  if (!bankMeta) {
    transactionsStore.error =
      "Indica cuenta destino con banco válido en el catálogo (y razón social si aplica).";
    return;
  }
  try {
    /**
     * Edición: el backend agrega los archivos nuevos sin tocar los existentes.
     * Si el usuario quitó comprobantes ya subidos, `<campo>s_keep` lleva la
     * lista de los que se conservan; un campo intacto se omite por completo.
     */
    const voucherAttachmentPayload = (field: VoucherField) => {
      const values = formVoucherValues(field);
      if (!editingId.value) return values;
      return values.length > 0 ? values : undefined;
    };
    const sendVoucher = voucherAttachmentPayload("send_voucher");
    const paymentVoucher = voucherAttachmentPayload("payment_voucher");
    const checkedImage = voucherAttachmentPayload("checked_image");
    const voucherKeepPayload = editingId.value
      ? {
          ...(hasRemovedPersistedVouchers("send_voucher")
            ? { send_vouchers_keep: persistedVoucherStrings("send_voucher") }
            : {}),
          ...(hasRemovedPersistedVouchers("payment_voucher")
            ? { payment_vouchers_keep: persistedVoucherStrings("payment_voucher") }
            : {}),
          ...(hasRemovedPersistedVouchers("checked_image")
            ? { checked_images_keep: persistedVoucherStrings("checked_image") }
            : {}),
        }
      : {};

    const code =
      form.code?.trim() ||
      `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const operationNumber = form.operation_number.trim();
    const specialCreateSnapshot =
      !editingId.value &&
      createQuoteSnapshot.value &&
      (createQuoteSnapshot.value.calculationMode === "special" ||
        (createQuoteSnapshot.value.specialDiscountAmount ?? 0) > 0.005)
        ? createQuoteSnapshot.value
        : null;
    const commonAmounts = {
      ...(form.bank_account_origin_id?.trim()
        ? { bank_account_origin: form.bank_account_origin_id.trim() }
        : {}),
      bank_account_destination: form.bank_account_destination_id,
      destinations: form.destinations.map((destination) => ({
        bank_account_id: destination.bank_account_id.trim(),
        amount: roundMoneyAmount(Number(destination.amount) || 0),
      })),
      user_id: form.user_id,
      agent_id:
        form.agent_id?.trim() &&
        form.agent_id.trim() !== form.user_id?.trim()
          ? form.agent_id.trim()
          : undefined,
      tax_rate_id: specialCreateSnapshot?.tax_rate_id ?? form.tax_rate_id,
      commission_id: specialCreateSnapshot?.commission_id ?? form.commission_id,
      origin_amount: roundMoneyAmount(
        specialCreateSnapshot?.origin_amount ?? form.origin_amount,
      ),
      destination_amount: roundMoneyAmount(
        specialCreateSnapshot?.destination_amount ?? form.destination_amount,
      ),
      resultado_comision:
        (specialCreateSnapshot?.resultado_comision ?? form.resultado_comision) !=
        null
          ? roundMoneyAmount(
              specialCreateSnapshot?.resultado_comision ??
                form.resultado_comision!,
            )
          : undefined,
      total_a_enviar:
        (specialCreateSnapshot?.total_a_enviar ?? form.total_a_enviar) != null
          ? roundMoneyAmount(
              specialCreateSnapshot?.total_a_enviar ?? form.total_a_enviar!,
            )
          : undefined,
      tax_amount:
        (specialCreateSnapshot?.tax_amount ?? form.tax_amount) != null &&
        Number.isFinite(specialCreateSnapshot?.tax_amount ?? form.tax_amount)
          ? Number(specialCreateSnapshot?.tax_amount ?? form.tax_amount)
          : undefined,
      code,
      operation_number: operationNumber || undefined,
      coupon_id: undefined,
      coupon_discount_code: specialCreateSnapshot
        ? SPECIAL_CALCULATOR_DISCOUNT_CODE
        : undefined,
      coupon_origin_amount: specialCreateSnapshot
        ? specialCreateSnapshot.origin_amount
        : undefined,
      coupon_destination_amount: specialCreateSnapshot
        ? specialCreateSnapshot.destination_amount
        : undefined,
      coupon_discount_percentage: specialCreateSnapshot
        ? specialCreateSnapshot.specialDiscountPercentage
        : undefined,
      coupon_discount_commission: specialCreateSnapshot
        ? specialCreateSnapshot.specialDiscountAmount
        : undefined,
      coupon_discount_total_to_send: specialCreateSnapshot
        ? specialCreateSnapshot.total_a_enviar ?? undefined
        : undefined,
      status: form.status,
      send_voucher: sendVoucher,
      payment_voucher: paymentVoucher,
      checked_image: checkedImage,
      checked: form.checked,
      // Lista autoritativa: se envía siempre, también vacía (quita las etiquetas).
      tag_ids: [...form.tag_ids],
      ...bankMeta,
    };
    if (editingId.value) {
      /** PUT: el backend recalcula `status` y asigna `payment_date` al pasar a finalizada. */
      const updated = await transactionsStore.updateTransaction(editingId.value, {
        ...commonAmounts,
        ...voucherKeepPayload,
        destinations: destinationsChangedForUpdate()
          ? commonAmounts.destinations
          : undefined,
        operation_number: operationNumber || null,
        send_date: formDateTimeToApi(form.send_date),
        payment_date: formDateTimeToApi(form.payment_date),
      });
      const calculatorResult = calculatorStore.result;
      const isSpecialEdit =
        isEditingSpecialTransaction() ||
        calculatorStore.calculationMode === "special" ||
        calculatorResult?.calculationMode === "special" ||
        (calculatorResult?.specialDiscountAmount ?? 0) > 0.005;
      syncSpecialDiscountMetaAfterSave(updated, {
        origin_amount: commonAmounts.origin_amount,
        destination_amount: commonAmounts.destination_amount,
        resultado_comision: commonAmounts.resultado_comision ?? null,
        total_a_enviar: commonAmounts.total_a_enviar ?? null,
        ...(isSpecialEdit && calculatorResult
          ? {
              specialDiscountAmount: calculatorResult.specialDiscountAmount,
              specialDiscountPercentage: calculatorResult.specialDiscountPercentage,
              specialBaseReceive: calculatorResult.specialBaseReceive,
            }
          : {
              specialDiscountAmount:
                editSourceTransaction.value?.coupon_discount_commission ?? null,
              specialDiscountPercentage:
                editSourceTransaction.value?.coupon_discount_percentage ?? null,
            }),
      });
      const idx = transactionsStore.transactions.findIndex(
        (row) => row.id === updated.id,
      );
      if (idx >= 0) {
        transactionsStore.transactions[idx] =
          enrichTransactionWithSpecialDiscountMeta(updated);
      }
    } else {
      /** POST: servidor fuerza `verification`, `checked: false` y `send_date` en el alta. */
      const created = await transactionsStore.createTransaction({
        ...commonAmounts,
      });
      if (specialCreateSnapshot && created.id) {
        const meta = buildSpecialDiscountMetaFromSnapshot(specialCreateSnapshot);
        if (meta) {
          saveTransactionSpecialDiscountMeta(created.id, meta);
          const idx = transactionsStore.transactions.findIndex(
            (row) => row.id === created.id,
          );
          if (idx >= 0) {
            const createdTransaction = transactionsStore.transactions[idx];
            if (createdTransaction) {
              transactionsStore.transactions[idx] =
                enrichTransactionWithSpecialDiscountMeta(createdTransaction);
            }
          }
        }
      }
    }
    showCreateModal.value = false;
    resetForm();
  } catch {
    // Error en store
  }
}

const pendingDeleteTransaction = ref<Transaction | null>(null);
const showDeleteTransactionConfirm = ref(false);
const deleteTransactionMessage = computed(() =>
  pendingDeleteTransaction.value
    ? `¿Eliminar transacción ${pendingDeleteTransaction.value.code ?? pendingDeleteTransaction.value.id}?`
    : "",
);

function handleDelete(t: Transaction) {
  if (!canDeleteTransactions.value) return;
  if (!t.id) return;
  pendingDeleteTransaction.value = t;
  showDeleteTransactionConfirm.value = true;
}

async function confirmDeleteTransaction() {
  const t = pendingDeleteTransaction.value;
  showDeleteTransactionConfirm.value = false;
  pendingDeleteTransaction.value = null;
  if (!t?.id || !canDeleteTransactions.value) return;
  openMenuId.value = null;
  deletingId.value = t.id;
  transactionsStore.error = null;
  try {
    await transactionsStore.deleteTransaction(t.id);
    syncCurrentPageToTotal();
  } catch {
    // Error en store
  } finally {
    deletingId.value = null;
  }
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
  const menuWidth = 168;
  const menuHeight = 96;
  const padding = 8;

  // Clic derecho: el menú se ancla al cursor, no a la celda.
  const point = menuAnchorPoint.value;
  if (point) {
    let px = point.x;
    let py = point.y;
    if (px + menuWidth > window.innerWidth - padding)
      px = window.innerWidth - menuWidth - padding;
    if (py + menuHeight > window.innerHeight - padding)
      py = py - menuHeight;
    menuPosition.top = Math.max(padding, py);
    menuPosition.left = Math.max(padding, px);
    return;
  }

  if (!menuTriggerEl.value) return;
  const rect = menuTriggerEl.value.getBoundingClientRect();
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

/** Cuentas destino estructuradas para el preview (multicuentas con titular visible). */
const previewDestinations = computed(() => {
  const t = previewTransaction.value;
  if (!t) return { rows: [], totalLabel: "—" };
  return buildPreviewDestinations(t);
});

const copiedPreviewAccountIdentifier = ref("");

async function copyPreviewAccountIdentifier(value: string) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  copiedPreviewAccountIdentifier.value = value;
  window.setTimeout(() => {
    if (copiedPreviewAccountIdentifier.value === value) {
      copiedPreviewAccountIdentifier.value = "";
    }
  }, 1500);
}

const previewSectionGroups = computed(() => {
  const s = previewSections.value;
  return {
    resumen: s.find((sec) => sec.id === "resumen") ?? null,
    left: s.filter((sec) => ["participantes", "condiciones"].includes(sec.id)),
    right: s.filter((sec) => ["importes", "fechas"].includes(sec.id)),
    bottom: s.filter((sec) => ["registro", "extra"].includes(sec.id)),
  };
});

type PreviewVoucherEntry = {
  href: string;
  label: string;
  isImage: boolean;
};

type PreviewVoucherGroup = {
  key: VoucherField;
  title: string;
  entries: PreviewVoucherEntry[];
};

/** Comprobantes del preview: TODAS las imágenes de cada grupo (no solo la primera). */
const previewVoucherGroups = computed<PreviewVoucherGroup[]>(() => {
  const t = previewTransaction.value;
  if (!t) return [];
  const groups: Array<{ key: VoucherField; title: string }> = [
    { key: "send_voucher", title: "Voucher envío" },
    { key: "payment_voucher", title: "Voucher pago" },
    { key: "checked_image", title: "Checklist verificación" },
  ];
  return groups
    .map(({ key, title }) => ({
      key,
      title,
      entries: transactionVoucherValues(t, key)
        .filter((value): value is string => typeof value === "string")
        .map((value) => ({
          href: voucherMediaHref(value),
          label: getVoucherLabel(value),
          isImage: isImagePath(value),
        })),
    }))
    .filter((group) => group.entries.length > 0);
});

const previewVoucherTotal = computed(() =>
  previewVoucherGroups.value.reduce(
    (sum, group) => sum + group.entries.length,
    0,
  ),
);

const editPreviewTransaction = computed<Transaction | null>(() => {
  if (!isEditingMode.value) return null;
  const base = (editSourceTransaction.value ?? {}) as Transaction;
  return {
    ...base,
    user_id: form.user_id || base.user_id,
    agent_id: form.agent_id || base.agent_id || base.user_id,
    bank_account_origin_id:
      form.bank_account_origin_id || base.bank_account_origin_id,
    bank_account_destination_id:
      form.bank_account_destination_id || base.bank_account_destination_id,
    destinations: form.destinations.map((destination, position) => ({
      bank_account_id: destination.bank_account_id,
      amount: Number(destination.amount) || 0,
      position,
    })),
    tax_rate_id: form.tax_rate_id || base.tax_rate_id,
    commission_id: form.commission_id || base.commission_id,
    status: form.status || base.status,
    checked: form.checked,
    origin_amount: Number(form.origin_amount) || 0,
    destination_amount: Number(form.destination_amount) || 0,
    resultado_comision: form.resultado_comision ?? undefined,
    total_a_enviar: form.total_a_enviar ?? undefined,
    tax_amount: form.tax_amount ?? undefined,
    code: form.code || base.code,
    operation_number: form.operation_number || base.operation_number,
    send_date: form.send_date
      ? (formDateTimeToApi(form.send_date) ?? form.send_date)
      : base.send_date,
    payment_date: form.payment_date
      ? (formDateTimeToApi(form.payment_date) ?? form.payment_date)
      : base.payment_date,
  };
});

const editModalSummary = computed(() => {
  const t = editPreviewTransaction.value;
  if (!t) return null;
  return {
    code: formatTransactionCodeForDisplay(t.code),
    status: getStatusLabel(
      resolveTransactionStatusForDisplay(t) ?? t.status,
    ),
    checked: isTransactionChecked(t) ? "Sí" : "No",
    agent: getSalesAdvisorLabel(t.agent_id),
  };
});

function getTaxRatePreviewLabel(id: string | undefined): string {
  if (!id?.trim()) return "—";
  const rate = tasasStore.taxRates.find((item) => item.id === id);
  return rate ? `${rate.coin_a}-${rate.coin_b} (${rate.tax})` : id;
}

function getCommissionPreviewLabel(id: string | undefined): string {
  if (!id?.trim()) return "—";
  const commission = comisionesStore.commissions.find((item) => item.id === id);
  return commission
    ? `${commission.coin_a}-${commission.coin_b} (${commission.percentage}%)`
    : id;
}

function getCouponPreviewLabel(t: Transaction): string {
  const code = t.coupon_discount_code;
  const percentage = t.coupon_discount_percentage;
  if (!code?.trim()) return "—";
  return percentage != null ? `${code} (${formatValue(percentage)}%)` : code;
}

const editHeroParticipants = computed(() => {
  const t = editPreviewTransaction.value;
  if (!t) return [];
  return [
    { label: "Cliente", value: getClientLabel(t.user_id) },
    {
      label: "Cuenta origen",
      value: getBankCurrencyTableLabel(t.bank_account_origin_id),
    },
    {
      label: "Cuentas destino",
      value: getTransactionDestinationAccountsLabel(t),
    },
  ];
});

const editHeroConditions = computed(() => {
  const t = editPreviewTransaction.value;
  if (!t) return [];
  const items = [
    {
      label: "Tasa",
      value: getTaxRatePreviewLabel(t.tax_rate_id),
    },
    {
      label: "Comisión",
      value: getCommissionPreviewLabel(t.commission_id),
    },
  ];
  const specialDiscount = getTransactionSpecialDiscount(t);
  if (specialDiscount) {
    items.push({
      label: "Calculadora especial",
      value:
        specialDiscount.discountPercentage != null
          ? `${SPECIAL_CALCULATOR_DISCOUNT_CODE} (${formatValue(specialDiscount.discountPercentage)}%)`
          : SPECIAL_CALCULATOR_DISCOUNT_CODE,
    });
  } else if (t.coupon_discount_code || t.coupon_id) {
    items.push({
      label: "Cupón aplicado",
      value: getCouponPreviewLabel(t),
    });
  }
  return items;
});

const editHeroAmounts = computed(() => {
  const t = editPreviewTransaction.value;
  if (!t) return [];
  const currencies = getTransactionCurrencies(t, true);
  const specialDiscount = getTransactionSpecialDiscount(t);
  const hasCoupon = Boolean(
    !specialDiscount &&
      (t.coupon_id || (t.coupon_discount_code && t.coupon_discount_code.trim())),
  );
  const items = [
    {
      label: hasCoupon ? "Monto origen (Base)" : "Monto origen",
      value: formatValueWithCurrency(t.origin_amount, currencies.origin),
    },
    {
      label: specialDiscount
        ? "Monto destino (Especial)"
        : hasCoupon
          ? "Monto destino (Base)"
          : "Monto destino",
      value: formatValueWithCurrency(
        t.destination_amount,
        currencies.destination,
      ),
    },
    {
      label: specialDiscount
        ? "Comisión (Especial)"
        : hasCoupon
          ? "Comisión (Base)"
          : "Resultado comisión",
      value: formatValueWithCurrency(
        t.resultado_comision ?? t.commission_result,
        currencies.origin,
      ),
    },
  ];

  // En edición mostramos SOLO los tres importes guardados (origen, destino, comisión).
  // El desglose especial/cupón (recibe base, mejora, descuento, total) confundía porque
  // parecía un recálculo en vivo al abrir el modal.
  return items;
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
  menuAnchorPoint.value = null;
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

/** Posiciona el menú ya abierto y engancha los listeners que lo cierran. */
function bindRowActionMenuDismissal(scrollAnchor: HTMLElement | null) {
  nextTick(() => {
    updateMenuPosition();
    const scrollParent = scrollAnchor?.closest(".overflow-x-auto");
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

function toggleMenu(id: string, event?: Event) {
  if (openMenuId.value === id) {
    closeRowActionMenu();
    return;
  }
  menuAnchorPoint.value = null;
  menuTriggerEl.value =
    (event?.target as HTMLElement)?.closest("td") ??
    (event?.target as HTMLElement) ??
    null;
  openMenuId.value = id;
  bindRowActionMenuDismissal(menuTriggerEl.value);
}

/**
 * Clic derecho sobre la fila: mismo menú que los tres puntitos
 * (Previsualizar / Editar / Eliminar), pero anclado al cursor.
 */
function onRowContextMenu(t: Transaction, event: MouseEvent) {
  const id = t.id ?? "";
  if (!id) return;
  menuTriggerEl.value = event.target as HTMLElement | null;
  menuAnchorPoint.value = { x: event.clientX, y: event.clientY };
  openMenuId.value = id;
  bindRowActionMenuDismissal(menuTriggerEl.value);
}

/** Pista de los atajos de fila, mostrada como tooltip en cada `<tr>`. */
const rowShortcutHint = computed(() =>
  canUpdateTransactions.value
    ? "Doble clic para editar · clic derecho para más acciones"
    : "Doble clic para previsualizar · clic derecho para más acciones",
);

/**
 * Doble clic sobre la fila: abre la edición, o la vista previa si no hay permiso
 * para editar. Se ignora si el doble clic cayó sobre un control de la fila.
 */
function onRowDoubleClick(t: Transaction, event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest("a, button, input, select, textarea, label")) return;
  // Un doble clic deja texto seleccionado; molesta al abrir el modal encima.
  window.getSelection()?.removeAllRanges();
  closeRowActionMenu();
  if (canUpdateTransactions.value) openEditModal(t);
  else void openPreviewModal(t);
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

function formatValueWithCurrency(value: unknown, currency: string): string {
  const amount = formatValue(value);
  const code = currency.trim().toUpperCase();
  return code && amount !== "-" ? `${amount} ${code}` : amount;
}

/** Fecha/hora para tabla (ISO del API → hora local legible). */
function formatDateTime(value: string | undefined): string {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("es-PE", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return value;
  }
}

/** ISO o solo fecha `YYYY-MM-DD` → valor `datetime-local` (hora local del navegador). */
function apiDateTimeToFormValue(raw: string | undefined | null): string {
  if (!raw?.trim()) return "";
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T00:00`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` → ISO UTC para PUT/POST. */
function formDateTimeToApi(local: string): string | undefined {
  if (!local?.trim()) return undefined;
  const d = new Date(local.trim());
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** URL absoluta para comprobantes en tabla (path API o URL completa). */
function voucherMediaHref(path: unknown): string {
  if (Array.isArray(path)) {
    const first = voucherValues(path).find((value): value is string => typeof value === "string");
    return first ? voucherMediaHref(first) : "";
  }
  if (path == null || typeof path !== "string") return "";
  const s = path.trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return Domain.ensureHttpsUrl(s);
  if (s.startsWith("/") || s.startsWith("media/") || s.includes("/")) {
    return Domain.mediaUrl(s);
  }
  // Los vouchers pueden venir solo con nombre de archivo; no deben caer en
  // `profile_images`, sino resolverse directamente bajo `/media/`.
  return Domain.mediaUrl(`media/${s}`);
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

function getTransactionDestinationAccountsLabel(t: Transaction): string {
  const ids = (t.destinations ?? [])
    .map((destination) => destination.bank_account_id?.trim())
    .filter(Boolean);
  const effectiveIds = ids.length > 0
    ? ids
    : [t.bank_account_destination_id?.trim()].filter(Boolean) as string[];
  if (effectiveIds.length === 0) return "-";
  const first = getBankCurrencyTableLabel(effectiveIds[0]);
  const additional = effectiveIds.length - 1;
  return additional > 0
    ? `${first} +${additional} ${additional === 1 ? "cuenta" : "cuentas"}`
    : first;
}

function getTransactionDestinationAccountsTitle(t: Transaction): string {
  const destinations = t.destinations ?? [];
  if (destinations.length === 0) {
    return getBankCurrencyTableLabel(t.bank_account_destination_id);
  }
  const currency = getTransactionCurrencies(t).destination;
  return destinations
    .map((destination) =>
      `${getBankCurrencyTableLabel(destination.bank_account_id)}: ${formatValueWithCurrency(destination.amount, currency)}`,
    )
    .join(" · ");
}

/** Tabla: razón social de la empresa (`company_name` en API). */
function transactionCompanyNameTable(t: Transaction): string {
  const s = t.company_name != null ? String(t.company_name).trim() : "";
  return s || "—";
}

/**
 * Nombre del cliente. Si todavía no está en el catálogo se muestra un guion, no
 * el UUID: un identificador crudo en la columna «Cliente» no le dice nada a
 * ventas y parece un dato corrupto. El nombre llega en cuanto lo resuelve
 * `resolveMissingClientNames`.
 */
function getClientLabel(id: string | undefined): string {
  if (!id) return "-";
  const u =
    cuentasStore.transactionFormUsers.find((u) => u.id === id) ??
    cuentasStore.clientUsers.find((u) => u.id === id);
  return u?.name ?? "—";
}

/** Ids que ya se intentaron resolver, para no repetir la petición en cada render. */
const attemptedClientLookups = new Set<string>();

/**
 * Rellena los clientes de la página que no estén en el catálogo.
 *
 * El listado de nombres se pide una vez al entrar; cualquier cliente que no
 * venga en él (por rol, por filtros del endpoint o por ser muy nuevo) dejaría la
 * celda sin nombre. Se resuelven de a uno y solo una vez por id.
 */
async function resolveMissingClientNames(rows: Transaction[]) {
  const pending = new Set<string>();
  for (const t of rows) {
    const id = t.user_id?.trim();
    if (!id || attemptedClientLookups.has(id)) continue;
    const known =
      cuentasStore.transactionFormUsers.some((u) => u.id === id) ||
      cuentasStore.clientUsers.some((u) => u.id === id);
    if (!known) pending.add(id);
  }
  if (!pending.size) return;
  for (const id of pending) attemptedClientLookups.add(id);
  await Promise.all(
    Array.from(pending).map((id) => cuentasStore.ensureTransactionFormUser(id)),
  );
}

/**
 * Cliente dado de alta a la rápida (solo nombre). Se marca en la fila para que
 * alguien complete el perfil después, sin frenar la operación del día.
 */
function isClientIncomplete(id: string | undefined): boolean {
  if (!id) return false;
  const u =
    cuentasStore.transactionFormUsers.find((u) => u.id === id) ??
    cuentasStore.clientUsers.find((u) => u.id === id);
  return u ? isClientProfileIncomplete(u) : false;
}

function getSalesAdvisorLabel(id: string | undefined): string {
  if (!id?.trim()) return "—";
  const u =
    editableUsers.value.find((u) => u.id === id) ??
    cuentasStore.transactionFormUsers.find((u) => u.id === id);
  return u?.name ?? "—";
}

function getVoucherLabel(v: unknown): string {
  const values = voucherValues(v);
  if (values.length > 1) return `${values.length} archivos`;
  if (values.length === 1 && values[0] !== v) return getVoucherLabel(values[0]);
  if (isFileValue(v)) {
    return v.name;
  }
  if (typeof v === "string" && v.trim()) {
    const clean = v.trim().split("?")[0]?.split("#")[0] ?? "";
    return clean.split("/").filter(Boolean).pop() ?? "Imagen actual";
  }
  return "Archivo seleccionado";
}

function voucherValues(value: unknown): VoucherFormValue[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap((item) => voucherValues(item));
  if (isFileValue(value)) return [value];
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function transactionVoucherValues(
  transaction: Transaction | null | undefined,
  field: VoucherField,
): VoucherFormValue[] {
  if (!transaction) return [];
  const rec = transaction as Record<string, unknown>;
  // El parser ya fusiona singular+plural en `field`; el API además conserva
  // `${field}s` crudo. Sin dedupe cada archivo aparecería dos veces.
  const seen = new Set<string>();
  return voucherValues([
    rec[field],
    rec[`${field}s`],
    rec[`${field}_files`],
  ]).filter((value) => {
    if (typeof value !== "string") return true;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function formVoucherValues(field: VoucherField): VoucherFormValue[] {
  return voucherValues(form[field]);
}

function persistedVoucherValues(field: VoucherField): VoucherFormValue[] {
  const removed = removedPersistedVouchers[field];
  return transactionVoucherValues(editSourceTransaction.value, field).filter(
    (value) => typeof value !== "string" || !removed.includes(value),
  );
}

/** Comprobantes persistidos que se conservan (para `<campo>s_keep` del PUT). */
function persistedVoucherStrings(field: VoucherField): string[] {
  return persistedVoucherValues(field).filter(
    (value): value is string => typeof value === "string",
  );
}

function hasRemovedPersistedVouchers(field: VoucherField): boolean {
  return removedPersistedVouchers[field].length > 0;
}

function displayedVoucherValues(field: VoucherField): VoucherFormValue[] {
  return [...persistedVoucherValues(field), ...formVoucherValues(field)];
}

/**
 * Quita un comprobante de la lista visible: los persistidos se marcan para
 * borrarse al guardar; los recién agregados salen del formulario directamente.
 */
function removeDisplayedVoucher(field: VoucherField, index: number) {
  const persistedCount = persistedVoucherValues(field).length;
  if (index < persistedCount) {
    const value = persistedVoucherValues(field)[index];
    if (typeof value === "string") {
      removedPersistedVouchers[field] = [
        ...removedPersistedVouchers[field],
        value,
      ];
      syncStatusFromVoucherFiles();
    }
    return;
  }
  removeVoucherAt(field, index - persistedCount);
}

function isFileValue(v: unknown): v is File {
  return (
    typeof File !== "undefined" &&
    v instanceof File &&
    typeof v.name === "string"
  );
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function isImagePath(path: string): boolean {
  const clean = path.trim().split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"].some((ext) =>
    clean.endsWith(ext),
  );
}

/** ObjectURLs de miniaturas de archivos recién elegidos; se revocan al resetear o desmontar. */
const voucherFileObjectUrls = new Map<File, string>();

function voucherFileThumbSrc(file: File): string {
  if (!isImageFile(file)) return "";
  let url = voucherFileObjectUrls.get(file);
  if (!url) {
    url = URL.createObjectURL(file);
    voucherFileObjectUrls.set(file, url);
  }
  return url;
}

function revokeVoucherFileObjectUrls() {
  voucherFileObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  voucherFileObjectUrls.clear();
}

type VoucherDisplayEntry = {
  id: string;
  label: string;
  href: string;
  thumbSrc: string;
  persisted: boolean;
};

/** Lista visible de comprobantes de un grupo: persistidos (menos quitados) + nuevos. */
function voucherDisplayEntries(field: VoucherField): VoucherDisplayEntry[] {
  const persistedCount = persistedVoucherValues(field).length;
  return displayedVoucherValues(field).map((value, index) => {
    if (typeof value === "string") {
      const href = voucherMediaHref(value);
      return {
        id: `${field}-stored-${value}`,
        label: getVoucherLabel(value),
        href,
        thumbSrc: isImagePath(value) ? href : "",
        persisted: index < persistedCount,
      };
    }
    return {
      id: `${field}-file-${index}-${value.name}-${value.size}`,
      label: value.name,
      href: "",
      thumbSrc: voucherFileThumbSrc(value),
      persisted: false,
    };
  });
}

/** Primera imagen disponible del comprobante de envío (panel "Ver imagen de envío"). */
const activeSendVoucherPreviewSrc = computed(() => {
  const entry = voucherDisplayEntries("send_voucher").find(
    (item) => item.thumbSrc,
  );
  return entry?.thumbSrc ?? null;
});

/** Imagen de verificación (checklist) ya elegida o cargada en el formulario */
const isCheckedImageVoucherPresent = computed(() =>
  hasVoucherValue(form.checked_image),
);

function nowLocalDateTimeValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function onVoucherFileSelect(
  field: VoucherField,
  event: Event,
) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (!files.length) {
    input.value = "";
    return;
  }
  appendVoucherFiles(field, files);
  input.value = "";
}

/** Agrega archivos elegidos o imágenes pegadas al grupo de comprobantes. */
function appendVoucherFiles(field: VoucherField, files: File[]) {
  form[field] = [...formVoucherValues(field), ...files];
  if (field === "payment_voucher") {
    if (!form.payment_date?.trim()) {
      form.payment_date = nowLocalDateTimeValue();
    }
  }
  syncStatusFromVoucherFiles();
}

/** Recibe imágenes copiadas desde WhatsApp, capturas u otra aplicación. */
function onVoucherImagePaste(field: VoucherField, event: ClipboardEvent) {
  const imageFiles = Array.from(event.clipboardData?.files ?? []).filter(
    isImageFile,
  );
  if (!imageFiles.length) return;
  event.preventDefault();
  appendVoucherFiles(field, imageFiles);
}

function hasVoucherValue(value: unknown): boolean {
  return voucherValues(value).length > 0;
}

function removeVoucherAt(field: VoucherField, index: number) {
  form[field] = formVoucherValues(field).filter((_, i) => i !== index);
  syncStatusFromVoucherFiles();
}

function syncStatusFromVoucherFiles() {
  const currentStatus = (form.status ?? "").toLowerCase();
  if (["failed", "cancelled"].includes(currentStatus)) return;

  const hasSendVoucher = displayedVoucherValues("send_voucher").length > 0;
  const hasCheckedImage = displayedVoucherValues("checked_image").length > 0;
  const hasPaymentVoucher = displayedVoucherValues("payment_voucher").length > 0;

  form.checked = hasCheckedImage;
  if (hasSendVoucher && hasCheckedImage && hasPaymentVoucher) {
    form.status = "verified";
  } else if (
    hasCheckedImage &&
    (currentStatus === "verification" || currentStatus === "")
  ) {
    form.status = "verified";
  }
}

onBeforeUnmount(() => {
  revokeVoucherFileObjectUrls();
});

async function submitImport() {
  if (!canCreateTransactions.value) return;
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
  if (!canCreateTransactions.value) return;
  if (!importSimpleFile.value) return;
  importingSimple.value = true;
  importSimpleError.value = "";
  transactionsStore.error = null;
  try {
    await Promise.all([
      cuentasStore.loadBankAccounts(),
      cuentasStore.loadBanks(),
    ]);
    const payloads = await parseSimpleImportExcel(importSimpleFile.value);
    if (payloads.length === 0) {
      importSimpleError.value = "No se encontraron filas válidas en el archivo";
      importingSimple.value = false;
      return;
    }
    let created = 0;
    const errors: string[] = [];
    for (const p of payloads) {
      const meta = bankMetaFromDestinationAccount(p.bank_account_destination);
      if (!meta) {
        errors.push(
          `${p.code}: no se resolvió banco para cuenta destino ${p.bank_account_destination}`,
        );
        continue;
      }
      try {
        await transactionsStore.createTransaction({ ...p, ...meta });
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
  void transactionsStore.loadTransactions(apiFilterParams.value, {
    background: false,
  });
}

watch(
  () => form.user_id,
  (userId) => {
    if (isHydratingTransactionForm.value) return;
    form.bank_account_origin_id = "";
    form.bank_account_destination_id = "";
    if (isCurrentUserSalesAdvisor()) {
      applyDefaultAgentForCurrentUser();
    } else {
      form.agent_id = "";
    }
    destinationBankSelectionModel.value = "";
    void cuentasStore.loadBankAccountsForTransactionUser(userId?.trim() || undefined);
  },
);

watch(
  () => selectedAccountCurrencies.value.origin,
  (currency) => {
    if (isHydratingTransactionForm.value) return;
    const selectedId = destinationBankFilterId.value?.trim();
    if (!selectedId || !currency) return;
    if (
      editStoredSocialReasonBankId.value.trim() &&
      selectedId === editStoredSocialReasonBankId.value.trim()
    ) {
      return;
    }
    const bank = cuentasStore.banks.find((b) => String(b.id).trim() === selectedId);
    const bankCurrency = normalizeCurrencyCode(bank?.currency);
    if (bankCurrency && bankCurrency !== currency) {
      destinationBankSelectionModel.value = "";
    }
  },
);

watch(showBancoCrudModal, (open) => {
  if (!open) bancoCrudOpenForCreate.value = false;
});

// Reconstruye la razón social guardada en el dropdown cuando el catálogo de bancos
// llega después de hidratar el formulario de edición.
watch(
  () => [
    cuentasStore.banks
      .map((bank) => `${bank.id}|${bank.company ?? ""}|${bank.currency ?? ""}`)
      .join("\u0001"),
    selectedAccountCurrencies.value.origin,
  ],
  () => {
    if (!editingId.value || isHydratingTransactionForm.value) return;
    const company = editStoredCompanyName.value.trim();
    const persistedBankId = editStoredSocialReasonBankId.value.trim();
    if (
      (!company && !persistedBankId) ||
      editHasStoredSocialReasonBankIdField.value ||
      destinationBankFilterId.value.trim() ||
      socialReasonSelectionTouched.value
    ) {
      return;
    }
    const id = resolveStoredSocialReasonBankId(persistedBankId, company);
    if (id) destinationBankFilterId.value = id;
  },
);

watch(
  [
    () => form.bank_account_origin_id,
    () => form.bank_account_destination_id,
    () => form.user_id,
    () => selectedAccountCurrencies.value.origin,
    () => selectedAccountCurrencies.value.destination,
    () => cuentasStore.transactionFormBankAccounts.length,
    () => cuentasStore.transactionFormBankAccountsUserId,
    () => cuentasStore.transactionFormBankAccountsLoading,
    () => cuentasStore.bankAccounts.length,
    () => cuentasStore.banks.length,
  ],
  () => {
    if (isHydratingTransactionForm.value) return;
    if (cuentasStore.transactionFormBankAccountsLoading) return;
    if (cuentasStore.banks.length === 0) return;

    if (
      form.bank_account_origin_id &&
      !isBankAccountSelectable(
        form.bank_account_origin_id,
        "origin",
        selectedAccountCurrencies.value.origin,
      )
    ) {
      form.bank_account_origin_id = "";
    }

    const normalizedDestinations = form.destinations.map((destination) =>
      destination.bank_account_id &&
      !isBankAccountSelectable(
        destination.bank_account_id,
        "destination",
        selectedAccountCurrencies.value.destination,
      )
        ? { ...destination, bank_account_id: "" }
        : destination,
    );
    if (
      normalizedDestinations.some(
        (destination, index) =>
          destination.bank_account_id !== form.destinations[index]?.bank_account_id,
      )
    ) {
      destinationDraftsModel.value = normalizedDestinations;
    }
  },
);

// Al cambiar filtros/búsqueda/tamaño de página, vuelve a la primera página.
watch(
  [
    statusFilter,
    userFilter,
    bankAccountFilter,
    currencyPairFilter,
    createdAtFrom,
    createdAtTo,
    transactionScope,
    selectedDay,
    debouncedSearch,
    perPage,
  ],
  () => {
    currentPage.value = 1;
  },
);

// Cualquier cambio de filtros o de página recarga desde el servidor.
watch(apiFilterParams, () => loadTransactions(), { deep: true });

watch(totalPages, () => {
  syncCurrentPageToTotal();
});

watch(currencyPairFilterOptions, (options) => {
  const current = currencyPairFilter.value;
  if (!current) return;
  if (!options.some((option) => option.value === current)) {
    currencyPairFilter.value = "";
  }
});

onMounted(() => {
  void calculatorStore.loadData({
    background: transactionCatalogReadyForCurrentMode(),
  });
  loadTransactions();
  void Promise.all([
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadTransactionFormUsers(),
    cuentasStore.loadBanks(),
    tasasStore.loadTaxRates(),
    comisionesStore.loadCommissions(),
    tagsStore.loadTags(),
  ]);
});

onActivated(() => {
  if (!transactionsStore.isLoading && !transactionsStore.isRefreshing) {
    loadTransactions();
  }
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
            v-if="canCreateTransactions"
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
            v-if="canCreateTransactions"
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
            v-if="canCreateTransactions"
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

      <!--
        Alcance de la lista. La operación es diaria, así que por defecto se
        muestra un solo día — que es además la unidad del correlativo `#`.
      -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dbe7fb] bg-[#f5f8ff] px-4 py-3"
      >
        <div class="flex flex-wrap items-center gap-3">
          <div class="inline-flex overflow-hidden rounded-lg border border-[#dbe7fb]">
            <button
              type="button"
              class="px-3 py-1.5 text-sm transition"
              :class="
                transactionScope === 'day'
                  ? 'bg-brasper-indigoStrong font-medium text-white'
                  : 'bg-white text-[#374151] hover:bg-[#f9fafb]'
              "
              :aria-pressed="transactionScope === 'day'"
              @click="transactionScope = 'day'"
            >
              Por día
            </button>
            <button
              type="button"
              class="border-l border-[#dbe7fb] px-3 py-1.5 text-sm transition"
              :class="
                transactionScope === 'all'
                  ? 'bg-brasper-indigoStrong font-medium text-white'
                  : 'bg-white text-[#374151] hover:bg-[#f9fafb]'
              "
              :aria-pressed="transactionScope === 'all'"
              @click="transactionScope = 'all'"
            >
              Todas
            </button>
          </div>

          <template v-if="transactionScope === 'day'">
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="rounded-lg border border-[#dbe7fb] bg-white px-2 py-1.5 text-sm text-[#374151] transition hover:bg-[#f9fafb]"
                title="Día anterior"
                @click="shiftSelectedDay(-1)"
              >
                ‹
              </button>
              <button
                type="button"
                class="rounded-lg border border-[#dbe7fb] bg-white px-2 py-1.5 text-sm text-[#374151] transition hover:bg-[#f9fafb] disabled:opacity-40"
                title="Día siguiente"
                :disabled="isToday"
                @click="shiftSelectedDay(1)"
              >
                ›
              </button>
            </div>
            <div>
              <p class="text-base font-semibold leading-tight text-[#232b4d]">
                {{ selectedDayLabel }}
                <span
                  v-if="isToday"
                  class="ml-1 rounded-md bg-[#dcfce7] px-1.5 py-0.5 text-[11px] font-semibold text-[#15803d]"
                >
                  hoy
                </span>
              </p>
              <p class="text-xs text-[#6b7280]">
                De 00:00 a 23:59 · {{ totalResults }}
                {{ totalResults === 1 ? "envío" : "envíos" }}
              </p>
            </div>
            <AppDateInput v-model="selectedDay" size="sm" class="min-w-[150px]" />
            <button
              v-if="!isToday"
              type="button"
              class="rounded-lg border border-[#dbe7fb] bg-white px-3 py-1.5 text-sm text-brasper-indigoStrong transition hover:bg-[#f9fafb]"
              @click="goToToday"
            >
              Ir a hoy
            </button>
          </template>
          <p v-else class="text-sm text-[#374151]">
            Histórico completo · <strong>{{ totalResults }}</strong> envíos.
            La columna <code class="rounded bg-white px-1">#</code> sigue siendo el
            número del envío dentro de su día.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <span v-if="exportError" class="text-xs text-[#dc3545]">
            {{ exportError }}
          </span>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-[#dbe7fb] bg-white px-3 py-2 text-sm font-medium text-brasper-indigoStrong transition hover:bg-[#f9fafb] disabled:opacity-50"
            :disabled="isExporting || totalResults === 0"
            :title="
              transactionScope === 'day'
                ? `Descargar los ${totalResults} envíos de este día, con los filtros aplicados`
                : `Descargar los ${totalResults} envíos del histórico, con los filtros aplicados`
            "
            @click="exportTransactionsToExcel"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {{
              isExporting
                ? "Generando…"
                : transactionScope === "day"
                  ? "Exportar el día"
                  : "Exportar todo"
            }}
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
          <label class="text-[11px] text-[#6b7280]">Moneda</label>
          <AppDropdown
            v-model="currencyPairFilter"
            :options="currencyPairFilterOptions"
            placeholder="Todas"
            :searchable="false"
            size="sm"
            min-width="130px"
          />
        </div>
        <div v-if="transactionScope === 'all'" class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Envío desde</label>
          <AppDateInput
            v-model="createdAtFrom"
            size="sm"
            class="min-w-[150px]"
          />
        </div>
        <div v-if="transactionScope === 'all'" class="flex flex-col gap-0.5">
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
      v-if="
        transactionsStore.isLoading &&
        !transactionsStore.hasLoadedOnce &&
        transactionsStore.transactions.length === 0
      "
      class="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-[#e5e7eb] bg-white p-10"
    >
      <span
        class="inline-block h-8 w-8 animate-spin rounded-full border-2 border-brasper-indigoStrong border-t-transparent"
        aria-hidden="true"
      />
      <p class="text-sm font-medium text-[#374151]">Cargando transacciones…</p>
    </div>

    <div
      v-else
      ref="tableScrollRef"
      class="relative overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white"
      :class="isDraggingTable ? 'cursor-grabbing select-none' : 'cursor-grab'"
      @pointerdown="onTablePointerDown"
    >
      <div
        v-if="
          transactionsStore.isLoading && transactionsStore.transactions.length === 0
        "
        class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80"
      >
        <span class="text-sm font-medium text-[#374151]">Cargando transacciones…</span>
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

      <table class="w-full min-w-[1180px] text-left text-sm">
        <thead>
          <tr class="bg-[#dbeafe]">
            <th
              class="w-12 px-3 py-3 text-right font-semibold text-brasper-indigoDark"
              title="Envío del día: el contador reinicia cada día"
            >
              #
            </th>
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
              Razón social
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 text-center font-semibold text-brasper-indigoDark"
            >
              Monto de envío
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Cuenta destino
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
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Estado
            </th>
            <th
              class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              Envío (fecha/hora)
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
            <th
              class="sticky right-0 z-[2] w-12 bg-[#dbeafe] px-2 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"
            ></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-if="paginatedTransactions.length === 0"
            class="border-t border-[#e5e7eb]"
          >
            <td
              colspan="15"
              class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-6 py-12 text-center text-[#666]"
            >
              <template
                v-if="
                  transactionsStore.hasLoadedOnce &&
                  totalResults === 0 &&
                  !transactionsStore.error
                "
              >
                <p class="mb-3">
                  No hay transacciones que coincidan con los filtros.
                </p>
                <button
                  type="button"
                  class="inline-flex items-center rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-brasper-indigoStrong transition hover:bg-[#f9fafb]"
                  @click="loadTransactions"
                >
                  Reintentar carga
                </button>
              </template>
              <template v-else>
                No hay transacciones en esta página.
              </template>
            </td>
          </tr>
          <tr
            v-for="t in paginatedTransactions"
            :key="t.id ?? ''"
            class="border-t border-[#e5e7eb] bg-white transition hover:bg-[#f9fafb]"
            :title="rowShortcutHint"
            @dblclick="onRowDoubleClick(t, $event)"
            @contextmenu.prevent="onRowContextMenu(t, $event)"
          >
            <td
              class="whitespace-nowrap px-3 py-3 text-right text-xs font-medium tabular-nums text-[#9ca3af]"
            >
              {{ transactionDailyNumber(t) }}
            </td>
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
            <td class="whitespace-nowrap px-4 py-3 font-medium text-[#374151]">
              <span class="inline-flex items-center gap-2">
                <template
                  v-for="flag in [getTransactionOriginFlag(t)]"
                  :key="flag?.src ?? 'none'"
                >
                  <img
                    v-if="flag"
                    :src="flag.src"
                    :alt="flag.label"
                    :title="flag.label"
                    class="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-[#e5e7eb]"
                  />
                </template>
                <span>{{ formatTransactionCodeForDisplay(t.code) }}</span>
              </span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-[#374151]">
              {{ t.operation_number || "—" }}
            </td>
            <td class="max-w-[200px] px-4 py-3 text-[#374151]">
              <span class="block truncate">
                {{ getClientLabel(t.user_id) }}
                <span
                  v-if="isClientIncomplete(t.user_id)"
                  class="ml-1 inline-flex items-center rounded-full border border-[#fed7aa] bg-[#fff7ed] px-1.5 text-[10px] font-semibold text-[#9a3412]"
                  title="Alta rápida sin completar: falta email y documento"
                >
                  por completar
                </span>
              </span>
              <span
                v-if="transactionTags(t).length"
                class="mt-1 flex flex-wrap gap-1"
              >
                <span
                  v-for="tag in transactionTags(t)"
                  :key="tag.id"
                  class="inline-flex items-center rounded-full border px-2 py-px text-[10px] font-semibold"
                  :style="tagChipStyle(tag.color)"
                >
                  {{ tag.label }}
                </span>
              </span>
            </td>
            <td
              class="max-w-[180px] truncate px-4 py-3 text-[#374151]"
              :title="transactionCompanyNameTable(t)"
            >
              {{ transactionCompanyNameTable(t) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-center tabular-nums text-[#374151]">
              {{
                formatValueWithCurrency(
                  t.origin_amount,
                  getTransactionCurrencies(t).origin,
                )
              }}
            </td>
            <td
              class="max-w-[180px] truncate px-4 py-3 text-[#374151]"
              :title="getTransactionDestinationAccountsTitle(t)"
            >
              {{ getTransactionDestinationAccountsLabel(t) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-center tabular-nums text-[#374151]">
              {{
                formatValueWithCurrency(
                  t.destination_amount,
                  getTransactionCurrencies(t).destination,
                )
              }}
            </td>
            <td
              class="max-w-[140px] truncate whitespace-nowrap px-4 py-3 tabular-nums text-[#374151]"
              :title="getTransactionExchangeTitle(t)"
            >
              {{ getTransactionExchangeLabel(t) }}
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
            <td class="whitespace-nowrap px-4 py-3 text-[#374151]">
              {{ formatDateTime(t.send_date) }}
            </td>
            <td class="px-2 py-2 align-middle text-center">
              <template v-if="voucherMediaHref(t.send_voucher)">
                <a
                  :href="voucherMediaHref(t.send_voucher)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex max-w-[5rem] flex-col items-center gap-1"
                  :title="'Abrir comprobante de envío en nueva pestaña'"
                >
                  <img
                    :src="voucherMediaHref(t.send_voucher)"
                    alt=""
                    class="h-11 w-11 rounded border border-[#e5e7eb] bg-[#f3f4f6] object-cover"
                    loading="lazy"
                    @error="
                      ($event.target as HTMLImageElement).classList.add('hidden')
                    "
                  />
                  <span
                    class="text-[10px] font-medium leading-tight text-brasper-indigoStrong underline decoration-transparent hover:decoration-current"
                  >
                    Abrir
                  </span>
                </a>
              </template>
              <span v-else class="text-[#9ca3af]">—</span>
            </td>
            <td class="px-2 py-2 align-middle text-center">
              <template v-if="voucherMediaHref(t.payment_voucher)">
                <a
                  :href="voucherMediaHref(t.payment_voucher)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex max-w-[5rem] flex-col items-center gap-1"
                  :title="'Abrir comprobante de pago en nueva pestaña'"
                >
                  <img
                    :src="voucherMediaHref(t.payment_voucher)"
                    alt=""
                    class="h-11 w-11 rounded border border-[#e5e7eb] bg-[#f3f4f6] object-cover"
                    loading="lazy"
                    @error="
                      ($event.target as HTMLImageElement).classList.add('hidden')
                    "
                  />
                  <span
                    class="text-[10px] font-medium leading-tight text-brasper-indigoStrong underline decoration-transparent hover:decoration-current"
                  >
                    Abrir
                  </span>
                </a>
              </template>
              <span v-else class="text-[#9ca3af]">—</span>
            </td>
            <td
              class="sticky right-0 z-[1] bg-white px-2 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"
            >
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
          v-if="canUpdateTransactions"
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
          v-if="canDeleteTransactions"
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
      >
        <div
          class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#d8e5fb] bg-white shadow-xl"
        >
          <!-- Cabecera -->
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
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Cuerpo -->
          <div class="flex-1 overflow-y-auto">
            <p
              v-if="previewLoading"
              class="flex items-center justify-center gap-2 py-12 text-sm text-[#6b7280]"
            >
              <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brasper-indigoStrong border-t-transparent" />
              Cargando catálogo (tasas, comisiones, cuentas)…
            </p>

            <template v-else-if="previewTransaction">
              <!-- Hero: código, estado y verificación -->
              <div
                v-if="previewSectionGroups.resumen"
                class="border-b border-[#e8eef8] bg-gradient-to-r from-[#f0f4ff] to-[#f8faff] px-6 py-5"
              >
                <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">Código</p>
                    <p class="font-mono text-2xl font-bold text-brasper-indigoStrong leading-tight">
                      {{ previewSectionGroups.resumen.items.find(i => i.label === 'Código')?.value ?? '—' }}
                    </p>
                  </div>
                  <div class="hidden h-10 w-px bg-[#d1d5db] sm:block" />
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">Estado</p>
                    <span
                      class="mt-1 inline-flex rounded-full px-3 py-1 text-sm font-semibold"
                      :class="statusRowBadgeClass(resolveTransactionStatusForDisplay(previewTransaction) ?? previewTransaction.status)"
                    >
                      {{ previewSectionGroups.resumen.items.find(i => i.label === 'Estado')?.value ?? '—' }}
                    </span>
                  </div>
                  <div class="hidden h-10 w-px bg-[#d1d5db] sm:block" />
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">Verificada</p>
                    <span
                      class="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
                      :class="previewSectionGroups.resumen.items.find(i => i.label === 'Verificada')?.value === 'Sí' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'"
                    >
                      <svg
                        v-if="previewSectionGroups.resumen.items.find(i => i.label === 'Verificada')?.value === 'Sí'"
                        class="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      {{ previewSectionGroups.resumen.items.find(i => i.label === 'Verificada')?.value ?? '—' }}
                    </span>
                  </div>
                  <div class="hidden h-10 w-px bg-[#d1d5db] sm:block" />
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">Ventas / asesor</p>
                    <p class="mt-1 text-sm font-semibold text-[#111827]">
                      {{ previewSectionGroups.resumen.items.find(i => i.label === 'Ventas / asesor')?.value ?? '—' }}
                    </p>
                  </div>
                  <div class="hidden h-10 w-px bg-[#d1d5db] sm:block" />
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">N.º operación</p>
                    <p class="mt-1 font-mono text-sm font-semibold tabular-nums text-[#111827]">
                      {{ previewSectionGroups.resumen.items.find(i => i.label === 'N.º operación')?.value ?? '—' }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Grid principal: izquierda / derecha -->
              <div class="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-[#e8eef8]">
                <!-- Columna izquierda: Participantes + Cuentas destino + Condiciones -->
                <div class="space-y-4 p-5">
                  <section
                    v-for="section in previewSectionGroups.left.filter(s => s.id === 'participantes')"
                    :key="section.id"
                    class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                  >
                    <div class="mb-3 border-b border-[#e5e7eb]/80 pb-2">
                      <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong">
                        {{ section.title }}
                      </h3>
                      <p v-if="section.subtitle" class="mt-1 text-xs text-[#6b7280]">
                        {{ section.subtitle }}
                      </p>
                    </div>
                    <dl class="space-y-2.5">
                      <div
                        v-for="(item, i) in section.items"
                        :key="`${section.id}-${i}-${item.label}`"
                        class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                      >
                        <dt class="shrink-0 text-xs font-medium uppercase tracking-wide text-[#6b7280] sm:min-w-[8rem]">
                          {{ item.label }}
                        </dt>
                        <dd class="min-w-0 text-right text-sm font-medium">
                          <span
                            v-if="item.variant === 'mono'"
                            class="break-all text-xs text-[#374151]"
                          >{{ item.value }}</span>
                          <span v-else class="text-[#111827]">{{ item.value }}</span>
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <!-- Cuentas destino: una fila por cuenta con titular y monto -->
                  <section
                    v-if="previewDestinations.rows.length"
                    class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                  >
                    <div class="mb-3 flex items-start justify-between gap-3 border-b border-[#e5e7eb]/80 pb-2">
                      <div>
                        <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong">
                          Cuentas destino
                        </h3>
                        <p class="mt-1 text-xs text-[#6b7280]">
                          Distribución del monto a recibir
                        </p>
                      </div>
                      <span class="shrink-0 rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brasper-indigoStrong">
                        {{ previewDestinations.rows.length }}
                        {{ previewDestinations.rows.length === 1 ? "cuenta" : "cuentas" }}
                      </span>
                    </div>
                    <ul class="space-y-2">
                      <li
                        v-for="row in previewDestinations.rows"
                        :key="`preview-destination-${row.position}`"
                        class="rounded-lg border border-[#e8eef8] bg-white px-3 py-2.5"
                      >
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <p
                              class="truncate text-sm font-semibold text-[#111827]"
                              :title="row.bankLabel"
                            >
                              {{ row.bankLabel }}
                            </p>
                            <div
                              v-if="row.identifiers.length"
                              class="mt-1 space-y-1"
                            >
                              <button
                                v-for="identifier in row.identifiers"
                                :key="`${row.position}-${identifier.label}-${identifier.value}`"
                                type="button"
                                class="group flex max-w-full items-start gap-1.5 text-left text-xs tabular-nums text-[#6b7280] transition hover:text-brasper-indigoStrong"
                                :title="`Copiar ${identifier.label}: ${identifier.value}`"
                                @click="copyPreviewAccountIdentifier(identifier.value)"
                              >
                                <span class="shrink-0 font-medium">{{ identifier.label }}:</span>
                                <span class="break-all font-mono">{{ identifier.value }}</span>
                                <span class="shrink-0 font-sans text-[10px] font-semibold text-brasper-indigoStrong">
                                  {{ copiedPreviewAccountIdentifier === identifier.value ? "Copiado" : "Copiar" }}
                                </span>
                              </button>
                            </div>
                            <p
                              class="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-[#374151]"
                              :title="row.holderLabel"
                            >
                              <svg
                                class="h-3.5 w-3.5 shrink-0 text-[#9ca3af]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                              <span class="truncate">{{ row.holderLabel }}</span>
                            </p>
                          </div>
                          <div class="shrink-0 text-right">
                            <p class="text-sm font-semibold tabular-nums text-[#111827]">
                              {{ row.amountLabel }}
                            </p>
                            <p
                              v-if="row.shareLabel"
                              class="mt-0.5 text-[11px] font-medium tabular-nums text-[#6b7280]"
                            >
                              {{ row.shareLabel }} del total
                            </p>
                          </div>
                        </div>
                      </li>
                    </ul>
                    <div
                      v-if="previewDestinations.rows.length > 1"
                      class="mt-2.5 flex items-baseline justify-between gap-3 border-t border-[#e8eef8] pt-2"
                    >
                      <span class="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                        Total distribuido
                      </span>
                      <span class="text-sm font-semibold tabular-nums text-[#111827]">
                        {{ previewDestinations.totalLabel }}
                      </span>
                    </div>
                  </section>

                  <section
                    v-for="section in previewSectionGroups.left.filter(s => s.id === 'condiciones')"
                    :key="section.id"
                    class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                  >
                    <div class="mb-3 border-b border-[#e5e7eb]/80 pb-2">
                      <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong">
                        {{ section.title }}
                      </h3>
                      <p v-if="section.subtitle" class="mt-1 text-xs text-[#6b7280]">
                        {{ section.subtitle }}
                      </p>
                    </div>
                    <dl class="space-y-2.5">
                      <div
                        v-for="(item, i) in section.items"
                        :key="`${section.id}-${i}-${item.label}`"
                        class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                      >
                        <dt class="shrink-0 text-xs font-medium uppercase tracking-wide text-[#6b7280] sm:min-w-[8rem]">
                          {{ item.label }}
                        </dt>
                        <dd class="min-w-0 text-right text-sm font-medium">
                          <span
                            v-if="item.variant === 'mono'"
                            class="break-all text-xs text-[#374151]"
                          >{{ item.value }}</span>
                          <span v-else class="text-[#111827]">{{ item.value }}</span>
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>

                <!-- Columna derecha: Importes + Fechas -->
                <div class="space-y-4 border-t border-[#e8eef8] p-5 lg:border-t-0">
                  <!-- Importes con énfasis en valores monetarios -->
                  <section
                    v-for="section in previewSectionGroups.right.filter(s => s.id === 'importes')"
                    :key="section.id"
                    class="rounded-xl border border-[#d8e5fb] bg-[#f5f8ff] p-4 shadow-sm"
                  >
                    <div class="mb-3 border-b border-[#d8e5fb]/80 pb-2">
                      <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong">
                        {{ section.title }}
                      </h3>
                    </div>
                    <dl class="space-y-2.5">
                      <template
                        v-for="(item, i) in section.items"
                        :key="`${section.id}-${i}-${item.label}`"
                      >
                        <div v-if="item.variant === 'separator'" class="-mx-1 my-1 border-t border-[#d8e5fb]" />
                        <div v-else class="flex items-baseline justify-between gap-4">
                          <dt class="text-xs font-medium text-[#6b7280]">{{ item.label }}</dt>
                          <dd class="tabular-nums text-sm font-semibold text-[#111827]">{{ item.value }}</dd>
                        </div>
                      </template>
                    </dl>
                  </section>

                  <!-- Fechas -->
                  <section
                    v-for="section in previewSectionGroups.right.filter(s => s.id === 'fechas')"
                    :key="section.id"
                    class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                  >
                    <div class="mb-3 border-b border-[#e5e7eb]/80 pb-2">
                      <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong">
                        {{ section.title }}
                      </h3>
                      <p v-if="section.subtitle" class="mt-1 text-xs text-[#6b7280]">
                        {{ section.subtitle }}
                      </p>
                    </div>
                    <dl class="space-y-2.5">
                      <div
                        v-for="(item, i) in section.items"
                        :key="`${section.id}-${i}-${item.label}`"
                        class="flex items-baseline justify-between gap-4"
                      >
                        <dt class="text-xs font-medium text-[#6b7280]">{{ item.label }}</dt>
                        <dd class="text-sm font-medium text-[#111827]">{{ item.value }}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              </div>

              <!-- Registro + Extra: full width, compacto en 2 columnas -->
              <div
                v-if="previewSectionGroups.bottom.length > 0"
                class="border-t border-[#e8eef8] px-5 pb-5 pt-4 space-y-4"
              >
                <section
                  v-for="section in previewSectionGroups.bottom"
                  :key="section.id"
                  class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                >
                  <div class="mb-3 border-b border-[#e5e7eb]/80 pb-2">
                    <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong">
                      {{ section.title }}
                    </h3>
                    <p v-if="section.subtitle" class="mt-1 text-xs text-[#6b7280]">
                      {{ section.subtitle }}
                    </p>
                  </div>
                  <dl class="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
                    <div
                      v-for="(item, i) in section.items"
                      :key="`${section.id}-${i}-${item.label}`"
                      class="flex flex-col gap-0.5"
                    >
                      <dt class="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">{{ item.label }}</dt>
                      <dd class="text-xs font-medium text-[#374151]">
                        <span v-if="item.variant === 'mono'" class="break-all font-mono">{{ item.value }}</span>
                        <span v-else>{{ item.value }}</span>
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              <!-- Comprobantes: todas las imágenes de cada grupo -->
              <div
                v-if="previewVoucherGroups.length > 0"
                class="border-t border-[#e8eef8] px-5 pb-5 pt-4"
              >
                <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong">
                      Comprobantes
                    </h3>
                    <p class="mt-1 text-xs text-[#6b7280]">
                      Clic en una miniatura para abrir en tamaño completo
                    </p>
                  </div>
                  <span class="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-brasper-indigoStrong">
                    {{ previewVoucherTotal }} {{ previewVoucherTotal === 1 ? "archivo" : "archivos" }}
                  </span>
                </div>
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <section
                    v-for="group in previewVoucherGroups"
                    :key="group.key"
                    class="flex flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f9fafb]"
                  >
                    <div class="flex items-center justify-between gap-2 border-b border-[#e5e7eb] bg-white px-3 py-2">
                      <span class="text-xs font-semibold text-[#374151]">{{ group.title }}</span>
                      <span class="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#6b7280]">
                        {{ group.entries.length }}
                      </span>
                    </div>
                    <div class="flex-1 space-y-2 p-2">
                      <a
                        v-for="(entry, entryIdx) in group.entries"
                        :key="`${group.key}-${entryIdx}-${entry.href}`"
                        :href="entry.href"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="group/voucher block cursor-pointer overflow-hidden rounded-lg border border-[#e5e7eb] bg-white transition hover:border-brasper-indigoStrong/40 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brasper-indigoStrong"
                        :title="entry.label"
                      >
                        <img
                          v-if="entry.isImage"
                          :src="entry.href"
                          :alt="`${group.title} · ${entry.label}`"
                          loading="lazy"
                          class="max-h-40 w-full bg-[#f3f4f6] object-contain transition group-hover/voucher:opacity-90"
                          @error="($event.target as HTMLImageElement).classList.add('hidden')"
                        />
                        <span class="flex items-center gap-2 px-3 py-2">
                          <svg
                            class="h-3.5 w-3.5 shrink-0 text-[#9ca3af]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              v-if="!entry.isImage"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              v-else
                            />
                          </svg>
                          <span class="min-w-0 truncate text-xs font-medium text-[#374151]">
                            {{ entry.label }}
                          </span>
                          <span class="ml-auto shrink-0 text-[11px] font-semibold text-brasper-indigoStrong opacity-0 transition group-hover/voucher:opacity-100">
                            Abrir
                          </span>
                        </span>
                      </a>
                    </div>
                  </section>
                </div>
              </div>
            </template>
          </div>

          <!-- Pie -->
          <div
            v-if="previewTransaction && !previewLoading"
            class="flex flex-wrap items-center justify-end gap-2 border-t border-[#e5e7eb] bg-[#fafbfc] px-6 py-4"
          >
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb]"
              @click="closePreviewModal"
            >
              Cerrar
            </button>
            <button
              v-if="previewTransaction.id && canUpdateTransactions"
              type="button"
              class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white hover:bg-brasper-indigoDark"
              @click="openEditFromPreview"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Editar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Paginación -->
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

    <!-- Modal Crear/Editar -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      >
        <div
          class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-xl"
          :class="isEditingMode ? 'max-w-7xl' : 'max-w-3xl'"
        >
          <button
            v-if="isEditingMode"
            type="button"
            class="absolute right-7 top-7 z-10 rounded-full border border-[#e5e7eb] bg-white/95 p-2 text-[#6b7280] shadow-sm transition hover:bg-white hover:text-[#374151]"
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
          <div
            v-if="!isEditingMode"
            class="flex items-start justify-between gap-4 border-b border-[#e8edf7] bg-[#fafcff] px-6 py-5"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3">
                <div
                  v-if="isEditingMode"
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brasper-indigoStrong/8 text-brasper-indigoStrong"
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
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </div>
                <div class="min-w-0">
                  <h2 class="text-xl font-semibold tracking-[-0.01em] text-[#1f2937]">
                {{ editingId ? "Editar transacción" : "Nueva transacción" }}
                  </h2>
                  <p
                    v-if="!isEditingMode"
                    class="mt-0.5 text-xs font-medium text-[#6b7280]"
                  >
                Paso {{ createStepIndex + 1 }} de {{ CREATE_FLOW_STEPS.length }}
                · {{ CREATE_FLOW_STEPS[createStepIndex]?.title ?? "" }}
                  </p>
                  <p
                    v-else
                    class="mt-0.5 text-sm leading-relaxed text-[#6b7280]"
                  >
                Formulario de edición con datos resueltos desde el endpoint
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="rounded-xl border border-transparent p-2 text-[#6b7280] transition hover:border-[#e5e7eb] hover:bg-white"
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
            v-if="!isEditingMode"
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
          <div
            class="flex-1 overflow-y-auto"
            :class="isEditingMode ? '' : 'p-6'"
          >
            <form
              v-if="isEditingMode"
              class="flex min-h-0 flex-1"
              @submit.prevent="submitForm"
            >
              <div
                v-if="editModalLoading"
                class="flex min-h-[22rem] w-full flex-col items-center justify-center gap-3 px-8 py-12 text-center"
              >
                <span
                  class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brasper-indigoStrong border-t-transparent"
                />
                <div>
                  <h3 class="text-sm font-semibold text-[#1f2937]">
                    Cargando transacción
                  </h3>
                  <p class="mt-1 text-sm text-[#6b7280]">
                    Estamos preparando el formulario y los catálogos para
                    editar.
                  </p>
                </div>
              </div>

              <template v-else>
                <div
                  v-if="editQuoteCorrectionMode"
                  class="flex min-h-0 w-full flex-col bg-[#f6f8fc]"
                >
                  <div class="flex-1 overflow-y-auto p-5">
                    <div class="mx-auto max-w-2xl space-y-5">
                      <div class="rounded-2xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5">
                        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-brasper-indigoStrong">
                          Cotización
                        </p>
                        <h3 class="mt-2 text-lg font-semibold text-[#1f2937]">
                          Corregir montos
                        </h3>
                        <p class="mt-1 text-sm leading-relaxed text-[#6b7280]">
                          Ajusta el monto en la calculadora y aplica los cambios para volver a la edición.
                        </p>
                      </div>
                      <CalculatorConversionCard
                        variant="production"
                        :show-send-cta="false"
                        :show-calculation-mode-toggle="true"
                        :show-coin-catalog-reload="true"
                      />
                      <TasasDemoCompact
                        v-if="calculatorStore.calculationMode === 'special'"
                        :use-main-calculator-store="true"
                        :filter-rates-to-selected-pair="true"
                      />
                    </div>
                  </div>
                  <div class="border-t border-[#e5e7eb] bg-white px-4 py-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        class="rounded-xl border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
                        @click="cancelEditQuoteCorrection"
                      >
                        Volver sin aplicar
                      </button>
                      <button
                        type="button"
                        class="rounded-xl bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark"
                        @click="applyEditQuoteCorrection"
                      >
                        Aplicar montos
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  v-else
                  class="grid min-h-0 w-full gap-5 bg-[#f6f8fc] p-5 xl:grid-cols-[420px_minmax(0,1fr)]"
                >
                  <div
                    class="hidden min-h-0 flex-col gap-4 text-[#1f2937] xl:flex"
                  >
                    <div class="grid grid-cols-2 gap-3 rounded-2xl border border-[#e6ebf4] bg-white p-4 sm:grid-cols-4">
                      <div class="min-w-0">
                        <span class="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b88a1]">
                          Código
                        </span>
                        <span class="mt-2 block truncate text-[13px] font-semibold text-[#1f2937]">
                          {{ editModalSummary?.code }}
                        </span>
                      </div>
                      <div class="min-w-0">
                        <span class="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b88a1]">
                          Estado
                        </span>
                        <span
                          class="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                        >
                          {{ editModalSummary?.status }}
                        </span>
                      </div>
                      <div class="min-w-0">
                        <span class="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b88a1]">
                          Verificada
                        </span>
                        <span class="mt-2 block text-sm font-semibold text-[#1f2937]">
                          {{ editModalSummary?.checked }}
                        </span>
                      </div>
                      <div class="min-w-0">
                        <span class="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b88a1]">
                          Ventas / asesor
                        </span>
                        <span class="mt-2 block truncate text-sm font-semibold text-[#1f2937]">
                          {{ editModalSummary?.agent }}
                        </span>
                      </div>
                    </div>

                    <div class="space-y-4">
                      <section class="rounded-2xl border border-[#e6ebf4] bg-white p-4">
                        <div class="flex items-center gap-2">
                          <span class="h-2 w-2 rounded-full bg-violet-300"></span>
                          <h3 class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#50607c]">
                            Participantes
                          </h3>
                        </div>
                        <dl class="mt-4 space-y-3.5">
                          <div
                            v-for="item in editHeroParticipants"
                            :key="item.label"
                            class="flex items-start justify-between gap-4"
                          >
                            <dt class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b88a1]">
                              {{ item.label }}
                            </dt>
                            <dd class="max-w-[13rem] text-right text-sm font-semibold leading-relaxed text-[#1f2937]">
                              {{ item.value }}
                            </dd>
                          </div>
                        </dl>
                      </section>

                      <section class="rounded-2xl border border-[#e6ebf4] bg-white p-4">
                        <div class="flex items-center gap-2">
                          <span class="h-2 w-2 rounded-full bg-cyan-300"></span>
                          <h3 class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#50607c]">
                            Condiciones comerciales
                          </h3>
                        </div>
                        <dl class="mt-4 space-y-3.5">
                          <div
                            v-for="item in editHeroConditions"
                            :key="item.label"
                            class="flex items-start justify-between gap-4"
                          >
                            <dt class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b88a1]">
                              {{ item.label }}
                            </dt>
                            <dd class="max-w-[13rem] text-right text-sm font-semibold leading-relaxed text-[#1f2937]">
                              {{ item.value }}
                            </dd>
                          </div>
                        </dl>
                      </section>

                      <section class="rounded-2xl border border-[#e6ebf4] bg-white p-4">
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex items-center gap-2">
                            <span class="h-2 w-2 rounded-full bg-emerald-300"></span>
                            <h3 class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#50607c]">
                              Importes globales
                            </h3>
                          </div>
                          <button
                            type="button"
                            class="rounded-lg border border-[#c7d7f5] bg-[#f8faff] px-3 py-1.5 text-xs font-semibold text-brasper-indigoStrong transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                            @click="openEditQuoteCorrection"
                          >
                            Corregir montos
                          </button>
                        </div>
                        <div class="mt-4 rounded-3xl border border-[#e8eef8] bg-[#fbfdff] p-4">
                          <dl class="space-y-3">
                            <div
                              v-for="item in editHeroAmounts"
                              :key="item.label"
                              class="flex items-center justify-between gap-4"
                            >
                              <dt class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b88a1]">
                                {{ item.label }}
                              </dt>
                              <dd class="text-right text-[1.35rem] font-semibold tracking-[0.01em] text-[#1f2937]">
                                {{ item.value }}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </section>
                    </div>
                  </div>

                  <section class="flex min-h-0 flex-col">
                    <div class="flex-1 overflow-y-auto px-5 pb-5">
                      <div class="space-y-5">
                        <section class="rounded-2xl border border-[#edf1f6] bg-[#fcfdff] p-5">
                          <div class="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <h3 class="text-sm font-semibold text-[#1f2937]">Datos</h3>
                              <p class="mt-1 text-xs text-[#6b7280]">
                                Usuario, cuentas y fechas.
                              </p>
                            </div>
                          </div>
                          <div class="grid gap-4 sm:grid-cols-2">
                            <div class="space-y-1.5">
                              <label class="block text-sm font-medium text-[#374151]"
                                >Usuario *</label
                              >
                              <div class="flex gap-2">
                                <AppDropdown
                                  v-model="form.user_id"
                                  :options="editableUserOptions"
                                  placeholder="Seleccionar usuario"
                                  :searchable="editableUserOptions.length > 10"
                                  class="min-w-0 flex-1"
                                />
                                <button
                                  type="button"
                                  class="flex shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-2.5 text-[#6b7280] transition hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#374151]"
                                  title="Nuevo cliente"
                                  @click="openTransactionClientModal"
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
                                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div class="space-y-1.5">
                              <label class="block text-sm font-medium text-[#374151]"
                                >Ventas / asesor</label
                              >
                              <AppDropdown
                                v-model="form.agent_id"
                                :options="salesAdvisorOptions"
                                placeholder="Seleccionar asesor"
                                :searchable="salesAdvisorOptions.length > 10"
                                class="min-w-0"
                              />
                            </div>
                            <div class="space-y-1.5 sm:col-span-2">
                              <label class="block text-sm font-medium text-[#374151]"
                                >Razón social</label
                              >
                              <p class="text-xs text-[#6b7280]">
                                Nombre en tabla (moneda de envío
                                <template v-if="selectedAccountCurrencies.origin">
                                  {{ selectedAccountCurrencies.origin }}
                                </template>
                                ). El banco enviado al API es el de la cuenta destino.
                              </p>
                              <div class="flex gap-2">
                                <AppDropdown
                                  v-model="destinationBankSelectionModel"
                                  :options="destinationBankFilterOptions"
                                  placeholder="Todos"
                                  :searchable="destinationBankFilterOptions.length > 8"
                                  class="min-w-0 flex-1"
                                />
                                <button
                                  type="button"
                                  class="flex shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-2.5 text-[#6b7280] transition hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#374151]"
                                  title="Nuevo banco (catálogo)"
                                  @click="openBancoCrudForCreate"
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
                                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div class="space-y-1.5 sm:col-span-2">
                              <label class="block text-sm font-medium text-[#374151]"
                                >Cuentas destino *</label
                              >
                              <TransactionDestinationsEditor
                                v-model="destinationDraftsModel"
                                :options="destinationAccountOptions"
                                :expected-total="form.destination_amount"
                                :currency="selectedAccountCurrencies.destination"
                                :loading="destinationAccountsLoading"
                                @create-account="openBankAccountModalFromTransaction('destination')"
                              />
                            </div>
                            <div
                              v-if="showDestinationBankCatalogWarning"
                              class="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950"
                            >
                              No se resolvió el banco de la cuenta destino en el catálogo local.
                            </div>
                            <div class="space-y-1.5">
                              <label class="block text-sm font-medium text-[#374151]"
                                >Fecha y hora envío</label
                              >
                              <AppDateInput v-model="form.send_date" with-time />
                            </div>
                            <div class="space-y-1.5">
                              <label class="block text-sm font-medium text-[#374151]"
                                >Fecha y hora pago</label
                              >
                              <AppDateInput v-model="form.payment_date" with-time />
                            </div>
                            <div class="grid gap-4 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] sm:items-start">
                              <div class="space-y-1.5">
                                <label class="block text-sm font-medium text-[#374151]"
                                  >Número de operación</label
                                >
                                <input
                                  v-model.trim="form.operation_number"
                                  type="text"
                                  class="w-full rounded-xl border border-[#dce3ef] bg-white px-3 py-2.5 text-sm text-[#374151] outline-none transition focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/15"
                                  placeholder="Escribe el número de operación"
                                  autocomplete="off"
                                />
                              </div>
                              <div class="space-y-2">
                                <div class="flex items-center justify-between gap-3">
                                  <span class="text-sm font-medium text-[#374151]">
                                    Ver imagen de envío
                                  </span>
                                  <a
                                    v-if="activeSendVoucherPreviewSrc"
                                    :href="activeSendVoucherPreviewSrc"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="text-xs font-semibold text-brasper-indigoStrong underline decoration-transparent hover:decoration-current"
                                  >
                                    Abrir
                                  </a>
                                </div>
                                <a
                                  v-if="activeSendVoucherPreviewSrc"
                                  :href="activeSendVoucherPreviewSrc"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="block overflow-hidden rounded-xl border border-[#dce3ef] bg-white"
                                >
                                  <img
                                    :src="activeSendVoucherPreviewSrc"
                                    alt="Imagen de envío"
                                    class="h-28 w-full object-contain"
                                  />
                                </a>
                                <div
                                  v-else
                                  class="flex h-28 items-center justify-center rounded-xl border border-dashed border-[#dce3ef] bg-white px-3 text-center text-xs text-[#9ca3af]"
                                >
                                  Sin imagen de envío
                                </div>
                              </div>
                            </div>
                          </div>
                        </section>

                        <section class="rounded-2xl border border-amber-200/60 bg-amber-50/45 p-5">
                      
                          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <div class="space-y-1.5">
                              <label class="block text-sm font-medium text-[#374151]"
                                >Estado</label
                              >
                              <AppDropdown
                                v-model="form.status"
                                :options="statusFormOptions"
                                placeholder="Estado"
                                :searchable="false"
                              />
                            </div>
                            <label
                              class="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-200/90 bg-white px-4 py-3"
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
                        </section>

                        <section class="rounded-2xl border border-[#edf1f6] bg-[#fcfdff] p-5">
                          <div class="mb-4">
                            <h3 class="text-sm font-semibold text-[#1f2937]">Archivos</h3>
                            <p class="mt-1 text-xs text-[#6b7280]">
                              Los archivos ya subidos se conservan al guardar;
                              «Quitar» los elimina y puedes agregar nuevos.
                            </p>
                          </div>
                          <div class="grid gap-4 md:grid-cols-3">
                            <div
                              class="order-1 rounded-2xl border border-[#e8eef8] bg-white p-4 outline-none transition focus-within:border-brasper-indigoStrong/50 focus-within:ring-2 focus-within:ring-brasper-indigoStrong/10"
                              tabindex="0"
                              aria-label="Comprobante de envío: pega una imagen aquí"
                              @paste="onVoucherImagePaste('send_voucher', $event)"
                            >
                              <div class="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <h4 class="text-sm font-semibold text-[#232b4d]">
                                    Envío
                                  </h4>
                                  <p class="mt-0.5 text-xs text-[#6b7280]">Opcional</p>
                                </div>
                              </div>
                              <label
                                class="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#d5def0] bg-[#f8faff] px-4 py-2.5 text-sm font-semibold text-brasper-indigoStrong transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                              >
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*,.pdf,application/pdf"
                                  class="sr-only"
                                  @change="onVoucherFileSelect('send_voucher', $event)"
                                />
                                Agregar archivos
                              </label>
                              <p class="mt-2 text-xs text-[#6b7280]">
                                O pega una imagen aquí con Ctrl+V / Cmd+V
                              </p>
                              <TransactionVoucherFileList
                                :entries="voucherDisplayEntries('send_voucher')"
                                empty-label="Sin comprobantes de envío"
                                @remove="removeDisplayedVoucher('send_voucher', $event)"
                              />
                            </div>

                            <div
                              class="order-3 rounded-2xl border border-[#e8eef8] bg-white p-4 outline-none transition focus-within:border-brasper-indigoStrong/50 focus-within:ring-2 focus-within:ring-brasper-indigoStrong/10"
                              tabindex="0"
                              aria-label="Comprobante de pago: pega una imagen aquí"
                              @paste="onVoucherImagePaste('payment_voucher', $event)"
                            >
                              <div class="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <h4 class="text-sm font-semibold text-[#232b4d]">
                                    Pago
                                  </h4>
                                  <p class="mt-0.5 text-xs text-[#6b7280]">Opcional</p>
                                </div>
                              </div>
                              <label
                                class="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#d5def0] bg-[#f8faff] px-4 py-2.5 text-sm font-semibold text-brasper-indigoStrong transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                              >
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*,.pdf,application/pdf"
                                  class="sr-only"
                                  @change="onVoucherFileSelect('payment_voucher', $event)"
                                />
                                Agregar archivos
                              </label>
                              <p class="mt-2 text-xs text-[#6b7280]">
                                O pega una imagen aquí con Ctrl+V / Cmd+V
                              </p>
                              <TransactionVoucherFileList
                                :entries="voucherDisplayEntries('payment_voucher')"
                                empty-label="Sin comprobantes de pago"
                                @remove="removeDisplayedVoucher('payment_voucher', $event)"
                              />
                            </div>

                            <div
                              class="order-2 rounded-2xl border border-[#e8eef8] bg-white p-4 outline-none transition focus-within:border-brasper-indigoStrong/50 focus-within:ring-2 focus-within:ring-brasper-indigoStrong/10"
                              tabindex="0"
                              aria-label="Imagen de verificación: pega una imagen aquí"
                              @paste="onVoucherImagePaste('checked_image', $event)"
                            >
                              <div class="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <h4 class="text-sm font-semibold text-[#232b4d]">
                                    Verificación
                                  </h4>
                                  <p class="mt-0.5 text-xs text-[#6b7280]">
                                    Marca la operación
                                  </p>
                                </div>
                              </div>
                              <label
                                class="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#d5def0] bg-[#f8faff] px-4 py-2.5 text-sm font-semibold text-brasper-indigoStrong transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                              >
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*,.pdf,application/pdf"
                                  class="sr-only"
                                  @change="onVoucherFileSelect('checked_image', $event)"
                                />
                                Agregar archivos
                              </label>
                              <p class="mt-2 text-xs text-[#6b7280]">
                                O pega una imagen aquí con Ctrl+V / Cmd+V
                              </p>
                              <TransactionVoucherFileList
                                :entries="voucherDisplayEntries('checked_image')"
                                empty-label="Sin imagen de verificación"
                                @remove="removeDisplayedVoucher('checked_image', $event)"
                              />
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>

                    <div
                      class="border-t border-[#e5e7eb] bg-white px-4 py-4"
                    >
                      <div class="flex flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          class="rounded-xl border border-[#c7d7f5] bg-[#f8faff] px-5 py-2.5 text-sm font-semibold text-brasper-indigoStrong transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                          @click="openEditQuoteCorrection"
                        >
                          Corregir montos
                        </button>
                        <button
                          type="button"
                          class="rounded-xl border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
                          @click="showCreateModal = false"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          class="rounded-xl bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-60"
                          :disabled="
                            transactionsStore.isCreating || transactionsStore.isUpdating
                          "
                          @click="submitForm"
                        >
                          {{
                            transactionsStore.isCreating || transactionsStore.isUpdating
                              ? "Guardando..."
                              : "Guardar cambios"
                          }}
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </template>
            </form>

            <div
              v-else-if="createStepIndex === 0"
              class="min-w-0 space-y-5"
            >
              <p
                class="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-brasper-indigoStrong"
              >
                Cotización
              </p>
              <CalculatorConversionCard
                variant="production"
                :show-send-cta="false"
                :show-calculation-mode-toggle="true"
                :show-coin-catalog-reload="true"
              />
              <TasasDemoCompact
                v-if="calculatorStore.calculationMode === 'special'"
                :use-main-calculator-store="true"
                :filter-rates-to-selected-pair="true"
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
                      La cuenta destino se filtra por el cliente seleccionado
                    </p>
                  </div>
                </div>
                <div class="grid gap-5 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Cliente *</label
                    >
                    <div class="flex gap-2">
                      <AppDropdown
                        v-model="form.user_id"
                        :options="clientOptions"
                        placeholder="Seleccionar cliente"
                        :searchable="clientOptions.length > 10"
                        class="min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-2.5 text-[#6b7280] transition hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#374151]"
                        title="Nuevo cliente"
                        @click="openTransactionClientModal"
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
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Ventas / asesor</label
                    >
                    <AppDropdown
                      v-model="form.agent_id"
                      :options="salesAdvisorOptions"
                      placeholder="Seleccionar asesor"
                      :searchable="salesAdvisorOptions.length > 10"
                      class="min-w-0"
                    />
                  </div>
                  <div class="space-y-1.5 sm:col-span-2">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Razón social</label
                    >
                    <p class="text-xs text-[#6b7280]">
                      Nombre en tabla (moneda de envío
                      <template v-if="selectedAccountCurrencies.origin">
                        {{ selectedAccountCurrencies.origin }}
                      </template>
                      ). El banco enviado al API es el de la cuenta destino.
                    </p>
                    <div class="flex gap-2">
                      <AppDropdown
                        v-model="destinationBankSelectionModel"
                        :options="destinationBankFilterOptions"
                        placeholder="Todos"
                        :searchable="destinationBankFilterOptions.length > 8"
                        class="min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-2.5 text-[#6b7280] transition hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#374151]"
                        title="Nuevo banco (catálogo)"
                        @click="openBancoCrudForCreate"
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
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="space-y-1.5 sm:col-span-2">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Cuentas destino *</label
                    >
                    <TransactionDestinationsEditor
                      v-model="destinationDraftsModel"
                      :options="destinationAccountOptions"
                      :expected-total="form.destination_amount"
                      :currency="selectedAccountCurrencies.destination"
                      :loading="destinationAccountsLoading"
                      @create-account="openBankAccountModalFromTransaction('destination')"
                    />
                  </div>
                  <div
                    v-if="showDestinationBankCatalogWarning"
                    class="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950"
                  >
                    No se encontró el banco de esta cuenta en el catálogo local. Recarga la página
                    o revisa la cuenta en Cuentas bancarias.
                  </div>
                  <p
                    v-if="showDestinationAccountsEmptyHint"
                    class="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950"
                  >
                    No hay cuentas de este cliente para la moneda de recepción
                    <template v-if="selectedAccountCurrencies.destination">
                      ({{ selectedAccountCurrencies.destination }})
                    </template>
                    . Crea una con el botón + junto a cuenta destino.
                  </p>
                </div>
                <div class="mt-5 border-t border-dashed border-[#d8e5fb] pt-5">
                  <label class="block text-sm font-medium text-[#374151]">
                    Etiquetas
                  </label>
                  <p class="mt-0.5 text-xs text-[#6b7280]">
                    Se marcan aquí, junto al cliente. El catálogo se administra en
                    Configuración &gt; Etiquetas.
                  </p>
                  <!--
                    El bloque se muestra siempre: si se ocultara cuando no hay
                    catálogo, un fallo del endpoint se vería igual que "esta
                    función no existe" y nadie sabría dónde reclamar.
                  -->
                  <p
                    v-if="tagsStore.error"
                    class="mt-2.5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]"
                  >
                    No se pudo cargar el catálogo de etiquetas: {{ tagsStore.error }}
                  </p>
                  <p
                    v-else-if="!availableTags.length"
                    class="mt-2.5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-xs text-[#6b7280]"
                  >
                    Todavía no hay etiquetas activas.
                    <RouterLink
                      to="/app/etiquetas"
                      class="font-medium text-brasper-indigoStrong underline"
                    >
                      Crear la primera en Configuración &gt; Etiquetas
                    </RouterLink>
                  </p>
                  <div v-else class="mt-2.5 flex flex-wrap gap-2">
                    <button
                      v-for="tag in availableTags"
                      :key="tag.id"
                      type="button"
                      class="rounded-full border px-3 py-1 text-[11px] font-semibold transition"
                      :class="
                        form.tag_ids.includes(tag.id)
                          ? ''
                          : 'border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#c7d2fe]'
                      "
                      :style="
                        form.tag_ids.includes(tag.id) ? tagChipStyle(tag.color) : undefined
                      "
                      :aria-pressed="form.tag_ids.includes(tag.id)"
                      @click="toggleFormTag(tag.id)"
                    >
                      {{ tag.label }}<span v-if="tag.counts_as_new_client"> ★</span>
                    </button>
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
                    <label class="flex items-center justify-between gap-2 text-sm font-medium text-[#374151]">
                      <span>Monto de envío</span>
                      <span
                        v-if="selectedAccountCurrencies.origin"
                        class="rounded-md bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-brasper-indigoStrong"
                      >
                        {{ selectedAccountCurrencies.origin }}
                      </span>
                    </label>
                    <input
                      v-model.number="form.origin_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      class="form-input w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2.5 text-sm"
                      @wheel="blockNumberInputWheel"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="flex items-center justify-between gap-2 text-sm font-medium text-[#374151]">
                      <span>Monto a recibir</span>
                      <span
                        v-if="selectedAccountCurrencies.destination"
                        class="rounded-md bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-brasper-indigoStrong"
                      >
                        {{ selectedAccountCurrencies.destination }}
                      </span>
                    </label>
                    <input
                      v-model.number="form.destination_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      class="form-input w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2.5 text-sm"
                      @wheel="blockNumberInputWheel"
                    />
                  </div>
                </div>
              </section>

              <section
                v-if="editingId"
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3
                      class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brasper-indigoStrong"
                    >
                      Fechas
                    </h3>
                    <p class="text-xs text-[#6b7280]">
                      Fecha y hora locales; al guardar se envían al API en ISO (UTC).
                    </p>
                  </div>
                </div>
                <div class="grid gap-5 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Fecha y hora envío</label
                    >
                    <AppDateInput v-model="form.send_date" with-time />
                    <p class="text-[11px] text-[#6b7280]">
                      Hora local; el servidor recibe instante en ISO (UTC).
                    </p>
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Fecha y hora pago</label
                    >
                    <AppDateInput v-model="form.payment_date" with-time />
                    <p class="text-[11px] text-[#6b7280]">
                      Opcional; al finalizar el backend puede fijarla en UTC.
                    </p>
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
                  El checklist y los importes/comprobantes determinan
                  <strong>verification</strong> → <strong>verified</strong> →
                  <strong>completed</strong> en el servidor (salvo
                  <strong>failed</strong>).
                </p>
              </section>
            </form>

            <form
              v-else-if="createStepIndex === 2"
              class="space-y-5"
              @submit.prevent="submitForm"
            >
              <p class="text-sm leading-relaxed text-[#6b7280]">
                Adjunta comprobantes (PDF o imagen). Son opcionales y se envían al
                guardar con el resto del alta.
              </p>

              <div
                v-if="formVoucherValues('send_voucher').length && formVoucherValues('payment_voucher').length"
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

              <div class="grid gap-5 md:grid-cols-3">
                <div
                  class="order-1 flex flex-col rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5 outline-none transition focus-within:border-brasper-indigoStrong/50 focus-within:ring-2 focus-within:ring-brasper-indigoStrong/10"
                  tabindex="0"
                  aria-label="Comprobante de envío: pega una imagen aquí"
                  @paste="onVoucherImagePaste('send_voucher', $event)"
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
                        Archivo de envío
                      </p>
                    </div>
                  </div>
                  <label
                    class="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#cfdbef] bg-[#fbfdff] px-4 py-2.5 text-sm font-semibold text-brasper-indigoStrong transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                  >
                    <input
                      type="file"
                      multiple
                      class="sr-only"
                      accept="image/*,.pdf,application/pdf"
                      @change="onVoucherFileSelect('send_voucher', $event)"
                    />
                    Agregar archivos
                  </label>
                  <p class="mt-2 text-xs text-[#6b7280]">
                    O pega una imagen aquí con Ctrl+V / Cmd+V
                  </p>
                  <TransactionVoucherFileList
                    :entries="voucherDisplayEntries('send_voucher')"
                    @remove="removeDisplayedVoucher('send_voucher', $event)"
                  />
                </div>

                <div
                  class="order-3 flex flex-col rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5 outline-none transition focus-within:border-brasper-indigoStrong/50 focus-within:ring-2 focus-within:ring-brasper-indigoStrong/10"
                  tabindex="0"
                  aria-label="Comprobante de pago: pega una imagen aquí"
                  @paste="onVoucherImagePaste('payment_voucher', $event)"
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
                        Archivo de pago
                      </p>
                    </div>
                  </div>
                  <label
                    class="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#cfdbef] bg-[#fbfdff] px-4 py-2.5 text-sm font-semibold text-brasper-indigoStrong transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                  >
                    <input
                      type="file"
                      multiple
                      class="sr-only"
                      accept="image/*,.pdf,application/pdf"
                      @change="onVoucherFileSelect('payment_voucher', $event)"
                    />
                    Agregar archivos
                  </label>
                  <p class="mt-2 text-xs text-[#6b7280]">
                    O pega una imagen aquí con Ctrl+V / Cmd+V
                  </p>
                  <TransactionVoucherFileList
                    :entries="voucherDisplayEntries('payment_voucher')"
                    @remove="removeDisplayedVoucher('payment_voucher', $event)"
                  />
                </div>

                <div
                  class="order-2 flex flex-col rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5 outline-none transition focus-within:border-brasper-indigoStrong/50 focus-within:ring-2 focus-within:ring-brasper-indigoStrong/10"
                  tabindex="0"
                  aria-label="Imagen de verificación: pega una imagen aquí"
                  @paste="onVoucherImagePaste('checked_image', $event)"
                >
                  <div class="mb-4 flex items-start gap-3">
                    <span
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
                      :class="
                        isCheckedImageVoucherPresent
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-50 text-amber-800'
                      "
                      :title="
                        isCheckedImageVoucherPresent
                          ? 'Imagen de verificación cargada'
                          : 'Pendiente de imagen de verificación'
                      "
                    >
                      <svg
                        v-if="isCheckedImageVoucherPresent"
                        class="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                        />
                      </svg>
                      <svg
                        v-else
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
                          d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </span>
                    <div class="min-w-0">
                      <h3 class="text-base font-semibold text-[#232b4d]">
                        Verificación
                      </h3>
                      <p class="mt-0.5 text-xs text-[#6b7280]">
                        Imagen de checklist
                      </p>
                    </div>
                  </div>
                  <label
                    class="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#cfdbef] bg-[#fbfdff] px-4 py-2.5 text-sm font-semibold text-brasper-indigoStrong transition hover:border-brasper-indigoStrong/40 hover:bg-white"
                  >
                    <input
                      type="file"
                      multiple
                      class="sr-only"
                      accept="image/*,.pdf,application/pdf"
                      @change="onVoucherFileSelect('checked_image', $event)"
                    />
                    Agregar archivos
                  </label>
                  <p class="mt-2 text-xs text-[#6b7280]">
                    O pega una imagen aquí con Ctrl+V / Cmd+V
                  </p>
                  <TransactionVoucherFileList
                    :entries="voucherDisplayEntries('checked_image')"
                    @remove="removeDisplayedVoucher('checked_image', $event)"
                  />
                </div>
              </div>

              <div class="space-y-1.5 rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5">
                <label class="block text-sm font-medium text-[#374151]">
                  Número de operación *
                </label>
                <input
                  v-model.trim="form.operation_number"
                  type="text"
                  required
                  class="w-full rounded-xl border border-[#dce3ef] bg-white px-3 py-2.5 text-sm text-[#374151] outline-none transition focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/15"
                  placeholder="Escribe el número de operación"
                  autocomplete="off"
                />
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
            v-if="!isEditingMode"
            class="flex flex-wrap items-center gap-3 border-t border-[#e5e7eb] px-6 py-4"
            :class="isEditingMode ? 'justify-end bg-white' : 'justify-between'"
          >
            <button
              type="button"
              class="rounded-xl border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
              @click="showCreateModal = false"
            >
              Cancelar
            </button>
            <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <button
                v-if="!isEditingMode && createStepIndex > 0"
                type="button"
                class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-brasper-indigoStrong hover:bg-[#f9fafb]"
                @click="goCreatePrev"
              >
                Atrás
              </button>
              <button
                v-if="!isEditingMode && !isLastCreateStep"
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
                    : editingId
                      ? "Guardar cambios"
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

    <UsuarioCreateFormModal
      v-model="showTransactionClientModal"
      :show-role-field="false"
      default-role="client"
      variant="quick"
      @created="onTransactionClientCreated"
    />
    <CuentaBancariaCreateFormModal
      v-model="showBankAccountCreateModal"
      :account-flow="bankAccountCreateFlow"
      :bank-country="transactionBankModalCountry"
      :holder-type="transactionBankModalHolder"
      :locked-user-id="form.user_id?.trim() || undefined"
      variant="transaction"
      @created="onTransactionBankAccountCreated"
    />
    <BancoCrudModal
      v-model="showBancoCrudModal"
      :hint-country="bancoCrudHintCountry"
      :start-on-create-form="bancoCrudOpenForCreate"
      @saved="onBancoCrudSaved"
    />

    <ConfirmDialog
      v-model="showDeleteTransactionConfirm"
      title="Eliminar transacción"
      :message="deleteTransactionMessage"
      confirm-text="Eliminar"
      :loading="deletingId !== null"
      @confirm="confirmDeleteTransaction"
    />

    <ConfirmDialog
      v-model="showNegativeDiscountConfirm"
      title="Descuento especial negativo"
      :message="negativeDiscountMessage"
      confirm-text="Sí, consignar"
      cancel-text="Revisar"
      variant="primary"
      @confirm="confirmNegativeSpecialDiscount"
      @cancel="cancelNegativeSpecialDiscount"
    />
  </div>
</template>
