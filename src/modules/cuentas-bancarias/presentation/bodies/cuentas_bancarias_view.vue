<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch, nextTick } from 'vue'
import { useCuentasBancariasStore } from '../controllers/use_cuentas_bancarias_store_controller'
import type { BankAccount } from '../../domain/models'

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

const form = reactive({
  user_id: '' as string,
  bank_id: '',
  holder_names: '',
  holder_surnames: '',
  document_number: '',
  business_name: '',
  ruc_number: '',
  legal_representative_name: '',
  legal_representative_document: '',
  account_number: '',
  account_number_confirmation: '',
  cci_number: '',
  cci_number_confirmation: '',
  pix_key: '',
  pix_key_confirmation: '',
  pix_key_type: '',
  cpf: ''
})

function resetForm() {
  form.user_id = ''
  form.bank_id = ''
  form.holder_names = ''
  form.holder_surnames = ''
  form.document_number = ''
  form.business_name = ''
  form.ruc_number = ''
  form.legal_representative_name = ''
  form.legal_representative_document = ''
  form.account_number = ''
  form.account_number_confirmation = ''
  form.cci_number = ''
  form.cci_number_confirmation = ''
  form.pix_key = ''
  form.pix_key_confirmation = ''
  form.pix_key_type = ''
  form.cpf = ''
}

function mapHolderTypeToApi(value: string): 'naturalPerson' | 'legalEntity' | 'generalAspect' {
  if (value === 'persona_juridica') return 'legalEntity'
  if (value === 'persona_natural') return 'naturalPerson'
  return 'naturalPerson'
}

