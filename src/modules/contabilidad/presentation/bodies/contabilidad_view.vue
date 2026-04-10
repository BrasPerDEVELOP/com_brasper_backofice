<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useTransactionsStore } from "@modules/transacciones/presentation/controllers/use_transactions_store_controller";
import { useCuentasBancariasStore } from "@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller";
import type { BankAccount } from "@modules/cuentas-bancarias/domain/models";
import type { Transaction } from "@modules/transacciones/domain/models";
import type { GetTransactionsParams } from "@modules/transacciones/infrastructure/adapters/transactions_repository";
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
} from "@modules/transacciones/domain/models";
import AppDropdown from "@/interface/components/AppDropdown.vue";
import AppDateInput from "@/interface/components/AppDateInput.vue";

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
  const accNum = a.account_number ?? "-";
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

  if (statusFilter.value && statusFilter.value !== "todos") {
    list = list.filter(
      (t) =>
        (t.status ?? "").toLowerCase() === statusFilter.value.toLowerCase(),
    );
  }

  if (userFilter.value?.trim()) {
    list = list.filter((t) => (t.user_id ?? "") === userFilter.value.trim());
  }

  if (bankAccountFilter.value?.trim()) {
    const accountId = bankAccountFilter.value.trim();
    list = list.filter(
      (t) =>
        (t.bank_account_origin_id ?? t.bank_account_id ?? "") === accountId ||
        (t.bank_account_destination_id ?? "") === accountId,
    );
  }

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

function isChecked(t: Transaction): boolean {
  return t.checked === true || (t.status ?? "").toLowerCase() === "checked";
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

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value));
}

function loadTransactions() {
  transactionsStore.loadTransactions(apiFilterParams.value);
}

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
          </tr>
        </thead>
        <tbody>
          <tr
            v-if="paginatedTransactions.length === 0"
            class="border-t border-[#e5e7eb]"
          >
            <td
              colspan="9"
              class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-6 py-12 text-center text-[#666]"
            >
              No hay movimientos para mostrar.
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
          </tr>
        </tbody>
      </table>
    </div>

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
  </div>
</template>
