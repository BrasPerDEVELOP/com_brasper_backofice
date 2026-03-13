<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch, nextTick } from 'vue'
import { useTransactionsStore } from '../controllers/use_transactions_store_controller'
import { useCuentasBancariasStore } from '@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller'
import { useTasasStore } from '@modules/tasas/presentation/controllers/use_tasas_store_controller'
import { useComisionesStore } from '@modules/comisiones/presentation/controllers/use_comisiones_store_controller'
import { useCalculatorStore } from '@modules/calculator/presentation/controllers/use_calculator_store_controller'
import type { BankAccount } from '@modules/cuentas-bancarias/domain/models'
import type { Transaction } from '../../domain/models'
import type { GetTransactionsParams } from '../../infrastructure/adapters/transactions_repository'
import { parseSimpleImportExcel } from '../../infrastructure/utils/excel_simple_import'
import { TRANSACTION_STATUSES, TRANSACTION_STATUS_LABELS } from '../../domain/models'
import AppDropdown from '@/interface/components/AppDropdown.vue'
import AppDateInput from '@/interface/components/AppDateInput.vue'
import CalculatorEmbed from '@modules/calculator/presentation/components/CalculatorEmbed.vue'
import { Domain } from '@/interface/infrastructure/services'

const transactionsStore = useTransactionsStore()
const cuentasStore = useCuentasBancariasStore()
const tasasStore = useTasasStore()
const comisionesStore = useComisionesStore()
const calculatorStore = useCalculatorStore()

const showCreateModal = ref(false)
const showImportModal = ref(false)
const showImportSimpleModal = ref(false)
const importSimpleFile = ref<File | null>(null)
const fileInputSimple = ref<HTMLInputElement | null>(null)
const importingSimple = ref(false)
const importSimpleError = ref('')
const showPreviewModal = ref(false)
const previewTransaction = ref<Transaction | null>(null)
const previewLoading = ref(false)
const previewError = ref<string | null>(null)
const searchQuery = ref('')
const openMenuId = ref<string | null>(null)
const menuTriggerEl = ref<HTMLElement | null>(null)
const menuPosition = reactive({ top: 0, left: 0 })
const statusFilter = ref<string>('todos')
const userFilter = ref<string>('')
const bankAccountFilter = ref<string>('')
const createdAtFrom = ref<string>('')
const createdAtTo = ref<string>('')
const perPage = ref(10)
const currentPage = ref(1)
const fileInput = ref<HTMLInputElement | null>(null)
const importFile = ref<File | null>(null)
const deletingId = ref<string | null>(null)

const statusOptions = computed(() => [
  { value: 'todos', label: 'Todos' },
  ...TRANSACTION_STATUSES.map((s) => ({ value: s, label: TRANSACTION_STATUS_LABELS[s] }))
])

const ALL_VALUE = ''
const userFilterOptions = computed(() => [
  { value: ALL_VALUE, label: 'Todos' },
  ...cuentasStore.clientUsers.map((u) => ({ value: u.id, label: u.name }))
])

