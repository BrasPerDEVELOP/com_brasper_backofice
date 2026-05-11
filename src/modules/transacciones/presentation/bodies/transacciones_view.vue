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
  isTransactionChecked,
  roundMoneyAmount,
} from "../../domain/models";
import AppDropdown from "@/interface/components/AppDropdown.vue";
import AppDateInput from "@/interface/components/AppDateInput.vue";
import UsuarioCreateFormModal from "@/interface/components/UsuarioCreateFormModal.vue";
import CuentaBancariaCreateFormModal from "@/interface/components/CuentaBancariaCreateFormModal.vue";
import type { UserListItem } from "@modules/auth/infrastructure/adapters/users_management_api_adapter";
import CalculatorConversionCard from "@modules/calculator/presentation/components/CalculatorConversionCard.vue";
import { Domain } from "@/interface/infrastructure/services";
import { useTransactionPreviewController } from "../controllers/use_transaction_preview_controller";
import { fetchUsers } from "@modules/auth/infrastructure/adapters/users_management_api_adapter";

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
const showTransactionClientModal = ref(false);
const showBankAccountCreateModal = ref(false);
const bankAccountCreateFlow = ref<"origin" | "destination">("origin");
const TRANSACTION_BANK_MODAL_COUNTRY = "pe" as const;
const transactionBankModalHolder = ref<"natural" | "juridica">("natural");
const previewTransaction = ref<Transaction | null>(null);
const previewLoading = ref(false);
const editModalLoading = ref(false);
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
  agent_id: string;
  tax_rate_id: string;
  commission_id: string;
  status: string;
  checked: boolean;
  origin_amount: number;
  destination_amount: number;
  resultado_comision: number | null;
  total_a_enviar: number | null;
  tax_amount: number | null;
  code: string;
  operation_number: string;
  send_date: string;
  payment_date: string;
  send_voucher: string | File | null;
  payment_voucher: string | File | null;
  checked_image: string | File | null;
}>({
  bank_account_origin_id: "",
  bank_account_destination_id: "",
  user_id: "",
  agent_id: "",
  tax_rate_id: "",
  commission_id: "",
  status: "verification",
  checked: false,
  origin_amount: 0,
  destination_amount: 0,
  resultado_comision: null,
  total_a_enviar: null,
  tax_amount: null,
  code: "",
  operation_number: "",
  send_date: "",
  payment_date: "",
  send_voucher: null,
  payment_voucher: null,
  checked_image: null,
});

const editingId = ref<string | null>(null);
const editSourceTransaction = ref<Transaction | null>(null);
const isEditingMode = computed(() => Boolean(editingId.value));
const isHydratingTransactionForm = ref(false);

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
    transactionsStore.error = null;
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

