<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useCuentasBancariasStore } from '../controllers/use_cuentas_bancarias_store_controller'
import type { BankAccount } from '../../domain/models'
import AppDropdown from '@/interface/components/AppDropdown.vue'
import CuentaBancariaCreateFormModal from '@/interface/components/CuentaBancariaCreateFormModal.vue'

const cuentasStore = useCuentasBancariasStore()
const showCreateModal = ref(false)
const searchQuery = ref('')
const openMenuId = ref<string | null>(null)

type HolderFilter = 'natural' | 'juridica'
const holderFilter = ref<HolderFilter>('natural')

const countryFilter = ref<'pe' | 'br'>('pe')
const accountFlowFilter = ref<'origin' | 'destination'>('destination')

const ALL_USERS = '__all__'
const selectedUserId = ref<string>(ALL_USERS)

const perPage = ref(10)
const currentPage = ref(1)

const countryOptions = [
  { value: 'pe', label: 'PE' },
  { value: 'br', label: 'BR' }
]
const accountFlowOptions = [
  { value: 'destination', label: 'Cuenta Destino' },
  { value: 'origin', label: 'Cuenta Origen' }
]
const clientFilterOptions = computed(() => [
  { value: ALL_USERS, label: 'Todos' },
  ...cuentasStore.clientUsers.map((u) => ({ value: u.id, label: u.name }))
])
const perPageOptions = [
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' }
]
const perPageStr = computed({
  get: () => String(perPage.value),
  set: (v) => {
    perPage.value = Number(v) || 10
  }
})
function openCreateModal() {
  cuentasStore.error = null
  showCreateModal.value = true
}

function formatValue(value: string | null | undefined): string {
  return value ?? '-'
}

/** Celda Banco: nombre + moneda del catálogo; `razonSocial` = empresa/titular del banco. */
function getBankTableCell(bankId: string): { title: string; razonSocial: string } {
  const bank = cuentasStore.banks.find((b) => b.id === bankId)
  if (!bank) return { title: formatValue(bankId), razonSocial: '' }
  const cur = bank.currency ? ` (${bank.currency})` : ''
  return {
    title: `${bank.bank}${cur}`,
    razonSocial: (bank.company ?? '').toString().trim()
  }
}

function getAccountName(account: BankAccount): string {
  if (account.account_holder_type?.toLowerCase().includes('juridica') || account.account_holder_type?.toLowerCase().includes('legal')) {
    return formatValue(account.business_name)
  }
  const names = [account.holder_names, account.holder_surnames].filter(Boolean).join(' ')
  return names || '-'
}

function getDocumentType(account: BankAccount): string {
  const t = (account.account_holder_type ?? '').toLowerCase()
  if (t.includes('juridica') || t.includes('legal')) return 'ruc'
  return 'dni'
}

function getDocumentNumber(account: BankAccount): string {
  const t = (account.account_holder_type ?? '').toLowerCase()
  if (t.includes('juridica') || t.includes('legal')) return formatValue(account.ruc_number)
  return formatValue(account.document_number)
}

function getAccountCurrency(account: BankAccount): string {
  const bank = cuentasStore.banks.find((b) => b.id === account.bank_id)
  return bank?.currency ? bank.currency.toUpperCase() : '-'
}

function isNaturalPerson(account: BankAccount): boolean {
  const t = (account.account_holder_type ?? '').toLowerCase()
  return t.includes('natural') || t === 'persona_natural' || t === 'natural_person'
}

function isJuridicaPerson(account: BankAccount): boolean {
  const t = (account.account_holder_type ?? '').toLowerCase()
  return (
    t.includes('juridica') ||
    t.includes('jurídica') ||
    t.includes('legal') ||
    t === 'persona_juridica' ||
    t === 'legal_entity'
  )
}

const debouncedSearch = ref('')
let searchDebounceId: ReturnType<typeof setTimeout>
watch(searchQuery, (q) => {
  clearTimeout(searchDebounceId)
  searchDebounceId = setTimeout(() => {
    debouncedSearch.value = q
  }, 150)
}, { immediate: true })