function toIntOrNull(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const n = Number(value.replace(/\D/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Bloquea teclas no numéricas (excepto backspace, delete, tab, arrows) */
function onNumericKeydown(e: KeyboardEvent) {
  const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (allowed.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) {
    if (['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return
  }
  if (!/^\d$/.test(e.key)) e.preventDefault()
}

/** Solo dígitos 0-9 */
function onNumericInput(
  e: Event,
  key: 'document_number' | 'ruc_number' | 'legal_representative_document' | 'account_number' | 'account_number_confirmation' | 'cci_number' | 'cci_number_confirmation' | 'cpf'
) {
  const target = e.target as HTMLInputElement
  const cleaned = target.value.replace(/\D/g, '')
  form[key] = cleaned
  target.value = cleaned
}

/** Solo letras, números, espacios y caracteres comunes (nombres, razón social, PIX) */
function onStringInput(
  e: Event,
  key: 'holder_names' | 'holder_surnames' | 'business_name' | 'legal_representative_name' | 'pix_key' | 'pix_key_confirmation' | 'pix_key_type'
) {
  const target = e.target as HTMLInputElement
  const cleaned = target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.@]/g, '')
  form[key] = cleaned
  target.value = cleaned
}

async function submitCreate() {
  const userId = selectedUserId.value === ALL_USERS ? form.user_id : selectedUserId.value
  if (!userId) {
    cuentasStore.error = selectedUserId.value === ALL_USERS ? 'Seleccione un cliente' : 'Seleccione un cliente'
    return
  }
  try {
    const payload: Parameters<typeof cuentasStore.createBankAccount>[0] = {
      bank_id: form.bank_id,
      account_flow: accountFlowFilter.value,
      account_holder_type: mapHolderTypeToApi(holderFilter.value === 'natural' ? 'persona_natural' : 'persona_juridica'),
      bank_country: countryFilter.value,
      holder_names: form.holder_names || null,
      holder_surnames: form.holder_surnames || null,
      document_number: toIntOrNull(form.document_number),
      business_name: form.business_name || null,
      ruc_number: toIntOrNull(form.ruc_number),
      legal_representative_name: form.legal_representative_name || null,
      legal_representative_document: toIntOrNull(form.legal_representative_document),
      account_number: toIntOrNull(form.account_number),
      account_number_confirmation: toIntOrNull(form.account_number_confirmation),
      cci_number: toIntOrNull(form.cci_number),
      cci_number_confirmation: toIntOrNull(form.cci_number_confirmation),
      pix_key: form.pix_key || null,
      pix_key_confirmation: form.pix_key_confirmation || null,
      pix_key_type: form.pix_key_type || null,
      cpf: toIntOrNull(form.cpf)
    }
    payload.user_id = userId
    await cuentasStore.createBankAccount(payload)
    showCreateModal.value = false
    resetForm()
  } catch {
    // Error ya mostrado en store
  }
}

function openCreateModal() {
  cuentasStore.error = null
  resetForm()
  showCreateModal.value = true
  cuentasStore.loadBanks()
  cuentasStore.loadClientUsers()
}

function formatValue(value: string | null | undefined): string {
  return value ?? '-'
}

function getBankName(bankId: string): string {
  const bank = cuentasStore.banks.find((b) => b.id === bankId)
  return bank ? `${bank.bank}${bank.currency ? ` (${bank.currency})` : ''}` : formatValue(bankId)
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
    const bank = getBankName(a.bank_id).toLowerCase()
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
            class="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed"
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
          <select
            v-model="countryFilter"
            class="select-dropdown min-w-[72px] cursor-pointer appearance-none rounded-lg border border-[#e5e7eb] bg-white bg-[length:0.75rem] bg-[right_0.5rem_center] bg-no-repeat py-1.5 pl-2.5 pr-7 text-xs text-[#374151] focus:border-[#9ca3af] focus:outline-none"
          >
            <option value="pe">PE</option>
            <option value="br">BR</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Tipo de cuenta</label>
          <select
            v-model="accountFlowFilter"
            class="select-dropdown min-w-[110px] cursor-pointer appearance-none rounded-lg border border-[#e5e7eb] bg-white bg-[length:0.75rem] bg-[right_0.5rem_center] bg-no-repeat py-1.5 pl-2.5 pr-7 text-xs text-[#374151] focus:border-[#9ca3af] focus:outline-none"
          >
            <option value="destination">Cuenta Destino</option>
            <option value="origin">Cuenta Origen</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Cliente</label>
          <select
            v-model="selectedUserId"
            class="select-dropdown min-w-[200px] cursor-pointer appearance-none rounded-lg border border-[#e5e7eb] bg-white bg-[length:0.75rem] bg-[right_0.5rem_center] bg-no-repeat py-1.5 pl-2.5 pr-7 text-xs text-[#374151] focus:border-[#9ca3af] focus:outline-none"
            @change="loadAccounts"
          >
            <option :value="ALL_USERS">Todos</option>
            <option
              v-for="u in cuentasStore.clientUsers"
              :key="u.id"
              :value="u.id"
            >
              {{ u.name }}
            </option>
          </select>
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
          class="w-full rounded-lg border border-[#e5e7eb] bg-white py-2.5 pl-10 pr-4 text-sm text-[#374151] placeholder-[#9ca3af] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
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
              ? 'bg-[#2563eb] text-white shadow-sm'
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
              ? 'bg-[#2563eb] text-white shadow-sm'
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
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Banco</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Moneda</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">
              {{ holderFilter === 'juridica' ? 'Razón social' : 'Nombres' }}
            </th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">tipo documento</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">N. documento</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">N. cuenta</th>
            <th class="w-12 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="account in paginatedAccounts"
            :key="account.id"
            class="border-t border-[#e5e7eb] bg-white transition hover:bg-[#f9fafb]"
          >
              <td class="px-4 py-3 text-[#374151]">{{ getBankName(account.bank_id) }}</td>
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
          <select
            v-model="perPage"
            class="select-dropdown min-w-[3rem] cursor-pointer appearance-none rounded-lg border border-[#e5e7eb] bg-white bg-[length:0.65rem] bg-[right_0.35rem_center] bg-no-repeat py-1.5 px-2 pr-6 text-xs text-[#374151] focus:border-[#9ca3af] focus:outline-none"
          >
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
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

  <!-- Modal Crear -->
  <Teleport to="body">
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
        <h2 class="mb-6 text-lg font-semibold text-[#1f2937]">Nueva cuenta bancaria</h2>

        <form class="space-y-6" @submit.prevent="submitCreate">
          <div class="rounded-lg bg-[#f0f9ff] px-4 py-3 text-sm text-[#0369a1]">
            {{ holderFilter === 'natural' ? 'Persona natural' : 'Persona jurídica' }} · {{ countryFilter.toUpperCase() }} · {{ accountFlowFilter === 'destination' ? 'Destino' : 'Origen' }}
          </div>

          <!-- Sección: Banco y Cliente -->
          <div class="space-y-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Banco y asignación</h3>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Banco</label>
                <select
                  v-model="form.bank_id"
                  class="form-input select-dropdown w-full cursor-pointer appearance-none rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 pr-8 text-sm text-[#374151] transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  required
                >
                  <option value="">
                    {{ cuentasStore.banks.length === 0 ? 'Cargando...' : 'Seleccionar banco' }}
                  </option>
                  <option v-for="b in cuentasStore.banks" :key="b.id" :value="b.id">
                    {{ b.bank }}{{ b.currency ? ` (${b.currency})` : '' }}
                  </option>
                </select>
              </div>
              <div v-if="selectedUserId === ALL_USERS">
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Cliente</label>
                <select
                  v-model="form.user_id"
                  class="form-input select-dropdown w-full cursor-pointer appearance-none rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 pr-8 text-sm text-[#374151] transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  required
                >
                  <option value="">
                    {{ cuentasStore.clientUsers.length === 0 ? 'Cargando...' : 'Seleccionar cliente' }}
                  </option>
                  <option v-for="u in cuentasStore.clientUsers" :key="u.id" :value="u.id">
                    {{ u.name }}
                  </option>
                </select>
              </div>
              <p v-else-if="selectedUserId" class="flex items-center text-sm text-[#6b7280]">
                Cliente: <span class="ml-1 font-medium text-[#374151]">{{ cuentasStore.clientUsers.find(u => u.id === selectedUserId)?.name ?? selectedUserId }}</span>
              </p>
            </div>
          </div>

          <!-- Sección: Datos del titular -->
          <div class="space-y-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Datos del titular</h3>
            <div v-if="holderFilter === 'natural'" class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Nombres</label>
                <input
                  :value="form.holder_names"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  placeholder="Ej. Juan Carlos"
                  inputmode="text"
                  @input="onStringInput($event, 'holder_names')"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Apellidos</label>
                <input
                  :value="form.holder_surnames"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  placeholder="Ej. Pérez García"
                  inputmode="text"
                  @input="onStringInput($event, 'holder_surnames')"
                />
              </div>
              <div class="sm:col-span-2">
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Número de documento (DNI)</label>
                <input
                  :value="form.document_number"
                  type="text"
                  class="form-input w-full max-w-xs rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  placeholder="Ej. 12345678"
                  inputmode="numeric"
                  maxlength="15"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'document_number')"
                />
              </div>
            </div>
            <div v-if="holderFilter === 'juridica'" class="grid gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Razón social</label>
                <input
                  :value="form.business_name"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  placeholder="Nombre de la empresa"
                  inputmode="text"
                  @input="onStringInput($event, 'business_name')"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Número RUC</label>
                <input
                  :value="form.ruc_number"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  placeholder="11 dígitos"
                  inputmode="numeric"
                  maxlength="11"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'ruc_number')"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Nombre rep. legal</label>
                <input
                  :value="form.legal_representative_name"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  inputmode="text"
                  @input="onStringInput($event, 'legal_representative_name')"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Doc. rep. legal</label>
                <input
                  :value="form.legal_representative_document"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  inputmode="numeric"
                  maxlength="15"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'legal_representative_document')"
                />
              </div>
            </div>
          </div>

          <!-- Sección: Datos de la cuenta -->
          <div class="space-y-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Datos de la cuenta</h3>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Número de cuenta</label>
                <input
                  :value="form.account_number"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  inputmode="numeric"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'account_number')"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Confirmar número de cuenta</label>
                <input
                  :value="form.account_number_confirmation"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  inputmode="numeric"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'account_number_confirmation')"
                />
              </div>
            </div>
          </div>

          <!-- Sección: Códigos interbancarios -->
          <div class="space-y-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Códigos interbancarios</h3>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Número CCI</label>
                <input
                  :value="form.cci_number"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  placeholder="Código de cuenta interbancario (PE)"
                  inputmode="numeric"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'cci_number')"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-[#374151]">Clave PIX</label>
                <input
                  :value="form.pix_key"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  placeholder="Clave PIX (BR) - email, teléfono o aleatorio"
                  inputmode="text"
                  @input="onStringInput($event, 'pix_key')"
                />
              </div>
            </div>
          </div>

          <p
            v-if="cuentasStore.error"
            class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]"
          >
            {{ cuentasStore.error }}
          </p>

          <div class="flex flex-wrap justify-end gap-3 border-t border-[#e5e7eb] pt-6">
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
              @click="showCreateModal = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60"
              :disabled="cuentasStore.isCreating"
            >
              {{ cuentasStore.isCreating ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.select-dropdown {
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1rem;
}
</style>