const bankAccountFilterOptions = computed(() => [
  { value: ALL_VALUE, label: 'Todas' },
  ...cuentasStore.bankAccounts.map((a) => {
    const bank = cuentasStore.banks.find((b) => b.id === a.bank_id)
    const bankName = bank ? `${bank.bank}${bank.currency ? ` (${bank.currency})` : ''}` : '-'
    const holder =
      (a.account_holder_type ?? '').toLowerCase().includes('juridica') || (a.account_holder_type ?? '').toLowerCase().includes('legal')
        ? (a.business_name ?? '-')
        : [a.holder_names, a.holder_surnames].filter(Boolean).join(' ') || '-'
    const accNum = a.account_number ?? '-'
    return { value: a.id, label: `${bankName} - ${accNum} (${holder})` }
  })
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

const form = reactive<{
  bank_account_origin_id: string
  bank_account_destination_id: string
  user_id: string
  tax_rate_id: string
  commission_id: string
  status: string
  origin_amount: number
  destination_amount: number
  resultado_comision: number | null
  total_a_enviar: number | null
  code: string
  send_date: string
  payment_date: string
  send_voucher: string | File | null
  payment_voucher: string | File | null
}>({
  bank_account_origin_id: '',
  bank_account_destination_id: '',
  user_id: '',
  tax_rate_id: '',
  commission_id: '',
  status: 'pending',
  origin_amount: 0,
  destination_amount: 0,
  resultado_comision: null,
  total_a_enviar: null,
  code: '',
  send_date: '',
  payment_date: '',
  send_voucher: null,
  payment_voucher: null
})

const editingId = ref<string | null>(null)

type CreateTab = 'calculadora' | 'datos' | 'vouchers'
const createTab = ref<CreateTab>('calculadora')

function bankAccountToOption(a: BankAccount) {
  const bank = cuentasStore.banks.find((b) => b.id === a.bank_id)
  const bankName = bank ? `${bank.bank}${bank.currency ? ` (${bank.currency})` : ''}` : '-'
  const holder =
    (a.account_holder_type ?? '').toLowerCase().includes('juridica') || (a.account_holder_type ?? '').toLowerCase().includes('legal')
      ? (a.business_name ?? '-')
      : [a.holder_names, a.holder_surnames].filter(Boolean).join(' ') || '-'
  const accNum = a.account_number ?? '-'
  return { value: a.id, label: `${bankName} - ${accNum} (${holder})` }
}

const originAccountOptions = computed(() => {
  const userId = form.user_id?.trim()
  return cuentasStore.bankAccounts
    .filter((a) => (a.account_flow ?? '').toLowerCase() === 'origin')
    .filter((a) => !userId || a.user_id === userId)
    .map(bankAccountToOption)
})

const destinationAccountOptions = computed(() => {
  const userId = form.user_id?.trim()
  return cuentasStore.bankAccounts
    .filter((a) => (a.account_flow ?? '').toLowerCase() === 'destination')
    .filter((a) => !userId || a.user_id === userId)
    .map(bankAccountToOption)
})

const clientOptions = computed(() =>
  cuentasStore.clientUsers.map((u) => ({ value: u.id, label: u.name }))
)

const taxRateOptions = computed(() =>
  tasasStore.taxRates.map((r) => ({
    value: r.id,
    label: `${r.coin_a}-${r.coin_b} (${r.tax})`
  }))
)

const commissionOptions = computed(() =>
  comisionesStore.commissions.map((c) => ({
    value: c.id,
    label: `${c.coin_a}-${c.coin_b} (${c.percentage}%)`
  }))
)

const statusFormOptions = TRANSACTION_STATUSES.map((s) => ({
  value: s,
  label: TRANSACTION_STATUS_LABELS[s]
}))

const debouncedSearch = ref('')
let searchDebounceId: ReturnType<typeof setTimeout>
watch(searchQuery, (q) => {
  clearTimeout(searchDebounceId)
  searchDebounceId = setTimeout(() => {
    debouncedSearch.value = q
  }, 150)
}, { immediate: true })

const apiFilterParams = computed((): GetTransactionsParams | undefined => {
  const p: GetTransactionsParams = {}
  if (statusFilter.value && statusFilter.value !== 'todos') p.status = statusFilter.value
  if (userFilter.value?.trim()) p.user_id = userFilter.value.trim()
  if (bankAccountFilter.value?.trim()) p.bank_account_id = bankAccountFilter.value.trim()
  if (createdAtFrom.value?.trim()) p.created_at_from = new Date(createdAtFrom.value).toISOString()
  if (createdAtTo.value?.trim()) {
    const d = new Date(createdAtTo.value)
    d.setHours(23, 59, 59, 999)
    p.created_at_to = d.toISOString()
  }
  return Object.keys(p).length ? p : undefined
})

const searchedTransactions = computed(() => {
  let list = transactionsStore.transactions

  // Filtro por estado
  if (statusFilter.value && statusFilter.value !== 'todos') {
    list = list.filter((t) => (t.status ?? '').toLowerCase() === statusFilter.value.toLowerCase())
  }

  // Filtro por cliente
  if (userFilter.value?.trim()) {
    list = list.filter((t) => (t.user_id ?? '') === userFilter.value.trim())
  }

  // Filtro por cuenta bancaria (origen o destino)
  if (bankAccountFilter.value?.trim()) {
    const accountId = bankAccountFilter.value.trim()
    list = list.filter(
      (t) =>
        (t.bank_account_origin_id ?? t.bank_account_id ?? '') === accountId ||
        (t.bank_account_destination_id ?? '') === accountId
    )
  }

  // Filtro por rango de fechas (created_at o send_date)
  if (createdAtFrom.value?.trim()) {
    const from = new Date(createdAtFrom.value).getTime()
    list = list.filter((t) => {
      const d = t.created_at ?? t.send_date ?? ''
      return d ? new Date(d).getTime() >= from : false
    })
  }
  if (createdAtTo.value?.trim()) {
    const to = new Date(createdAtTo.value)
    to.setHours(23, 59, 59, 999)
    const toMs = to.getTime()
    list = list.filter((t) => {
      const d = t.created_at ?? t.send_date ?? ''
      return d ? new Date(d).getTime() <= toMs : false
    })
  }

  // Búsqueda por código
  const q = debouncedSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter((t) => {
      const code = (t.code ?? '').toLowerCase()
      const id = (t.id ?? '').toLowerCase()
      return code.includes(q) || id.includes(q)
    })
  }

  return list
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(searchedTransactions.value.length / perPage.value))
)

const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return searchedTransactions.value.slice(start, start + perPage.value)
})