const filteredAccounts = computed(() => {
  let list = cuentasStore.bankAccounts
  if (selectedUserId.value !== ALL_USERS && selectedUserId.value) {
    list = list.filter((a) => (a.user_id ?? '') === selectedUserId.value)
  }
  const country = countryFilter.value
  const flow = accountFlowFilter.value
  const isNatural = holderFilter.value === 'natural'
  return list.filter((a) => {
    if ((a.bank_country ?? '').toLowerCase() !== country) return false
    if ((a.account_flow ?? '').toLowerCase() !== flow) return false
    return isNatural ? isNaturalPerson(a) : isJuridicaPerson(a)
  })
})

const searchedAccounts = computed(() => {
  const q = debouncedSearch.value.trim().toLowerCase()
  if (!q) return filteredAccounts.value
  return filteredAccounts.value.filter((a) => {
    const name = getAccountName(a).toLowerCase()
    const doc = getDocumentNumber(a).toLowerCase()
    const accountNum = formatValue(a.account_number).toLowerCase()
    const { title, razonSocial } = getBankTableCell(a.bank_id)
    const bank = `${title} ${razonSocial}`.toLowerCase()
    return name.includes(q) || doc.includes(q) || accountNum.includes(q) || bank.includes(q)
  })
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(searchedAccounts.value.length / perPage.value))
)

const paginatedAccounts = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return searchedAccounts.value.slice(start, start + perPage.value)
})

function toggleMenu(id: string) {
  if (openMenuId.value === id) {
    openMenuId.value = null
    return
  }
  openMenuId.value = id
  nextTick(() => {
    const close = () => {
      openMenuId.value = null
      document.removeEventListener('click', close)
    }
    setTimeout(() => document.addEventListener('click', close), 0)
  })
}

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

watch([searchQuery, holderFilter, perPage, countryFilter, accountFlowFilter, selectedUserId], () => {
  currentPage.value = 1
})

function loadAccounts() {
  const params = {
    userId: selectedUserId.value === ALL_USERS ? undefined : selectedUserId.value,
    bank_country: countryFilter.value,
    account_flow: accountFlowFilter.value
  }
  cuentasStore.loadBankAccounts(params)
}

watch([countryFilter, accountFlowFilter, selectedUserId], loadAccounts, { immediate: true })

onMounted(() => {
  Promise.all([cuentasStore.loadClientUsers(), cuentasStore.loadBanks()])
})
</script>