function onTransactionBankAccountCreated(account: BankAccount) {
  if (bankAccountCreateFlow.value === "origin") {
    form.bank_account_origin_id = account.id;
  } else {
    form.bank_account_destination_id = account.id;
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

function normalizeCurrencyCode(value: unknown): string {
  return value == null ? "" : String(value).trim().toUpperCase();
}

function getBankAccountCurrency(a: BankAccount): string {
  const bank = cuentasStore.banks.find((b) => b.id === a.bank_id);
  return normalizeCurrencyCode(bank?.currency);
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
): { value: string; label: string }[] {
  const id = selectedId?.trim();
  if (!id) return options;
  if (options.some((o) => String(o.value) === id)) return options;
  const acc = cuentasStore.bankAccounts.find((a) => String(a.id) === id);
  if (!acc) return options;
  if (!bankAccountMatchesCurrency(acc, expectedCurrency)) return options;
  return [...options, bankAccountToOption(acc)];
}

function isBankAccountSelectable(
  id: string,
  flow: "origin" | "destination",
  expectedCurrency: string,
): boolean {
  const accountId = id?.trim();
  if (!accountId) return true;
  const userId = form.user_id?.trim();
  const account = cuentasStore.bankAccounts.find(
    (a) => String(a.id) === accountId,
  );
  if (!account) return false;
  if (!bankAccountMatchesSide(account, flow)) return false;
  if (userId && String(account.user_id ?? "").trim() !== userId) return false;
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

const originAccountOptions = computed(() => {
  const userId = form.user_id?.trim();
  const currency = selectedAccountCurrencies.value.origin;
  const base = cuentasStore.bankAccounts
    .filter((a) => bankAccountMatchesSide(a, "origin"))
    .filter((a) => bankAccountMatchesCurrency(a, currency))
    .filter(
      (a) => !userId || String(a.user_id ?? "").trim() === userId,
    )
    .map(bankAccountToOption);
  return mergeMissingSelectedAccount(
    base,
    form.bank_account_origin_id,
    currency,
  );
});

const destinationAccountOptions = computed(() => {
  const userId = form.user_id?.trim();
  const currency = selectedAccountCurrencies.value.destination;
  const base = cuentasStore.bankAccounts
    .filter((a) => bankAccountMatchesSide(a, "destination"))
    .filter((a) => bankAccountMatchesCurrency(a, currency))
    .filter(
      (a) => !userId || String(a.user_id ?? "").trim() === userId,
    )
    .map(bankAccountToOption);
  return mergeMissingSelectedAccount(
    base,
    form.bank_account_destination_id,
    currency,
  );
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
  /** Filtro por cuenta: solo en cliente (API usa origen/destino por separado). */
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
      const operationNumber = (t.operation_number ?? "").toLowerCase();
      return code.includes(q) || id.includes(q) || operationNumber.includes(q);
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
  form.agent_id = "";
  form.tax_rate_id = "";
  form.commission_id = "";
  form.status = "verification";
  form.checked = false;
  form.origin_amount = 0;
  form.destination_amount = 0;
  form.resultado_comision = null;
  form.total_a_enviar = null;
  form.tax_amount = null;
  form.code = "";
  form.operation_number = "";
  form.send_date = "";
  form.payment_date = "";
  form.send_voucher = null;
  form.payment_voucher = null;
  form.checked_image = null;
  editingId.value = null;
  editSourceTransaction.value = null;
  calculatorStore.resetCalculatorMode();
  calculatorStore.resetAmounts();
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

function syncCalculatorFromForm() {
  calculatorStore.resetCalculatorMode();
  const rate = calculatorStore.taxRates.find(
    (item) => item.id === form.tax_rate_id,
  );
  if (rate) {
    calculatorStore.setCurrencyFrom(rate.from);
    calculatorStore.setCurrencyTo(rate.to);
  }

  const originAmount = Number(form.origin_amount) || 0;
  const destinationAmount = Number(form.destination_amount) || 0;

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
  form.origin_amount = res?.amountSend ?? calculatorStore.amountSend ?? 0;
  form.destination_amount =
    res?.amountReceive ?? calculatorStore.amountReceive ?? 0;
  form.tax_rate_id = calculatorStore.selectedTaxRateId ?? "";
  form.commission_id = calculatorStore.selectedCommissionId ?? "";
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

function openCreateModal() {
  transactionsStore.error = null;
  resetForm();
  createStepIndex.value = 0;
  showCreateModal.value = true;
  loadFormOptions();
  void loadEditableUsers();
  calculatorStore.setDemoMode(false);
  void calculatorStore.loadData();
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
    form.tax_rate_id = row.tax_rate_id ?? "";
    form.commission_id = row.commission_id ?? "";
    form.status = (row.status ?? "verification").toLowerCase();
    form.checked =
      row.checked === true || (row.status ?? "").toLowerCase() === "checked";
    form.origin_amount = Number(row.origin_amount) || 0;
    form.destination_amount = Number(row.destination_amount) || 0;
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
    form.send_date = apiDateTimeToFormValue(row.send_date);
    form.payment_date = apiDateTimeToFormValue(row.payment_date);
    form.send_voucher = null;
    form.payment_voucher = null;
    form.checked_image = null;
    editSourceTransaction.value = row;
    await nextTick();
  } finally {
    isHydratingTransactionForm.value = false;
  }
}

async function openEditModal(t: Transaction) {
  if (!t.id) return;
  const transactionId = t.id;
  transactionsStore.error = null;
  resetForm();
  editingId.value = transactionId;
  createStepIndex.value = 0;
  showCreateModal.value = true;
  editModalLoading.value = true;
  try {
    await hydrateEditForm(t);
    editModalLoading.value = false;
    calculatorStore.setDemoMode(false);
    await calculatorStore.loadData();
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
          await hydrateEditForm({ ...t, ...fresh });
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

async function submitForm() {
  syncFromCalculatorIfSafe();
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
  if (!form.tax_rate_id || !form.commission_id) {
    transactionsStore.error =
      editingId.value
        ? "La transacción debe conservar tasa y comisión válidas para guardar"
        : "Tasa y comisión son obligatorios (usa la calculadora primero)";
    return;
  }
  try {
    const hasEditedFileUpload =
      Boolean(editingId.value) &&
      [form.send_voucher, form.payment_voucher, form.checked_image].some(
        (value) => value instanceof File,
      );
    const persistedSendVoucher = editSourceTransaction.value?.send_voucher;
    const persistedPaymentVoucher = editSourceTransaction.value?.payment_voucher;
    const persistedCheckedImage = editSourceTransaction.value?.checked_image;
    const sendVoucher =
      form.send_voucher instanceof File
        ? form.send_voucher
        : editingId.value
          ? hasEditedFileUpload
            ? persistedSendVoucher ?? undefined
            : undefined
          : form.send_voucher ?? undefined;
    const paymentVoucher =
      form.payment_voucher instanceof File
        ? form.payment_voucher
        : editingId.value
          ? hasEditedFileUpload
            ? persistedPaymentVoucher ?? undefined
            : undefined
          : form.payment_voucher ?? undefined;
    const checkedImage =
      form.checked_image instanceof File
        ? form.checked_image
        : editingId.value
          ? hasEditedFileUpload
            ? persistedCheckedImage ?? undefined
            : undefined
          : form.checked_image ?? undefined;

    const code =
      form.code?.trim() ||
      `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const operationNumber = form.operation_number.trim();
    const commonAmounts = {
      ...(form.bank_account_origin_id?.trim()
        ? { bank_account_origin: form.bank_account_origin_id.trim() }
        : {}),
      bank_account_destination: form.bank_account_destination_id,
      user_id: form.user_id,
      agent_id:
        form.agent_id?.trim() &&
        form.agent_id.trim() !== form.user_id?.trim()
          ? form.agent_id.trim()
          : undefined,
      tax_rate_id: form.tax_rate_id,
      commission_id: form.commission_id,
      origin_amount: roundMoneyAmount(form.origin_amount),
      destination_amount: roundMoneyAmount(form.destination_amount),
      resultado_comision:
        form.resultado_comision != null
          ? roundMoneyAmount(form.resultado_comision)
          : undefined,
      total_a_enviar:
        form.total_a_enviar != null
          ? roundMoneyAmount(form.total_a_enviar)
          : undefined,
      tax_amount:
        form.tax_amount != null && Number.isFinite(form.tax_amount)
          ? Number(form.tax_amount)
          : undefined,
      code,
      operation_number: operationNumber || undefined,
      status: form.status,
      send_voucher: sendVoucher,
      payment_voucher: paymentVoucher,
      checked_image: checkedImage,
      checked: form.checked,
    };
    if (editingId.value) {
      /** PUT: el backend recalcula `status` y asigna `payment_date` al pasar a finalizada. */
      await transactionsStore.updateTransaction(editingId.value, {
        ...commonAmounts,
        operation_number: operationNumber || null,
        send_date: formDateTimeToApi(form.send_date),
        payment_date: formDateTimeToApi(form.payment_date),
      });
    } else {
      /** POST: servidor fuerza `verification`, `checked: false` y `send_date` en el alta. */
      await transactionsStore.createTransaction({
        ...commonAmounts,
      });
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
    code: formatTransactionCodeShort(t.code),
    status: getStatusLabel(t.status),
    checked: isTransactionChecked(t) ? "Sí" : "No",
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
      label: "Cuenta destino",
      value: getBankCurrencyTableLabel(t.bank_account_destination_id),
    },
  ];
});

const editHeroConditions = computed(() => {
  const t = editPreviewTransaction.value;
  if (!t) return [];
  return [
    {
      label: "Tasa",
      value: getTaxRatePreviewLabel(t.tax_rate_id),
    },
    {
      label: "Comisión",
      value: getCommissionPreviewLabel(t.commission_id),
    },
  ];
});

const editHeroAmounts = computed(() => {
  const t = editPreviewTransaction.value;
  if (!t) return [];
  return [
    { label: "Monto origen", value: formatValue(t.origin_amount) },
    { label: "Monto destino", value: formatValue(t.destination_amount) },
    {
      label: "Resultado comisión",
      value: formatValue(t.resultado_comision ?? t.commission_result),
    },
  ];
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

function formatTransactionCodeShort(code: string | undefined): string {
  if (!code?.trim()) return "—";
  const digits = code.replace(/\D/g, "");
  if (digits.length > 0) return digits.slice(-4).padStart(4, "0");
  return code.trim().slice(-4);
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
  if (path == null || typeof path !== "string") return "";
  const s = path.trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/") || s.startsWith("media/") || s.includes("/")) {
    return Domain.mediaUrl(s);
  }
  // Los vouchers pueden venir solo con nombre de archivo; no deben caer en
  // `profile_images`, sino resolverse directamente bajo `/media/`.
  return Domain.mediaUrl(`media/${s}`);
}

function getStatusLabel(status: string | undefined): string {
  if (!status) return "-";
  const s = status.toLowerCase();
  return (
    TRANSACTION_STATUS_LABELS[s as keyof typeof TRANSACTION_STATUS_LABELS] ??
    status
  );
}

function statusRowBadgeClass(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
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
  const u =
    cuentasStore.transactionFormUsers.find((u) => u.id === id) ??
    cuentasStore.clientUsers.find((u) => u.id === id);
  return u?.name ?? id;
}

function getVoucherLabel(v: unknown): string {
  if (isFileValue(v)) {
    return v.name;
  }
  if (typeof v === "string" && v.trim()) {
    const clean = v.trim().split("?")[0]?.split("#")[0] ?? "";
    return clean.split("/").filter(Boolean).pop() ?? "Imagen actual";
  }
  return "Archivo seleccionado";
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

const sendVoucherPreviewSrc = ref<string | null>(null);
const paymentVoucherPreviewSrc = ref<string | null>(null);
const checkedImagePreviewSrc = ref<string | null>(null);

const persistedSendVoucherPreviewSrc = computed(() => {
  const v = editSourceTransaction.value?.send_voucher;
  return typeof v === "string" && v.trim() && isImagePath(v)
    ? voucherMediaHref(v.trim())
    : null;
});

const persistedPaymentVoucherPreviewSrc = computed(() => {
  const v = editSourceTransaction.value?.payment_voucher;
  return typeof v === "string" && v.trim() && isImagePath(v)
    ? voucherMediaHref(v.trim())
    : null;
});

const persistedCheckedImagePreviewSrc = computed(() => {
  const v = editSourceTransaction.value?.checked_image;
  return typeof v === "string" && v.trim() && isImagePath(v)
    ? voucherMediaHref(v.trim())
    : null;
});

const activeSendVoucherPreviewSrc = computed(
  () => sendVoucherPreviewSrc.value ?? persistedSendVoucherPreviewSrc.value,
);

const activePaymentVoucherPreviewSrc = computed(
  () => paymentVoucherPreviewSrc.value ?? persistedPaymentVoucherPreviewSrc.value,
);

const activeCheckedImagePreviewSrc = computed(
  () => checkedImagePreviewSrc.value ?? persistedCheckedImagePreviewSrc.value,
);

function nowLocalDateTimeValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function onVoucherFileSelect(
  field: "send_voucher" | "payment_voucher" | "checked_image",
  event: Event,
) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  form[field] = file;
  if (field === "payment_voucher" && file) {
    if (!form.payment_date?.trim()) {
      form.payment_date = nowLocalDateTimeValue();
    }
  }
  syncStatusFromVoucherFiles();
  input.value = "";
}

function hasVoucherValue(value: unknown): boolean {
  return value instanceof File || (typeof value === "string" && value.trim() !== "");
}

function syncStatusFromVoucherFiles() {
  const currentStatus = (form.status ?? "").toLowerCase();
  if (["failed", "cancelled"].includes(currentStatus)) return;

  const hasSendVoucher = hasVoucherValue(form.send_voucher ?? editSourceTransaction.value?.send_voucher);
  const hasCheckedImage = hasVoucherValue(form.checked_image ?? editSourceTransaction.value?.checked_image);
  const hasPaymentVoucher = hasVoucherValue(
    form.payment_voucher ?? editSourceTransaction.value?.payment_voucher,
  );

  form.checked = hasCheckedImage;
  if (hasSendVoucher && hasCheckedImage && hasPaymentVoucher) {
    form.status = "verified";
  }
}

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function updateVoucherPreview(target: Ref<string | null>, v: unknown) {
  revokeIfBlob(target.value);
  target.value = null;
  if (v instanceof File && isImageFile(v)) target.value = URL.createObjectURL(v);
  else if (typeof v === "string" && v.trim() && isImagePath(v))
    target.value = voucherMediaHref(v.trim());
}

watch(
  () => form.send_voucher,
  (v) => updateVoucherPreview(sendVoucherPreviewSrc, v),
);
watch(
  () => form.payment_voucher,
  (v) => updateVoucherPreview(paymentVoucherPreviewSrc, v),
);
watch(
  () => form.checked_image,
  (v) => updateVoucherPreview(checkedImagePreviewSrc, v),
);

onBeforeUnmount(() => {
  revokeIfBlob(sendVoucherPreviewSrc.value);
  revokeIfBlob(paymentVoucherPreviewSrc.value);
  revokeIfBlob(checkedImagePreviewSrc.value);
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
    if (isHydratingTransactionForm.value) return;
    form.bank_account_origin_id = "";
    form.bank_account_destination_id = "";
    form.agent_id = "";
  },
);

watch(
  [
    () => form.bank_account_origin_id,
    () => form.bank_account_destination_id,
    () => form.user_id,
    () => selectedAccountCurrencies.value.origin,
    () => selectedAccountCurrencies.value.destination,
    () => cuentasStore.bankAccounts.length,
    () => cuentasStore.banks.length,
  ],
  () => {
    if (isHydratingTransactionForm.value) return;
    if (cuentasStore.bankAccounts.length === 0 || cuentasStore.banks.length === 0)
      return;

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

    if (
      form.bank_account_destination_id &&
      !isBankAccountSelectable(
        form.bank_account_destination_id,
        "destination",
        selectedAccountCurrencies.value.destination,
      )
    ) {
      form.bank_account_destination_id = "";
    }
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
    cuentasStore.loadTransactionFormUsers(),
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
        class="w-full min-w-[1080px] text-left text-sm"
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
              Cuenta de origen
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
              colspan="13"
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
              {{ formatTransactionCodeShort(t.code) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-[#374151]">
              {{ t.operation_number || "—" }}
            </td>
            <td class="max-w-[160px] truncate px-4 py-3 text-[#374151]">
              {{ getClientLabel(t.user_id) }}
            </td>
            <td
              class="max-w-[180px] truncate px-4 py-3 text-[#374151]"
              :title="getBankCurrencyTableLabel(t.bank_account_origin_id)"
            >
              {{ getBankCurrencyTableLabel(t.bank_account_origin_id) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-center tabular-nums text-[#374151]">
              {{ formatValue(t.origin_amount) }}
            </td>
            <td
              class="max-w-[180px] truncate px-4 py-3 text-[#374151]"
              :title="getBankCurrencyTableLabel(t.bank_account_destination_id)"
            >
              {{ getBankCurrencyTableLabel(t.bank_account_destination_id) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-center tabular-nums text-[#374151]">
              {{ formatValue(t.destination_amount) }}
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="statusRowBadgeClass(t.status)"
              >
                {{ getStatusLabel(t.status) }}
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
                          class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          :class="statusRowBadgeClass(previewTransaction?.status)"
                        >
                          {{ item.value }}
                        </span>
                          <span
                            v-else-if="item.variant === 'mono'"
                            class="break-all text-xs text-[#374151]"
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
                          :href="voucherMediaHref(previewTransaction.send_voucher)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-xs font-medium text-brasper-indigoStrong hover:underline"
                        >
                          Abrir imagen
                        </a>
                      </div>
                      <a
                        :href="voucherMediaHref(previewTransaction.send_voucher)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block bg-[#f3f4f6]"
                      >
                        <img
                          :src="voucherMediaHref(previewTransaction.send_voucher)"
                          alt="Comprobante envío"
                          class="mx-auto max-h-56 w-full object-contain"
                          @error="
                            ($event.target as HTMLImageElement).classList.add(
                              'hidden',
                            )
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
                            voucherMediaHref(previewTransaction.payment_voucher)
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
                          voucherMediaHref(previewTransaction.payment_voucher)
                        "
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block bg-[#f3f4f6]"
                      >
                        <img
                          :src="
                            voucherMediaHref(previewTransaction.payment_voucher)
                          "
                          alt="Comprobante pago"
                          class="mx-auto max-h-56 w-full object-contain"
                          @error="
                            ($event.target as HTMLImageElement).classList.add(
                              'hidden',
                            )
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
                  class="grid min-h-0 w-full gap-5 bg-[#f6f8fc] p-5 xl:grid-cols-[420px_minmax(0,1fr)]"
                >
                  <div
                    class="hidden min-h-0 flex-col gap-4 text-[#1f2937] xl:flex"
                  >
                    <div class="grid grid-cols-3 gap-3 rounded-2xl border border-[#e6ebf4] bg-white p-4">
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
                    </div>

                     <div class="grid grid-cols-3 gap-3 rounded-2xl border border-[#e6ebf4] bg-white p-4">
                      
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
                        <div class="flex items-center gap-2">
                          <span class="h-2 w-2 rounded-full bg-emerald-300"></span>
                          <h3 class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#50607c]">
                            Importes globales
                          </h3>
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
                            <div class="space-y-1.5">
                              <label class="block text-sm font-medium text-[#374151]"
                                >Cuenta origen</label
                              >
                              <div class="flex gap-2">
                                <AppDropdown
                                  v-model="form.bank_account_origin_id"
                                  :options="originAccountOptions"
                                  placeholder="Cuenta de origen"
                                  :searchable="originAccountOptions.length > 5"
                                  class="min-w-0 flex-1"
                                />
                                <button
                                  type="button"
                                  class="flex shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-2.5 text-[#6b7280] transition hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#374151]"
                                  title="Nueva cuenta bancaria (origen)"
                                  @click="openBankAccountModalFromTransaction('origin')"
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
                                >Cuenta destino *</label
                              >
                              <div class="flex gap-2">
                                <AppDropdown
                                  v-model="form.bank_account_destination_id"
                                  :options="destinationAccountOptions"
                                  placeholder="Cuenta destino"
                                  :searchable="destinationAccountOptions.length > 5"
                                  class="min-w-0 flex-1"
                                />
                                <button
                                  type="button"
                                  class="flex shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-2.5 text-[#6b7280] transition hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#374151]"
                                  title="Nueva cuenta bancaria (destino)"
                                  @click="openBankAccountModalFromTransaction('destination')"
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
                              Adjunta o reemplaza comprobantes.
                            </p>
                          </div>
                          <div class="grid gap-4 md:grid-cols-3">
                            <div class="order-1 rounded-2xl border border-[#e8eef8] bg-white p-4">
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
                                  class="sr-only"
                                  @change="onVoucherFileSelect('send_voucher', $event)"
                                />
                                Seleccionar archivo
                              </label>
                              <img
                                v-if="activeSendVoucherPreviewSrc"
                                :src="activeSendVoucherPreviewSrc"
                                alt="Vista previa comprobante de envío"
                                class="mt-3 max-h-24 w-full rounded-lg border border-[#e5e7eb] object-contain"
                              />
                              <p
                                v-if="form.send_voucher || editSourceTransaction?.send_voucher"
                                class="mt-3 truncate text-xs font-medium text-[#374151]"
                                :title="
                                  getVoucherLabel(form.send_voucher ?? editSourceTransaction?.send_voucher)
                                "
                              >
                                {{
                                  getVoucherLabel(
                                    form.send_voucher ??
                                      editSourceTransaction?.send_voucher,
                                  )
                                }}
                              </p>
                            </div>

                            <div class="order-3 rounded-2xl border border-[#e8eef8] bg-white p-4">
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
                                  class="sr-only"
                                  @change="onVoucherFileSelect('payment_voucher', $event)"
                                />
                                Seleccionar archivo
                              </label>
                              <img
                                v-if="activePaymentVoucherPreviewSrc"
                                :src="activePaymentVoucherPreviewSrc"
                                alt="Vista previa comprobante de pago"
                                class="mt-3 max-h-24 w-full rounded-lg border border-[#e5e7eb] object-contain"
                              />
                              <p
                                v-if="form.payment_voucher || editSourceTransaction?.payment_voucher"
                                class="mt-3 truncate text-xs font-medium text-[#374151]"
                                :title="
                                  getVoucherLabel(form.payment_voucher ?? editSourceTransaction?.payment_voucher)
                                "
                              >
                                {{
                                  getVoucherLabel(
                                    form.payment_voucher ??
                                      editSourceTransaction?.payment_voucher,
                                  )
                                }}
                              </p>
                            </div>

                            <div class="order-2 rounded-2xl border border-[#e8eef8] bg-white p-4">
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
                                  class="sr-only"
                                  @change="onVoucherFileSelect('checked_image', $event)"
                                />
                                Seleccionar archivo
                              </label>
                              <img
                                v-if="activeCheckedImagePreviewSrc"
                                :src="activeCheckedImagePreviewSrc"
                                alt="Vista previa imagen de verificación"
                                class="mt-3 max-h-24 w-full rounded-lg border border-[#e5e7eb] object-contain"
                              />
                              <p
                                v-if="form.checked_image || editSourceTransaction?.checked_image"
                                class="mt-3 truncate text-xs font-medium text-[#374151]"
                                :title="
                                  getVoucherLabel(form.checked_image ?? editSourceTransaction?.checked_image)
                                "
                              >
                                {{
                                  getVoucherLabel(
                                    form.checked_image ??
                                      editSourceTransaction?.checked_image,
                                  )
                                }}
                              </p>
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
                Producción
              </p>
              <CalculatorConversionCard
                variant="production"
                :show-send-cta="false"
                :show-calculation-mode-toggle="true"
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
                  <div class="space-y-1.5">
                    <label class="block text-sm font-medium text-[#374151]"
                      >Cuenta origen</label
                    >
                    <div class="flex gap-2">
                      <AppDropdown
                        v-model="form.bank_account_origin_id"
                        :options="originAccountOptions"
                        placeholder="Cuenta de origen"
                        :searchable="originAccountOptions.length > 5"
                        class="min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-2.5 text-[#6b7280] transition hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#374151]"
                        title="Nueva cuenta bancaria (origen)"
                        @click="openBankAccountModalFromTransaction('origin')"
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
                      >Cuenta destino *</label
                    >
                    <div class="flex gap-2">
                      <AppDropdown
                        v-model="form.bank_account_destination_id"
                        :options="destinationAccountOptions"
                        placeholder="Cuenta de destino"
                        :searchable="destinationAccountOptions.length > 5"
                        class="min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-2.5 text-[#6b7280] transition hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#374151]"
                        title="Nueva cuenta bancaria (destino)"
                        @click="openBankAccountModalFromTransaction('destination')"
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
                      >Monto de envío</label
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
                      >Monto a recibir</label
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

              <div class="grid gap-5 md:grid-cols-3">
                <div
                  class="order-1 flex flex-col rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5"
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
                      class="sr-only"
                      accept="image/*,.pdf,application/pdf"
                      @change="onVoucherFileSelect('send_voucher', $event)"
                    />
                    Seleccionar archivo
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
                  class="order-3 flex flex-col rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5"
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
                      class="sr-only"
                      accept="image/*,.pdf,application/pdf"
                      @change="onVoucherFileSelect('payment_voucher', $event)"
                    />
                    Seleccionar archivo
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

                <div
                  class="order-2 flex flex-col rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5"
                >
                  <div class="mb-4 flex items-start gap-3">
                    <span
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800"
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
                      class="sr-only"
                      accept="image/*,.pdf,application/pdf"
                      @change="onVoucherFileSelect('checked_image', $event)"
                    />
                    Seleccionar archivo
                  </label>
                  <img
                    v-if="checkedImagePreviewSrc"
                    :src="checkedImagePreviewSrc"
                    alt="Vista previa imagen de verificación"
                    class="mt-4 max-h-44 w-full rounded-lg border border-[#e5e7eb] object-contain"
                  />
                  <p
                    v-if="form.checked_image"
                    class="mt-3 truncate text-xs font-medium text-[#374151]"
                    :title="getVoucherLabel(form.checked_image)"
                  >
                    {{ getVoucherLabel(form.checked_image) }}
                  </p>
                </div>
              </div>

              <div class="space-y-1.5 rounded-xl border border-[#d8e5fb] bg-white p-5 shadow-sm shadow-brasper-indigoStrong/5">
                <label class="block text-sm font-medium text-[#374151]">
                  Número de operación
                </label>
                <input
                  v-model.trim="form.operation_number"
                  type="text"
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
      @created="onTransactionClientCreated"
    />
    <CuentaBancariaCreateFormModal
      v-model="showBankAccountCreateModal"
      :account-flow="bankAccountCreateFlow"
      :bank-country="TRANSACTION_BANK_MODAL_COUNTRY"
      :holder-type="transactionBankModalHolder"
      :locked-user-id="form.user_id?.trim() || undefined"
      @created="onTransactionBankAccountCreated"
    />
  </div>
</template>