function resetForm() {
  form.bank_account_origin_id = ''
  form.bank_account_destination_id = ''
  form.user_id = ''
  form.tax_rate_id = ''
  form.commission_id = ''
  form.status = 'pending'
  form.origin_amount = 0
  form.destination_amount = 0
  form.resultado_comision = null
  form.total_a_enviar = null
  form.code = ''
  form.send_date = ''
  form.payment_date = ''
  form.send_voucher = null
  form.payment_voucher = null
  editingId.value = null
}

function syncFromCalculator() {
  form.origin_amount = calculatorStore.amountSend || 0
  form.destination_amount = calculatorStore.amountReceive || 0
  form.tax_rate_id = calculatorStore.selectedTaxRateId ?? ''
  form.commission_id = calculatorStore.selectedCommissionId ?? ''
  const res = calculatorStore.result
  if (res) {
    form.resultado_comision = res.commission
    form.total_a_enviar = res.totalToSend
  } else {
    form.resultado_comision = null
    form.total_a_enviar = null
  }
}

function openCreateModal() {
  transactionsStore.error = null
  resetForm()
  createTab.value = 'calculadora'
  showCreateModal.value = true
  loadFormOptions()
  calculatorStore.loadData()
}

async function loadFormOptions() {
  await Promise.all([
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadClientUsers(),
    cuentasStore.loadBanks(),
    tasasStore.loadTaxRates(),
    comisionesStore.loadCommissions()
  ])
}

function openEditModal(t: Transaction) {
  if (!t.id) return
  transactionsStore.error = null
  editingId.value = t.id
  createTab.value = 'datos'
  form.bank_account_origin_id = t.bank_account_origin_id ?? ''
  form.bank_account_destination_id = t.bank_account_destination_id ?? t.bank_account_id ?? ''
  form.user_id = t.user_id ?? ''
  form.tax_rate_id = t.tax_rate_id ?? ''
  form.commission_id = t.commission_id ?? ''
  form.status = (t.status ?? 'pending').toLowerCase()
  form.origin_amount = Number(t.origin_amount) || 0
  form.destination_amount = Number(t.destination_amount) || 0
  form.resultado_comision = null
  form.total_a_enviar = null
  form.code = t.code ?? ''
  form.send_date = t.send_date ? t.send_date.slice(0, 10) : ''
  form.payment_date = t.payment_date ? t.payment_date.slice(0, 10) : ''
  form.send_voucher = t.send_voucher ?? null
  form.payment_voucher = t.payment_voucher ?? null
  showCreateModal.value = true
  loadFormOptions()
}