<template>
  <!-- Header -->
  <div class="mb-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-2xl font-medium text-[#1f2937]">Cuentas Bancarias</h1>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-[#e5e7eb] bg-white p-2 text-[#6b7280] hover:bg-[#f9fafb]"
            title="Vista tabla"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            class="rounded-lg border border-[#e5e7eb] bg-white p-2 text-[#6b7280] hover:bg-[#f9fafb]"
            title="Vista cuadrícula"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-50 disabled:cursor-not-allowed"
            @click.stop="openCreateModal"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Crear
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4 text-sm">
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Cuentas</label>
          <AppDropdown
            v-model="countryFilter"
            :options="countryOptions"
            placeholder="PE"
            :searchable="false"
            size="sm"
            min-width="72px"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Tipo de cuenta</label>
          <AppDropdown
            v-model="accountFlowFilter"
            :options="accountFlowOptions"
            placeholder="Cuenta Destino"
            :searchable="false"
            size="sm"
            min-width="110px"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Cliente</label>
          <AppDropdown
            v-model="selectedUserId"
            :options="clientFilterOptions"
            placeholder="Todos"
            :searchable="clientFilterOptions.length > 10"
            size="sm"
            min-width="200px"
            @update:model-value="loadAccounts"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Total</label>
          <input
            type="text"
            :value="searchedAccounts.length"
            readonly
            class="w-14 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-2 py-1.5 text-center text-xs text-[#374151]"
          />
        </div>
      </div>
    </div>

    <!-- Search + Persona filters -->
    <div class="mb-6 flex flex-wrap items-center gap-4">
      <div class="relative w-40">
        <svg
          class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar"
          class="w-full rounded-lg border border-[#e5e7eb] bg-white py-2.5 pl-10 pr-4 text-sm text-[#374151] placeholder-[#9ca3af] focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
        />
      </div>
      <div
        class="inline-flex gap-2 rounded-lg bg-[#f1f5f9] p-0.5"
        role="group"
        aria-label="Tipo de titular"
      >
        <button
          type="button"
          :class="[
            'relative rounded-md px-4 py-2 text-sm font-medium transition-all duration-200',
            holderFilter === 'natural'
              ? 'bg-brasper-indigoStrong text-white shadow-sm'
              : 'bg-white text-[#64748b] shadow-sm hover:text-[#475569] active:scale-[0.98]'
          ]"
          @click="holderFilter = 'natural'"
        >
          Persona natural
        </button>
        <button
          type="button"
          :class="[
            'relative rounded-md px-4 py-2 text-sm font-medium transition-all duration-200',
            holderFilter === 'juridica'
              ? 'bg-brasper-indigoStrong text-white shadow-sm'
              : 'bg-white text-[#64748b] shadow-sm hover:text-[#475569] active:scale-[0.98]'
          ]"
          @click="holderFilter = 'juridica'"
        >
          Persona jurídica
        </button>
      </div>
    </div>

    <!-- Content: tabla siempre visible, solo cambia el contenido -->
    <p
      v-if="cuentasStore.error"
      class="mb-4 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]"
    >
      {{ cuentasStore.error }}
    </p>

    <div class="relative overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
      <div
        v-if="cuentasStore.isLoading"
        class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80"
      >
        <span class="text-sm text-[#6b7280]">Cargando...</span>
      </div>
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="bg-[#dbeafe]">
            <th class="min-w-[10rem] px-4 py-3 font-semibold text-brasper-indigoDark">Banco</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">Moneda</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">
              {{ holderFilter === 'juridica' ? 'Razón social' : 'Nombres' }}
            </th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">tipo documento</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">N. documento</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark">N. cuenta</th>
            <th class="w-12 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="account in paginatedAccounts"
            :key="account.id"
            class="border-t border-[#e5e7eb] bg-white transition hover:bg-[#f9fafb]"
          >
              <td class="px-4 py-3 text-[#374151]">
                <template v-for="(cell, cellIdx) in [getBankTableCell(account.bank_id)]" :key="cellIdx">
                  <p class="font-medium">{{ cell.title }}</p>
                  <p
                    v-if="cell.razonSocial"
                    class="mt-0.5 text-xs leading-snug text-[#6b7280]"
                  >
                    {{ cell.razonSocial }}
                  </p>
                </template>
              </td>
              <td class="px-4 py-3 text-[#374151]">{{ getAccountCurrency(account) }}</td>
              <td class="px-4 py-3 text-[#374151]">{{ getAccountName(account) }}</td>
              <td class="px-4 py-3 text-[#374151]">{{ getDocumentType(account) }}</td>
              <td class="px-4 py-3 text-[#374151]">{{ getDocumentNumber(account) }}</td>
              <td class="px-4 py-3 text-[#374151]">{{ formatValue(account.account_number) }}</td>
              <td class="relative px-2 py-3">
                <button
                  type="button"
                  class="rounded p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
                  @click.stop="toggleMenu(account.id)"
                >
                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </button>
                <div
                  v-if="openMenuId === account.id"
                  class="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg"
                  @click.stop
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Editar unidad
                  </button>
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Ver ficha
                  </button>
                </div>
              </td>
            </tr>
          <tr v-if="!cuentasStore.isLoading && paginatedAccounts.length === 0">
            <td
              colspan="7"
              class="px-4 py-12 text-center text-[#6b7280]"
            >
              {{
                cuentasStore.bankAccounts.length === 0
                  ? 'No hay cuentas bancarias registradas.'
                  : 'No hay cuentas que coincidan con el filtro o búsqueda.'
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination: siempre visible para mantener el diseño -->
    <div
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
          <span>{{ searchedAccounts.length }} resultados</span>
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

  <CuentaBancariaCreateFormModal
    v-model="showCreateModal"
    :account-flow="accountFlowFilter"
    :bank-country="countryFilter"
    :holder-type="holderFilter"
    :locked-user-id="selectedUserId === ALL_USERS ? undefined : selectedUserId"
    @created="loadAccounts"
  />
</template>

<style scoped>
.select-dropdown {
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1rem;
}
</style>