async function submitForm() {
  syncFromCalculator()
  if (!form.bank_account_origin_id || !form.bank_account_destination_id || !form.user_id) {
    transactionsStore.error = 'Cuenta origen, cuenta destino y cliente son obligatorios'
    return
  }
  if (!form.tax_rate_id || !form.commission_id) {
    transactionsStore.error = 'Tasa y comisión son obligatorios (usa la calculadora primero)'
    return
  }
  try {
    const sendVoucher = form.send_voucher
    const paymentVoucher = form.payment_voucher
    const bothVouchersUploaded =
      (sendVoucher instanceof File || (typeof sendVoucher === 'string' && sendVoucher)) &&
      (paymentVoucher instanceof File || (typeof paymentVoucher === 'string' && paymentVoucher))
    const status = bothVouchersUploaded ? 'completed' : form.status

    const code = form.code?.trim() || `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const round2 = (n: number) => Math.round(n * 100) / 100
    const payload = {
      bank_account_origin: form.bank_account_origin_id,
      bank_account_destination: form.bank_account_destination_id,
      user_id: form.user_id,
      tax_rate_id: form.tax_rate_id,
      commission_id: form.commission_id,
      status,
      origin_amount: round2(form.origin_amount),
      destination_amount: round2(form.destination_amount),
      resultado_comision: form.resultado_comision != null ? round2(form.resultado_comision) : undefined,
      total_a_enviar: form.total_a_enviar != null ? round2(form.total_a_enviar) : undefined,
      code,
      send_date: form.send_date || undefined,
      payment_date: form.payment_date || undefined,
      send_voucher: sendVoucher ?? undefined,
      payment_voucher: paymentVoucher ?? undefined
    }
    if (editingId.value) {
      await transactionsStore.updateTransaction(editingId.value, payload)
    } else {
      await transactionsStore.createTransaction(payload)
    }
    showCreateModal.value = false
    resetForm()
  } catch {
    // Error en store
  }
}

async function handleDelete(t: Transaction) {
  if (!t.id) return
  if (!confirm(`¿Eliminar transacción ${t.code ?? t.id}?`)) return
  openMenuId.value = null
  deletingId.value = t.id
  transactionsStore.error = null
  try {
    await transactionsStore.deleteTransaction(t.id)
  } catch {
    // Error en store
  } finally {
    deletingId.value = null
  }
}

const selectedMenuTransaction = computed(() => {
  const id = openMenuId.value
  if (!id) return null
  return (
    paginatedTransactions.value.find((t) => (t.id ?? '') === id) ??
    transactionsStore.transactions.find((t) => (t.id ?? '') === id) ??
    null
  )
})

function updateMenuPosition() {
  if (!menuTriggerEl.value) return
  const rect = menuTriggerEl.value.getBoundingClientRect()
  const menuWidth = 168
  const menuHeight = 96
  const padding = 8
  let left = rect.right - menuWidth
  if (left < padding) left = padding
  if (left + menuWidth > window.innerWidth - padding) left = window.innerWidth - menuWidth - padding
  let top = rect.bottom + 4
  if (top + menuHeight > window.innerHeight - padding) top = rect.top - menuHeight - 4
  if (top < padding) top = padding
  menuPosition.top = top
  menuPosition.left = left
}

const PREVIEW_FIELD_ORDER = [
  'code', 'id', 'bank_account_origin_id', 'bank_account_destination_id', 'user_id',
  'tax_rate_id', 'commission_id', 'status', 'origin_amount', 'destination_amount',
  'commission_result', 'resultado_comision', 'total_to_send', 'total_a_enviar', 'coupon_id',
  'send_date', 'payment_date', 'created_at', 'created_by', 'updated_at'
]

const previewDisplayEntries = computed(() => {
  const t = previewTransaction.value
  if (!t || typeof t !== 'object') return []
  const seen = new Set<string>()
  const entries: { key: string; label: string; displayValue: string }[] = []
  for (const key of PREVIEW_FIELD_ORDER) {
    if (key in t) {
      seen.add(key)
      entries.push({
        key,
        label: PREVIEW_FIELD_LABELS[key] ?? key,
        displayValue: formatPreviewValue(key, (t as Record<string, unknown>)[key])
      })
    }
  }
  for (const key of Object.keys(t)) {
    if (typeof key === 'string' && !seen.has(key) && !key.startsWith('_')) {
      entries.push({
        key,
        label: PREVIEW_FIELD_LABELS[key] ?? key,
        displayValue: formatPreviewValue(key, (t as Record<string, unknown>)[key])
      })
    }
  }
  return entries
})

const PREVIEW_FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  code: 'Código',
  bank_account_origin_id: 'Cuenta origen',
  bank_account_destination_id: 'Cuenta destino',
  user_id: 'Cliente',
  tax_rate_id: 'Tasa',
  commission_id: 'Comisión',
  status: 'Estado',
  origin_amount: 'Monto origen',
  destination_amount: 'Monto destino',
  commission_result: 'Resultado comisión',
  resultado_comision: 'Resultado comisión',
  total_to_send: 'Total a enviar',
  total_a_enviar: 'Total a enviar',
  coupon_id: 'Cupón',
  send_date: 'Fecha envío',
  payment_date: 'Fecha pago',
  send_voucher: 'Comprobante envío',
  payment_voucher: 'Comprobante pago',
  created_at: 'Creado',
  created_by: 'Creado por',
  updated_at: 'Actualizado'
}

function openPreviewModal(t: Transaction | null) {
  if (!t) return
  openMenuId.value = null
  previewTransaction.value = null
  previewError.value = null
  showPreviewModal.value = true
  previewLoading.value = false
  previewTransaction.value = { ...t }
}

function closePreviewModal() {
  showPreviewModal.value = false
  previewTransaction.value = null
  previewError.value = null
}

function formatPreviewValue(key: string, value: unknown): string {
  if (value == null || value === '') return '-'
  if (key === 'bank_account_origin_id' || key === 'bank_account_destination_id') {
    return getBankAccountLabel(value as string)
  }
  if (key === 'user_id') return getClientLabel(value as string)
  if (key === 'status') return getStatusLabel(value as string)
  if (['origin_amount', 'destination_amount', 'commission_result', 'resultado_comision', 'total_to_send', 'total_a_enviar'].includes(key)) {
    return formatValue(value)
  }
  if ((key === 'send_date' || key === 'payment_date' || key === 'created_at' || key === 'updated_at') && typeof value === 'string') {
    return formatDate(value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function toggleMenu(id: string, event?: Event) {
  if (openMenuId.value === id) {
    openMenuId.value = null
    menuTriggerEl.value = null
    return
  }
  menuTriggerEl.value = (event?.target as HTMLElement)?.closest('td') ?? (event?.target as HTMLElement) ?? null
  openMenuId.value = id
  nextTick(() => {
    updateMenuPosition()
    const scrollParent = menuTriggerEl.value?.closest('.overflow-x-auto')
    const close = () => {
      openMenuId.value = null
      menuTriggerEl.value = null
      document.removeEventListener('click', close)
      window.removeEventListener('resize', updateMenuPosition)
      scrollParent?.removeEventListener('scroll', updateMenuPosition)
    }
    window.addEventListener('resize', updateMenuPosition)
    scrollParent?.addEventListener('scroll', updateMenuPosition)
    setTimeout(() => document.addEventListener('click', close), 0)
  })
}

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

function formatValue(value: unknown): string {
  if (value == null) return '-'
  if (typeof value === 'number') return value.toLocaleString('es', { minimumFractionDigits: 2 })
  return String(value)
}

function formatDate(value: string | undefined): string {
  if (!value) return '-'
  try {
    const d = new Date(value)
    return d.toLocaleDateString('es')
  } catch {
    return value
  }
}

function getStatusLabel(status: string | undefined): string {
  if (!status) return '-'
  const s = status.toLowerCase()
  return TRANSACTION_STATUS_LABELS[s as keyof typeof TRANSACTION_STATUS_LABELS] ?? status
}

function getBankAccountLabel(id: string | undefined): string {
  if (!id) return '-'
  const acc = cuentasStore.bankAccounts.find((a) => a.id === id)
  if (!acc) return id
  return bankAccountToOption(acc).label
}

function getClientLabel(id: string | undefined): string {
  if (!id) return '-'
  const u = cuentasStore.clientUsers.find((u) => u.id === id)
  return u?.name ?? id
}

function getVoucherLabel(v: unknown): string {
  return v != null && typeof v === 'object' && 'name' in v && typeof (v as File).name === 'string'
    ? (v as File).name
    : 'Archivo seleccionado'
}

async function submitImport() {
  if (!importFile.value) return
  try {
    await transactionsStore.importExcel(importFile.value, apiFilterParams.value)
    showImportModal.value = false
    importFile.value = null
    if (fileInput.value) fileInput.value.value = ''
  } catch {
    // Error en store
  }
}

async function submitImportSimple() {
  if (!importSimpleFile.value) return
  importingSimple.value = true
  importSimpleError.value = ''
  transactionsStore.error = null
  try {
    const payloads = await parseSimpleImportExcel(importSimpleFile.value)
    if (payloads.length === 0) {
      importSimpleError.value = 'No se encontraron filas válidas en el archivo'
      importingSimple.value = false
      return
    }
    let created = 0
    const errors: string[] = []
    for (const p of payloads) {
      try {
        await transactionsStore.createTransaction(p)
        created++
      } catch (e) {
        errors.push(`${p.code}: ${e instanceof Error ? e.message : 'Error'}`)
      }
    }
    showImportSimpleModal.value = false
    importSimpleFile.value = null
    if (fileInputSimple.value) fileInputSimple.value.value = ''
    loadTransactions()
    if (errors.length > 0) {
      transactionsStore.error = `Importados ${created}. Errores: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` ... +${errors.length - 3} más` : ''}`
    }
  } catch (e) {
    importSimpleError.value = e instanceof Error ? e.message : 'Error al procesar el archivo'
  } finally {
    importingSimple.value = false
  }
}

function loadTransactions() {
  transactionsStore.loadTransactions(apiFilterParams.value)
}

watch(createTab, (tab) => {
  if (tab === 'datos' && !editingId.value) syncFromCalculator()
})

watch(
  () => form.user_id,
  () => {
    form.bank_account_origin_id = ''
    form.bank_account_destination_id = ''
  }
)

watch([searchQuery, perPage], () => {
  currentPage.value = 1
})

watch([statusFilter, userFilter, bankAccountFilter, createdAtFrom, createdAtTo], () => {
  currentPage.value = 1
  loadTransactions()
})

onMounted(() => {
  Promise.all([
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadClientUsers(),
    cuentasStore.loadBanks()
  ]).then(() => loadTransactions())
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="mb-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Operaciones</p>
          <h1 class="text-2xl font-semibold text-[#232b4d]">Transacciones</h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-[#5ED6B3]/60 bg-white px-4 py-2.5 text-sm font-medium text-[#066ac9] transition hover:bg-[#5ED6B3]/10"
            @click="showImportModal = true"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
            @click="showImportSimpleModal = true"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Importar simple
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            @click="openCreateModal"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
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
          <AppDateInput
            v-model="createdAtTo"
            size="sm"
            class="min-w-[150px]"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-[11px] text-[#6b7280]">Total</label>
          <div class="flex h-9 min-w-[3rem] items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm font-medium text-[#374151]">
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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por código"
          class="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white py-2.5 pl-10 pr-4 text-sm text-[#374151] placeholder-[#9ca3af] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
        />
      </div>
    </div>

    <!-- Error -->
    <p v-if="transactionsStore.error" class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
      {{ transactionsStore.error }}
    </p>

    <!-- Tabla -->
    <div class="relative overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
      <div
        v-if="transactionsStore.isLoading"
        class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80"
      >
        <span class="text-sm text-[#6b7280]">Cargando...</span>
      </div>

      <table v-show="!transactionsStore.isLoading" class="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr class="bg-[#dbeafe]">
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Código</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Cuenta de origen</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Cuenta destino</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Cliente</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Monto origen</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Monto destino</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Estado</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#1d4ed8]">Fecha envío</th>
            <th class="w-12 px-2 py-3"></th>
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
              No hay transacciones. Importa un archivo Excel o crea una nueva.
            </td>
          </tr>
          <tr
            v-for="t in paginatedTransactions"
            :key="t.id ?? ''"
            class="border-t border-[#e5e7eb] bg-white transition hover:bg-[#f9fafb]"
          >
            <td class="px-4 py-3 font-medium text-[#374151]">{{ t.code ?? '-' }}</td>
            <td class="max-w-[180px] truncate px-4 py-3 text-[#374151]" :title="getBankAccountLabel(t.bank_account_origin_id)">
              {{ getBankAccountLabel(t.bank_account_origin_id) }}
            </td>
            <td class="max-w-[180px] truncate px-4 py-3 text-[#374151]" :title="getBankAccountLabel(t.bank_account_destination_id)">
              {{ getBankAccountLabel(t.bank_account_destination_id) }}
            </td>
            <td class="px-4 py-3 text-[#374151]">{{ getClientLabel(t.user_id) }}</td>
            <td class="px-4 py-3 text-[#374151]">{{ formatValue(t.origin_amount) }}</td>
            <td class="px-4 py-3 text-[#374151]">{{ formatValue(t.destination_amount) }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="{
                  'bg-amber-100 text-amber-800': (t.status ?? '').toLowerCase() === 'pending',
                  'bg-green-100 text-green-800': (t.status ?? '').toLowerCase() === 'completed',
                  'bg-red-100 text-red-800': (t.status ?? '').toLowerCase() === 'failed',
                  'bg-gray-100 text-gray-800': (t.status ?? '').toLowerCase() === 'cancelled',
                  'bg-[#dbeafe] text-[#1d4ed8]': !['pending', 'completed', 'failed', 'cancelled'].includes((t.status ?? '').toLowerCase())
                }"
              >
                {{ getStatusLabel(t.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-[#374151]">{{ formatDate(t.send_date) }}</td>
            <td class="relative px-2 py-3">
              <button
                type="button"
                class="rounded p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
                @click.stop="toggleMenu(t.id ?? '', $event)"
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
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
        :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }"
        @click.stop
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
          @click="openPreviewModal(selectedMenuTransaction)"
        >
          <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Previsualizar
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
          @click="openMenuId = null; openEditModal(selectedMenuTransaction)"
        >
          <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Editar
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#dc3545] hover:bg-[#fef2f2]"
          :disabled="deletingId === selectedMenuTransaction.id"
          @click="openMenuId = null; handleDelete(selectedMenuTransaction)"
        >
          <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        <div class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-xl">
          <div class="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
            <h2 class="text-lg font-semibold text-[#1f2937]">Previsualizar transacción</h2>
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
          <div class="flex-1 overflow-y-auto p-6">
            <p v-if="previewLoading" class="text-center text-sm text-[#6b7280]">Cargando...</p>
            <p v-else-if="previewError" class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
              {{ previewError }}
            </p>
            <div v-else-if="previewTransaction" class="space-y-6">
              <div class="space-y-4">
                <div
                  v-for="entry in previewDisplayEntries"
                  :key="entry.key"
                  class="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-4"
                >
                  <span class="min-w-[140px] shrink-0 text-sm font-medium text-[#6b7280]">
                    {{ entry.label }}
                  </span>
                  <span class="min-w-0 break-words text-sm text-[#374151]">
                    {{ entry.displayValue }}
                  </span>
                </div>
              </div>
              <div
                v-if="previewTransaction.send_voucher || previewTransaction.payment_voucher"
                class="border-t border-[#e5e7eb] pt-6"
              >
                <h3 class="mb-4 text-sm font-semibold text-[#374151]">Comprobantes</h3>
                <div class="grid gap-6 sm:grid-cols-2">
                  <div v-if="previewTransaction.send_voucher" class="space-y-2">
                    <p class="text-sm font-medium text-[#6b7280]">Comprobante envío</p>
                    <a
                      :href="Domain.mediaUrl(previewTransaction.send_voucher)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f9fafb]"
                    >
                      <img
                        :src="Domain.mediaUrl(previewTransaction.send_voucher)"
                        alt="Comprobante envío"
                        class="h-auto max-h-64 w-full object-contain"
                        @error="($event.target as HTMLImageElement).style.display = 'none'"
                      />
                    </a>
                  </div>
                  <div v-if="previewTransaction.payment_voucher" class="space-y-2">
                    <p class="text-sm font-medium text-[#6b7280]">Comprobante pago</p>
                    <a
                      :href="Domain.mediaUrl(previewTransaction.payment_voucher)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f9fafb]"
                    >
                      <img
                        :src="Domain.mediaUrl(previewTransaction.payment_voucher)"
                        alt="Comprobante pago"
                        class="h-auto max-h-64 w-full object-contain"
                        @error="($event.target as HTMLImageElement).style.display = 'none'"
                      />
                    </a>
                  </div>
                </div>
              </div>
            </div>
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
        <div class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-xl">
          <div class="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
            <h2 class="text-lg font-semibold text-[#1f2937]">
              {{ editingId ? 'Editar transacción' : 'Nueva transacción' }}
            </h2>
            <button
              type="button"
              class="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6]"
              aria-label="Cerrar"
              @click="showCreateModal = false"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Chips -->
          <div class="flex gap-2 border-b border-[#e5e7eb] px-6 py-3">
            <button
              type="button"
              :class="[
                'rounded-full px-4 py-2 text-sm font-medium transition',
                createTab === 'calculadora'
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
              ]"
              @click="createTab = 'calculadora'"
            >
              Calculadora
            </button>
            <button
              type="button"
              :class="[
                'rounded-full px-4 py-2 text-sm font-medium transition',
                createTab === 'datos'
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
              ]"
              @click="createTab = 'datos'"
            >
              Datos
            </button>
            <button
              type="button"
              :class="[
                'rounded-full px-4 py-2 text-sm font-medium transition',
                createTab === 'vouchers'
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
              ]"
              @click="createTab = 'vouchers'"
            >
              Vouchers
            </button>
          </div>

          <!-- Contenido -->
          <div class="flex-1 overflow-y-auto p-6">
            <div v-if="createTab === 'calculadora'">
              <CalculatorEmbed />
            </div>

            <form v-else-if="createTab === 'datos'" class="space-y-6" @submit.prevent="submitForm">
              <div class="grid gap-6 sm:grid-cols-2">
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Cliente *</label>
                  <AppDropdown
                    v-model="form.user_id"
                    :options="clientOptions"
                    placeholder="Seleccionar cliente (rol cliente)"
                    :searchable="clientOptions.length > 10"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Cuenta origen</label>
                  <AppDropdown
                    v-model="form.bank_account_origin_id"
                    :options="originAccountOptions"
                    placeholder="Cuentas de origen"
                    :searchable="originAccountOptions.length > 5"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Cuenta destino *</label>
                  <AppDropdown
                    v-model="form.bank_account_destination_id"
                    :options="destinationAccountOptions"
                    placeholder="Cuentas de destino"
                    :searchable="destinationAccountOptions.length > 5"
                  />
                </div>
                <div class="space-y-1.5" v-if="editingId">
                  <label class="block text-sm font-medium text-[#374151]">Estado</label>
                  <AppDropdown
                    v-model="form.status"
                    :options="statusFormOptions"
                    placeholder="Pendiente"
                    :searchable="false"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Tasa</label>
                  <AppDropdown
                    v-model="form.tax_rate_id"
                    :options="taxRateOptions"
                    placeholder="Seleccionar"
                    :searchable="taxRateOptions.length > 10"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Comisión</label>
                  <AppDropdown
                    v-model="form.commission_id"
                    :options="commissionOptions"
                    placeholder="Seleccionar"
                    :searchable="commissionOptions.length > 10"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Código</label>
                  <input
                    v-model="form.code"
                    type="text"
                    class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm"
                    placeholder="Código único"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Monto origen</label>
                  <input
                    v-model.number="form.origin_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Monto destino</label>
                  <input
                    v-model.number="form.destination_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Fecha envío</label>
                  <AppDateInput v-model="form.send_date" />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-[#374151]">Fecha pago</label>
                  <AppDateInput v-model="form.payment_date" />
                </div>
              </div>
            </form>

            <form v-else-if="createTab === 'vouchers'" class="space-y-6" @submit.prevent="submitForm">
              <div class="grid gap-6 sm:grid-cols-2">
                <div class="space-y-1.5 sm:col-span-2">
                  <label class="block text-sm font-medium text-[#374151]">Voucher envío (send_voucher)</label>
                  <input
                    type="file"
                    accept="image/*"
                    class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm"
                    @change="form.send_voucher = ($event.target as HTMLInputElement).files?.[0] ?? null"
                  />
                  <p v-if="form.send_voucher" class="mt-1 text-xs text-[#6b7280]">
                    {{ getVoucherLabel(form.send_voucher) }}
                  </p>
                </div>
                <div class="space-y-1.5 sm:col-span-2">
                  <label class="block text-sm font-medium text-[#374151]">Voucher pago (payment_voucher)</label>
                  <input
                    type="file"
                    accept="image/*"
                    class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm"
                    @change="form.payment_voucher = ($event.target as HTMLInputElement).files?.[0] ?? null"
                  />
                  <p v-if="form.payment_voucher" class="mt-1 text-xs text-[#6b7280]">
                    {{ getVoucherLabel(form.payment_voucher) }}
                  </p>
                </div>
                <p v-if="form.send_voucher && form.payment_voucher" class="sm:col-span-2 text-xs text-green-600">
                  Ambos vouchers subidos. El estado se establecerá como finalizado al guardar.
                </p>
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

          <!-- Footer con botones -->
          <div class="flex flex-wrap justify-end gap-3 border-t border-[#e5e7eb] px-6 py-4">
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb]"
              @click="showCreateModal = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
              :disabled="transactionsStore.isCreating || transactionsStore.isUpdating"
              @click="submitForm"
            >
              {{ transactionsStore.isCreating || transactionsStore.isUpdating ? 'Guardando...' : 'Guardar' }}
            </button>
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
        <div class="w-full max-w-md rounded-2xl border border-[#dbe7fb] bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-lg font-semibold text-[#232b4d]">Importar transacciones</h2>
          <div class="mb-4 rounded-lg bg-[#fbfdff] p-4 text-sm text-[#666]">
            <p class="mb-2 font-medium text-[#333]">Formatos aceptados: JSON o Excel (.xlsx, .xls)</p>
            <p class="mb-2 text-[#10b981] font-medium">Formato Brasper:</p>
            <p class="mb-2">Si el Excel tiene columnas <strong>Nombre</strong>, <strong>Correo</strong>, <strong>ENVÍA (PEN)</strong>, <strong>RECIBE (BRL)</strong>, etc., se detecta automáticamente.</p>
            <p class="mb-2">Formato alternativo (JSON o Excel con columnas):</p>
            <p class="mb-2">Columnas del Excel (primera fila = encabezados):</p>
            <ul class="list-inside list-disc space-y-1">
              <li><strong>origin_amount</strong> / monto_origen — Monto origen</li>
              <li><strong>destination_amount</strong> / monto_destino — Monto destino</li>
              <li><strong>tax_rate_id</strong>, <strong>commission_id</strong> — IDs de tasa y comisión</li>
              <li><strong>origin_names</strong>, <strong>origin_lastnames</strong>, <strong>origin_email</strong> — Usuario origen</li>
              <li><strong>dest_names</strong>, <strong>dest_lastnames</strong>, <strong>dest_email</strong> — Usuario destino</li>
              <li><strong>origin_bank_id</strong>, <strong>dest_bank_id</strong> — IDs de bancos</li>
              <li><strong>send_date</strong> / fecha_envio, <strong>payment_date</strong> / fecha_pago</li>
            </ul>
          </div>
          <form class="space-y-4" @submit.prevent="submitImport">
            <div>
              <label class="mb-1 block text-sm font-medium text-[#333]">Archivo (.json, .xlsx, .xls)</label>
              <input
                ref="fileInput"
                type="file"
                accept=".json,.xlsx,.xls"
                required
                class="w-full rounded-xl border border-[#cfdbef] px-4 py-2.5 text-sm"
                @change="importFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
              />
            </div>
            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                class="rounded-xl bg-gradient-to-r from-[#10b981] to-[#5ED6B3] px-4 py-2.5 text-sm font-semibold text-[#06271d] disabled:opacity-60"
                :disabled="transactionsStore.isImporting || !importFile"
              >
                {{ transactionsStore.isImporting ? 'Importando...' : 'Importar' }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-[#4A52D8]/30 px-4 py-2.5 text-sm text-[#3C4DA7] hover:bg-[#4A52D8]/10"
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
        <div class="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-lg font-semibold text-[#1f2937]">Importar simple</h2>
          <p class="mb-4 text-sm text-[#6b7280]">
            Usa el mismo endpoint que Crear. Cada fila del Excel se envía como una transacción individual.
          </p>
          <div class="mb-4 rounded-lg bg-[#f9fafb] p-4 text-sm text-[#6b7280]">
            <p class="mb-2 font-medium text-[#374151]">Columnas (IDs obligatorios):</p>
            <ul class="list-inside list-disc space-y-1">
              <li><strong>bank_account_origin</strong> / cuenta_origen</li>
              <li><strong>bank_account_destination</strong> / cuenta_destino</li>
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
              <label class="mb-1 block text-sm font-medium text-[#374151]">Archivo (.xlsx, .xls)</label>
              <input
                ref="fileInputSimple"
                type="file"
                accept=".xlsx,.xls"
                required
                class="w-full rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm"
                @change="importSimpleFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
              />
            </div>
            <p v-if="importSimpleError" class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
              {{ importSimpleError }}
            </p>
            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                class="rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60"
                :disabled="importingSimple || !importSimpleFile"
              >
                {{ importingSimple ? 'Importando...' : 'Importar' }}
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
