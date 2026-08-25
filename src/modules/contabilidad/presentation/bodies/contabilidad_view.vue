<script setup lang="ts">
import { ref, computed, onMounted, shallowRef, watch } from 'vue'
import { useTransactionsStore } from '@modules/transacciones/presentation/controllers/use_transactions_store_controller'
import { useTableDragScroll } from '@modules/transacciones/presentation/composables/use_table_drag_scroll'
import {
  useResizableTableColumns,
  type ResizableTableColumn
} from '@modules/transacciones/presentation/composables/use_resizable_table_columns'
import { useCuentasBancariasStore } from '@modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller'
import type { BankAccount } from '@modules/cuentas-bancarias/domain/models'
import { useTasasStore } from '@modules/tasas/presentation/controllers/use_tasas_store_controller'
import { useComisionesStore } from '@modules/comisiones/presentation/controllers/use_comisiones_store_controller'
import type { CurrencyCode } from '@modules/calculator/domain/models'
import { CURRENCY_FLAG_SRC_BY_CODE } from '@modules/calculator/presentation/utils/calculator_format'
import type {
  Transaction,
  TransactionSpecialDiscountInfo
} from '@modules/transacciones/domain/models'
import type { GetTransactionsParams } from '@modules/transacciones/infrastructure/adapters/transactions_repository'
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
  isTransactionChecked,
  normalizeTransactionStatus,
  resolveTransactionStatusForDisplay,
  formatTransactionCodeForDisplay,
  localDateInputStartMs,
  localDateInputEndMs,
  getTransactionSpecialDiscountForDisplay,
  SPECIAL_CALCULATOR_DISCOUNT_CODE,
  inferOriginCurrencyFromTransactionCode
} from '@modules/transacciones/domain/models'
import AppDropdown from '@/interface/components/AppDropdown.vue'
import AppDateInput from '@/interface/components/AppDateInput.vue'
import TableColumnResizeHandle from '@modules/transacciones/presentation/components/TableColumnResizeHandle.vue'
import { MediaViewerDialog } from '@interface/widgets'
import { Domain } from '@/interface/infrastructure/services'
import { downloadTransactionAccountingPdf } from '../../infrastructure/pdf/download_transaction_accounting_pdf'

const transactionsStore = useTransactionsStore()
const cuentasStore = useCuentasBancariasStore()
const tasasStore = useTasasStore()
const comisionesStore = useComisionesStore()

const searchQuery = ref('')
const statusFilter = ref<string>('todos')
const userFilter = ref<string>('')
const bankAccountFilter = ref<string>('')
const createdAtFrom = ref<string>('')
const createdAtTo = ref<string>('')
const perPage = ref(10)
const currentPage = ref(1)
const updatingCheckedId = ref<string | null>(null)
const showMediaViewer = shallowRef(false)
const mediaViewerSource = shallowRef('')
const mediaViewerTitle = shallowRef('Comprobante')

const {
  containerRef: tableScrollRef,
  isDragging: isDraggingTable,
  onPointerDown: onTablePointerDown
} = useTableDragScroll()

interface AccountingTableColumn<Key extends string = string> extends ResizableTableColumn<Key> {
  label: string
  headerClass: string
  title?: string
  headerLines?: readonly string[]
  visuallyHidden?: boolean
}

const ACCOUNTING_TABLE_ACTIONS_WIDTH = 96
type AccountingTableColumnKey =
  | 'checked'
  | 'code'
  | 'sendDate'
  | 'operationNumber'
  | 'client'
  | 'destinationAccount'
  | 'company'
  | 'sendAmount'
  | 'receiveAmount'
  | 'exchangeRate'
  | 'variableDiscount'
  | 'specialDiscount'
  | 'internalCommission'
  | 'internalTax'
  | 'finalSale'
  | 'status'
  | 'sendVoucher'
  | 'paymentVoucher'

const ACCOUNTING_TABLE_COLUMNS: readonly AccountingTableColumn<AccountingTableColumnKey>[] = [
  {
    key: 'checked',
    label: 'Verificada',
    defaultWidth: 48,
    minWidth: 40,
    maxWidth: 80,
    headerClass: 'px-2 py-3',
    title: 'Verificada',
    visuallyHidden: true
  },
  {
    key: 'code',
    label: 'Código',
    defaultWidth: 132,
    minWidth: 96,
    maxWidth: 600,
    headerClass: 'whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark'
  },
  {
    key: 'sendDate',
    label: 'Fecha envío',
    defaultWidth: 150,
    minWidth: 120,
    maxWidth: 600,
    headerClass: 'whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark'
  },
  {
    key: 'operationNumber',
    label: 'N° operación',
    defaultWidth: 145,
    minWidth: 110,
    maxWidth: 1200,
    headerClass: 'whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark'
  },
  {
    key: 'client',
    label: 'Cliente',
    defaultWidth: 210,
    minWidth: 140,
    maxWidth: 1200,
    headerClass: 'whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark'
  },
  {
    key: 'destinationAccount',
    label: 'Cuenta destino',
    defaultWidth: 190,
    minWidth: 140,
    maxWidth: 1200,
    headerClass: 'whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark'
  },
  {
    key: 'company',
    label: 'Razón social',
    defaultWidth: 170,
    minWidth: 130,
    maxWidth: 1200,
    headerClass: 'whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark'
  },
  {
    key: 'sendAmount',
    label: 'Monto de envío',
    defaultWidth: 150,
    minWidth: 120,
    maxWidth: 600,
    headerClass: 'whitespace-nowrap px-4 py-3 text-center font-semibold text-brasper-indigoDark'
  },
  {
    key: 'receiveAmount',
    label: 'Monto a recibir',
    defaultWidth: 150,
    minWidth: 120,
    maxWidth: 600,
    headerClass: 'whitespace-nowrap px-4 py-3 text-center font-semibold text-brasper-indigoDark'
  },
  {
    key: 'exchangeRate',
    label: 'Tipo cambio',
    defaultWidth: 130,
    minWidth: 105,
    maxWidth: 600,
    headerClass: 'whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark'
  },
  {
    key: 'variableDiscount',
    label: 'Descuento variable',
    defaultWidth: 112,
    minWidth: 92,
    maxWidth: 400,
    headerClass:
      'whitespace-nowrap px-2 py-3 text-right text-xs font-semibold leading-tight text-brasper-indigoDark',
    title: 'Porcentaje de la comisión de contabilidad aplicable a la operación',
    headerLines: ['Descuento', 'variable']
  },
  {
    key: 'specialDiscount',
    label: 'Descuento especial',
    defaultWidth: 112,
    minWidth: 92,
    maxWidth: 400,
    headerClass:
      'whitespace-nowrap px-2 py-3 text-right text-xs font-semibold leading-tight text-brasper-indigoDark',
    title: 'Descuento aplicado por la calculadora especial (ESPECIAL)',
    headerLines: ['Descuento', 'especial']
  },
  {
    key: 'internalCommission',
    label: 'Comisión final interna',
    defaultWidth: 126,
    minWidth: 104,
    maxWidth: 420,
    headerClass:
      'whitespace-nowrap bg-[#1e3a8a] px-2 py-3 text-right text-[10px] font-bold uppercase leading-tight tracking-wide text-white',
    headerLines: ['Comisión', 'final interna']
  },
  {
    key: 'internalTax',
    label: 'Impuesto final interno',
    defaultWidth: 126,
    minWidth: 104,
    maxWidth: 420,
    headerClass:
      'whitespace-nowrap bg-[#1e3a8a] px-2 py-3 text-right text-[10px] font-bold uppercase leading-tight tracking-wide text-white',
    headerLines: ['Impuesto', 'final interno']
  },
  {
    key: 'finalSale',
    label: 'Venta final',
    defaultWidth: 118,
    minWidth: 100,
    maxWidth: 420,
    headerClass:
      'whitespace-nowrap bg-emerald-600 px-2 py-3 text-right text-[10px] font-bold uppercase leading-tight tracking-wide text-white',
    headerLines: ['Venta', 'final']
  },
  {
    key: 'status',
    label: 'Estado',
    defaultWidth: 120,
    minWidth: 100,
    maxWidth: 600,
    headerClass: 'whitespace-nowrap px-4 py-3 font-semibold text-brasper-indigoDark'
  },
  {
    key: 'sendVoucher',
    label: 'Comprobante de envío',
    defaultWidth: 90,
    minWidth: 76,
    maxWidth: 400,
    headerClass:
      'whitespace-nowrap px-2 py-3 text-center text-xs font-semibold leading-tight text-brasper-indigoDark',
    title: 'Comprobante de envío (imagen)',
    headerLines: ['Comp.', 'envío']
  },
  {
    key: 'paymentVoucher',
    label: 'Comprobante de pago',
    defaultWidth: 90,
    minWidth: 76,
    maxWidth: 400,
    headerClass:
      'whitespace-nowrap px-2 py-3 text-center text-xs font-semibold leading-tight text-brasper-indigoDark',
    title: 'Comprobante de pago (imagen)',
    headerLines: ['Comp.', 'pago']
  }
]

const {
  widths: accountingColumnWidths,
  activeColumnKey: activeAccountingColumnKey,
  columnStyles: accountingColumnStyles,
  tableStyle: accountingTableStyle,
  startResize: startAccountingColumnResize,
  resizeBy: resizeAccountingColumnBy
} = useResizableTableColumns({
  columns: ACCOUNTING_TABLE_COLUMNS,
  storageKey: 'brasper:accounting:table-column-widths:v1',
  fixedWidth: ACCOUNTING_TABLE_ACTIONS_WIDTH
})

function openMediaViewer(source: string, title = 'Comprobante') {
  const normalizedSource = source.trim()
  if (!normalizedSource) return
  mediaViewerSource.value = normalizedSource
  mediaViewerTitle.value = title
  showMediaViewer.value = true
}

const statusOptions = computed(() => [
  { value: 'todos', label: 'Todos' },
  ...TRANSACTION_STATUSES.map((s) => ({
    value: s,
    label: TRANSACTION_STATUS_LABELS[s]
  }))
])

const ALL_VALUE = ''
const userFilterOptions = computed(() => [
  { value: ALL_VALUE, label: 'Todos' },
  ...cuentasStore.clientUsers.map((u) => ({ value: u.id, label: u.name }))
])

function bankAccountToOption(a: BankAccount) {
  const bank = cuentasStore.banks.find((b) => b.id === a.bank_id)
  const bankName = bank ? `${bank.bank}${bank.currency ? ` (${bank.currency})` : ''}` : '-'
  const holder =
    (a.account_holder_type ?? '').toLowerCase().includes('juridica') ||
    (a.account_holder_type ?? '').toLowerCase().includes('legal')
      ? (a.business_name ?? '-')
      : [a.holder_names, a.holder_surnames].filter(Boolean).join(' ') || '-'
  const nums = []
  if (a.account_number?.trim()) nums.push(a.account_number.trim())
  if (a.cci_number?.trim()) nums.push(`CCI: ${a.cci_number.trim()}`)
  if (a.pix_key?.trim()) nums.push(`PIX: ${a.pix_key.trim()}`)
  const accNum = nums.length > 0 ? nums.join(' / ') : '-'
  return { value: a.id, label: `${bankName} - ${accNum} (${holder})` }
}

const bankAccountFilterOptions = computed(() => [
  { value: ALL_VALUE, label: 'Todas' },
  ...cuentasStore.bankAccounts.map(bankAccountToOption)
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

const debouncedSearch = ref('')
let searchDebounceId: ReturnType<typeof setTimeout>
watch(
  searchQuery,
  (q) => {
    clearTimeout(searchDebounceId)
    searchDebounceId = setTimeout(() => {
      debouncedSearch.value = q
    }, 150)
  },
  { immediate: true }
)

/**
 * Parámetros que se envían al API. El filtrado (estado efectivo, cuenta,
 * rango por `send_date`, búsqueda) y la paginación se resuelven en el servidor.
 */
const apiFilterParams = computed((): GetTransactionsParams => {
  const p: GetTransactionsParams = {
    skip: (currentPage.value - 1) * perPage.value,
    limit: perPage.value
  }
  if (statusFilter.value && statusFilter.value !== 'todos') p.status = statusFilter.value
  if (userFilter.value?.trim()) p.user_id = userFilter.value.trim()
  if (bankAccountFilter.value?.trim()) p.bank_account_id = bankAccountFilter.value.trim()
  const fromMs = localDateInputStartMs(createdAtFrom.value)
  const toMs = localDateInputEndMs(createdAtTo.value)
  if (fromMs != null) p.send_date_from = new Date(fromMs).toISOString()
  if (toMs != null) p.send_date_to = new Date(toMs).toISOString()
  const q = debouncedSearch.value.trim()
  if (q) p.search = q
  return p
})

/** Página actual (ya filtrada y paginada por el servidor). */
const paginatedTransactions = computed(() => transactionsStore.transactions)

const totalResults = computed(() => transactionsStore.total)

const totalPages = computed(() => Math.max(1, Math.ceil(totalResults.value / perPage.value)))

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

function formatDateTime(value: string | undefined): string {
  if (!value) return '-'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('es-PE', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch {
    return value
  }
}

/** Contabilidad: moneda PEN como en reportes (S/ 0.00). */
function formatPen(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  return `S/ ${n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/**
 * Descuento de calculadora especial por transacción. El store ya entrega las
 * transacciones enriquecidas con el meta local; el catálogo (tasas + comisiones)
 * permite además inferirlo en operaciones antiguas sin `ESPECIAL` persistido.
 */
const specialDiscountByTransactionId = computed(() => {
  const catalogs = {
    commissions: comisionesStore.commissions,
    taxRates: tasasStore.taxRates
  }
  const map = new Map<string, TransactionSpecialDiscountInfo>()
  for (const t of transactionsStore.transactions) {
    if (!t.id) continue
    const info = getTransactionSpecialDiscountForDisplay(t, catalogs)
    if (info) map.set(t.id, info)
  }
  return map
})

function specialDiscount(t: Transaction): TransactionSpecialDiscountInfo | null {
  if (!t.id) return null
  return specialDiscountByTransactionId.value.get(t.id) ?? null
}

/** Monto descontado de la comisión por la calculadora especial (moneda origen). */
function descuentoEspecialMonto(t: Transaction): number | undefined {
  const info = specialDiscount(t)
  if (!info) return undefined
  const n = Number(info.discountCommission)
  if (!Number.isFinite(n) || Math.abs(n) <= 0.005) return undefined
  return n
}

function descuentoEspecialLabel(t: Transaction): string {
  const monto = descuentoEspecialMonto(t)
  if (monto == null) return '—'
  // Un descuento negativo (consignado en la calculadora) es un recargo.
  return monto < 0 ? `+${formatPen(Math.abs(monto))}` : `-${formatPen(monto)}`
}

function descuentoEspecialTitle(t: Transaction): string {
  const info = specialDiscount(t)
  if (!info) return 'Sin descuento de calculadora especial'
  const parts = [
    info.discountPercentage != null
      ? `${SPECIAL_CALCULATOR_DISCOUNT_CODE} (${formatValue(info.discountPercentage)}%)`
      : SPECIAL_CALCULATOR_DISCOUNT_CODE,
    `Comisión base: ${formatPen(info.baseCommission)}`,
    `Comisión aplicada: ${formatPen(info.finalCommission)}`
  ]
  if (info.improvementReceive > 0.005) {
    parts.push(`Mejora al recibir: +${formatValue(info.improvementReceive)}`)
  }
  return parts.join(' · ')
}

/** Contabilidad: porcentaje con dos decimales (3.50%). */
function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${n}%`
}

/**
 * Descuento variable: porcentaje de la comisión de contabilidad que aplica a la
 * operación. Lo resuelve el servidor en `GET /transactions/accounting` buscando
 * el tramo de `coin.commission_accounting` que cubre el monto de envío, así que
 * aquí solo se lee: la vista ya no replica la regla de tramos (el corte superior
 * es exclusivo y el navegador lo tenía inclusivo, lo que discrepaba justo en los
 * montos de corte: 300, 1000, 2000…).
 *
 * Es informativo — no altera la comisión final interna, que sigue viniendo del
 * API.
 */
function descuentoVariable(t: Transaction): number | null {
  const value = t.accounting_percentage
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function descuentoVariableLabel(t: Transaction): string {
  const percentage = descuentoVariable(t)
  return percentage != null ? formatPercent(percentage) : '—'
}

function descuentoVariableTitle(t: Transaction): string {
  const percentage = descuentoVariable(t)
  if (percentage == null) {
    return 'Sin comisión de contabilidad para este par y monto'
  }
  const { origin, destination } = getTransactionCurrencies(t)
  const pair = origin && destination ? `${origin} → ${destination}` : ''
  return [
    pair ? `Comisión de contabilidad ${pair}` : 'Comisión de contabilidad',
    formatPercent(percentage)
  ].join(' · ')
}

function comisionFinalInterna(t: Transaction): number | undefined {
  const v = t.comision_final_interna ?? t.resultado_comision ?? t.commission_result
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const IMPUESTO_INTERNO_RATE = 0.18

/** 18% de la comisión final interna. */
function impuestoFinalInterno(t: Transaction): number | undefined {
  const c = comisionFinalInterna(t)
  if (c == null) return undefined
  return Math.round(c * IMPUESTO_INTERNO_RATE * 100) / 100
}

function ventaFinalMonto(t: Transaction): number | undefined {
  if (t.venta_final != null) {
    const n = Number(t.venta_final)
    if (Number.isFinite(n)) return n
  }
  const c = comisionFinalInterna(t)
  const i = impuestoFinalInterno(t)
  if (c != null && i != null) return Math.round((c + i) * 100) / 100
  const tot = t.total_a_enviar ?? t.total_to_send
  if (tot != null) {
    const n = Number(tot)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/** Tabla: razón social de la empresa (`company_name` en API). */
function transactionCompanyNameTable(t: Transaction): string {
  const s = t.company_name != null ? String(t.company_name).trim() : ''
  return s || '—'
}

function voucherMediaHref(path: unknown): string {
  if (Array.isArray(path)) {
    const first = path.find((item) => typeof item === 'string' && item.trim())
    return first ? voucherMediaHref(first) : ''
  }
  if (path == null || typeof path !== 'string') return ''
  const s = path.trim()
  if (!s) return ''
  return Domain.mediaUrl(s)
}

function getStatusLabel(status: string | undefined): string {
  if (!status) return '-'
  const s = normalizeTransactionStatus(status)
  return TRANSACTION_STATUS_LABELS[s as keyof typeof TRANSACTION_STATUS_LABELS] ?? status
}

function statusRowBadgeClass(status: string | undefined): string {
  const s = normalizeTransactionStatus(status ?? '')
  switch (s) {
    case 'verification':
    case 'pending':
      return 'bg-amber-100 text-amber-900'
    case 'verified':
      return 'bg-violet-100 text-violet-900'
    case 'completed':
      return 'bg-emerald-100 text-emerald-900'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'checked':
      return 'bg-sky-100 text-sky-900'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-[#dbeafe] text-brasper-indigoDark'
  }
}

/** Tabla: solo banco + moneda (sin número de cuenta ni titular). */
function getBankCurrencyTableLabel(id: string | undefined): string {
  if (!id) return '-'
  const acc = cuentasStore.bankAccounts.find((a) => a.id === id)
  if (!acc) return id
  const bank = cuentasStore.banks.find((b) => b.id === acc.bank_id)
  if (!bank) return '-'
  return bank.currency ? `${bank.bank} (${bank.currency})` : bank.bank
}

function getClientLabel(id: string | undefined): string {
  if (!id) return '-'
  const u = cuentasStore.clientUsers.find((u) => u.id === id)
  return u?.name ?? id
}

function normalizeCurrencyCode(value: unknown): string {
  if (value == null) return ''
  return String(value).trim().toLowerCase()
}

function asCurrencyCode(value: string): CurrencyCode | null {
  const code = value.trim().toLowerCase()
  if (code === 'pen' || code === 'usd' || code === 'brl') return code
  return null
}

function getBankAccountCurrencyById(id: string | undefined): string {
  if (!id?.trim()) return ''
  const acc = cuentasStore.bankAccounts.find((a) => a.id === id)
  if (!acc) return ''
  const bank = cuentasStore.banks.find((b) => b.id === acc.bank_id)
  return normalizeCurrencyCode(bank?.currency)
}

function getTransactionCurrencies(t: Transaction) {
  const rec = t as Record<string, unknown>
  return {
    origin:
      normalizeCurrencyCode(rec.origin_currency) ||
      getBankAccountCurrencyById(t.bank_account_origin_id) ||
      getBankAccountCurrencyById(t.bank_account_id),
    destination:
      normalizeCurrencyCode(rec.destination_currency) ||
      getBankAccountCurrencyById(t.bank_account_destination_id)
  }
}

function getTransactionOriginCurrency(t: Transaction): string {
  return getTransactionCurrencies(t).origin || inferOriginCurrencyFromTransactionCode(t.code)
}

function getTransactionOriginFlag(t: Transaction): { src: string; label: string } | null {
  const origin = getTransactionOriginCurrency(t)
  const code = asCurrencyCode(origin)
  if (!code) return null
  return {
    src: CURRENCY_FLAG_SRC_BY_CODE[code],
    label: origin ? `Envía ${origin}` : 'Moneda de envío'
  }
}

function formatValueWithCurrency(value: unknown, currency: string): string {
  const amount = formatValue(value)
  const code = currency.trim().toUpperCase()
  return code && amount !== '-' ? `${amount} ${code}` : amount
}

function getTransactionExchangeRate(t: Transaction): number | null {
  const rec = t as Record<string, unknown>
  const raw = t.tax_amount ?? rec.tipo_cambio ?? rec.rate
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function getTransactionExchangeLabel(t: Transaction): string {
  const rate = getTransactionExchangeRate(t)
  if (rate == null) return '—'
  return formatValue(rate)
}

function getTransactionExchangeTitle(t: Transaction): string {
  const { origin, destination } = getTransactionCurrencies(t)
  const from = origin || '—'
  const to = destination || '—'
  const rate = getTransactionExchangeRate(t)
  if (rate != null && from !== '—' && to !== '—') {
    return `1 ${from.toUpperCase()} = ${formatValue(rate)} ${to.toUpperCase()}`
  }
  if (from !== '—' && to !== '—') return `${from.toUpperCase()} → ${to.toUpperCase()}`
  return '—'
}

const downloadingPdfId = ref<string | null>(null)
const pdfError = ref<string | null>(null)

/**
 * PDF de una fila: se arma con los mismos valores que muestra la tabla, así el
 * documento y la pantalla nunca discrepan.
 */
async function downloadPdf(t: Transaction) {
  if (downloadingPdfId.value) return
  downloadingPdfId.value = t.id ?? ''
  pdfError.value = null
  try {
    await downloadTransactionAccountingPdf({
      code: formatTransactionCodeForDisplay(t.code),
      sendDate: formatDate(t.send_date),
      operationNumber: t.operation_number ? String(t.operation_number) : '',
      client: getClientLabel(t.user_id),
      destinationAccount: getBankCurrencyTableLabel(t.bank_account_destination_id),
      companyName: transactionCompanyNameTable(t),
      originAmount: formatValue(t.origin_amount),
      destinationAmount: formatValue(t.destination_amount),
      exchangeRate: getTransactionExchangeLabel(t),
      exchangeDetail: getTransactionExchangeTitle(t),
      variableDiscount: descuentoVariableLabel(t),
      specialDiscount: descuentoEspecialLabel(t),
      internalCommission: formatPen(comisionFinalInterna(t)),
      internalTax: formatPen(impuestoFinalInterno(t)),
      finalSale: formatPen(ventaFinalMonto(t)),
      status: getStatusLabel(resolveTransactionStatusForDisplay(t) ?? t.status),
      checked: isTransactionChecked(t),
      generatedAt: new Date()
    })
  } catch (e) {
    pdfError.value = e instanceof Error ? e.message : 'No se pudo generar el PDF de la operación.'
  } finally {
    downloadingPdfId.value = null
  }
}

async function toggleChecked(t: Transaction) {
  if (!t.id || updatingCheckedId.value) return
  const newChecked = !isTransactionChecked(t)
  updatingCheckedId.value = t.id
  transactionsStore.error = null
  try {
    await transactionsStore.updateTransaction(t.id, { checked: newChecked })
  } catch {
    // Error en store
  } finally {
    updatingCheckedId.value = null
  }
}

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

function loadTransactions() {
  // Listado contable: agrega el descuento variable y los importes contables.
  void transactionsStore.loadTransactions(apiFilterParams.value, {
    accounting: true
  })
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
    perPage
  ],
  () => {
    currentPage.value = 1
  }
)

// Cualquier cambio de filtros o de página recarga desde el servidor.
watch(apiFilterParams, () => loadTransactions(), { deep: true })

onMounted(() => {
  transactionsStore.error = null
  void loadTransactions()
  void Promise.all([
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadClientUsers(),
    cuentasStore.loadBanks(),
    // Catálogos necesarios para inferir el descuento especial en operaciones antiguas.
    tasasStore.loadTaxRates(),
    comisionesStore.loadCommissions()
  ])
})
</script>

<template>
  <div class="space-y-6">
    <div class="mb-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">
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
          <AppDateInput v-model="createdAtFrom" size="sm" class="min-w-[150px]" />
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

    <p v-if="pdfError" class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
      {{ pdfError }}
    </p>

    <div
      ref="tableScrollRef"
      class="relative overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white"
      :class="isDraggingTable ? 'cursor-grabbing select-none' : 'cursor-grab'"
      @pointerdown="onTablePointerDown"
    >
      <div
        v-if="transactionsStore.isLoading && transactionsStore.transactions.length === 0"
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

      <table class="table-fixed text-left text-sm" :style="accountingTableStyle">
        <colgroup>
          <col
            v-for="column in ACCOUNTING_TABLE_COLUMNS"
            :key="column.key"
            :style="accountingColumnStyles[column.key]"
          />
          <col :style="{ width: `${ACCOUNTING_TABLE_ACTIONS_WIDTH}px` }" />
        </colgroup>
        <thead>
          <tr class="bg-[#dbeafe]">
            <th
              v-for="column in ACCOUNTING_TABLE_COLUMNS"
              :key="column.key"
              class="relative overflow-visible"
              :class="column.headerClass"
              :title="column.title"
            >
              <span v-if="column.visuallyHidden" class="sr-only">
                {{ column.label }}
              </span>
              <template v-else-if="column.headerLines">
                <span
                  v-for="line in column.headerLines"
                  :key="`${column.key}-${line}`"
                  class="block"
                >
                  {{ line }}
                </span>
              </template>
              <template v-else>{{ column.label }}</template>
              <TableColumnResizeHandle
                :label="column.label"
                :width="accountingColumnWidths[column.key]"
                :min-width="column.minWidth"
                :max-width="column.maxWidth"
                :active="activeAccountingColumnKey === column.key"
                @resize-start="startAccountingColumnResize(column.key, $event)"
                @resize-step="resizeAccountingColumnBy(column.key, $event)"
              />
            </th>
            <th
              class="sticky right-0 z-[2] bg-[#dbeafe] px-2 py-3 text-center text-xs font-semibold leading-tight text-brasper-indigoDark shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"
              title="Descargar el detalle contable en PDF"
            >
              PDF
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="paginatedTransactions.length === 0" class="border-t border-[#e5e7eb]">
            <td
              colspan="19"
              class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-6 py-12 text-center text-[#666]"
            >
              {{
                totalResults === 0
                  ? 'No hay movimientos que coincidan con los filtros.'
                  : 'No hay movimientos en esta página.'
              }}
            </td>
          </tr>
          <tr
            v-for="t in paginatedTransactions"
            :key="t.id ?? ''"
            class="border-t border-[#e5e7eb] bg-white transition-colors duration-700 hover:bg-[#f9fafb]"
          >
            <td class="overflow-hidden px-2 py-3">
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
            <td class="overflow-hidden whitespace-nowrap px-4 py-3 font-medium text-[#374151]">
              <span class="inline-flex max-w-full items-center gap-2">
                <template v-for="flag in [getTransactionOriginFlag(t)]" :key="flag?.src ?? 'none'">
                  <img
                    v-if="flag"
                    :src="flag.src"
                    :alt="flag.label"
                    :title="flag.label"
                    class="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-[#e5e7eb]"
                  />
                </template>
                <span class="min-w-0 truncate" :title="formatTransactionCodeForDisplay(t.code)">
                  {{ formatTransactionCodeForDisplay(t.code) }}
                </span>
              </span>
            </td>
            <td class="truncate whitespace-nowrap px-4 py-3 text-[#374151]">
              {{ formatDateTime(t.send_date) }}
            </td>
            <td
              class="truncate whitespace-nowrap px-4 py-3 text-[#374151]"
              :title="t.operation_number || '—'"
            >
              {{ t.operation_number || '—' }}
            </td>
            <td class="overflow-hidden px-4 py-3 text-[#374151]">
              <span class="block min-w-0 truncate" :title="getClientLabel(t.user_id)">
                {{ getClientLabel(t.user_id) }}
              </span>
            </td>
            <td
              class="truncate px-4 py-3 text-[#374151]"
              :title="getBankCurrencyTableLabel(t.bank_account_destination_id)"
            >
              {{ getBankCurrencyTableLabel(t.bank_account_destination_id) }}
            </td>
            <td class="truncate px-4 py-3 text-[#374151]" :title="transactionCompanyNameTable(t)">
              {{ transactionCompanyNameTable(t) }}
            </td>
            <td
              class="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3 text-center tabular-nums text-[#374151]"
            >
              {{ formatValueWithCurrency(t.origin_amount, getTransactionCurrencies(t).origin) }}
            </td>
            <td
              class="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3 text-center tabular-nums text-[#374151]"
            >
              {{
                formatValueWithCurrency(
                  t.destination_amount,
                  getTransactionCurrencies(t).destination
                )
              }}
            </td>
            <td
              class="truncate whitespace-nowrap px-4 py-3 tabular-nums text-[#374151]"
              :title="getTransactionExchangeTitle(t)"
            >
              {{ getTransactionExchangeLabel(t) }}
            </td>
            <td
              class="overflow-hidden whitespace-nowrap px-2 py-3 text-right tabular-nums"
              :class="
                descuentoVariable(t) != null ? 'font-medium text-[#374151]' : 'text-[#9ca3af]'
              "
              :title="descuentoVariableTitle(t)"
            >
              {{ descuentoVariableLabel(t) }}
            </td>
            <td
              class="overflow-hidden whitespace-nowrap px-2 py-3 text-right tabular-nums"
              :class="
                descuentoEspecialMonto(t) != null ? 'font-medium text-rose-700' : 'text-[#9ca3af]'
              "
              :title="descuentoEspecialTitle(t)"
            >
              {{ descuentoEspecialLabel(t) }}
            </td>
            <td
              class="overflow-hidden whitespace-nowrap bg-slate-50/80 px-2 py-3 text-right tabular-nums text-[#111827]"
            >
              {{ formatPen(comisionFinalInterna(t)) }}
            </td>
            <td
              class="overflow-hidden whitespace-nowrap bg-slate-50/80 px-2 py-3 text-right tabular-nums text-[#111827]"
            >
              {{ formatPen(impuestoFinalInterno(t)) }}
            </td>
            <td
              class="overflow-hidden whitespace-nowrap bg-emerald-50/90 px-2 py-3 text-right text-sm font-semibold tabular-nums text-emerald-900"
            >
              {{ formatPen(ventaFinalMonto(t)) }}
            </td>
            <td class="overflow-hidden px-4 py-3">
              <span
                class="inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="statusRowBadgeClass(resolveTransactionStatusForDisplay(t) ?? t.status)"
              >
                {{ getStatusLabel(resolveTransactionStatusForDisplay(t) ?? t.status) }}
              </span>
            </td>
            <td class="overflow-hidden px-2 py-2 align-middle text-center">
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
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
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
            <td class="overflow-hidden px-2 py-2 align-middle text-center">
              <template v-if="voucherMediaHref(t.payment_voucher)">
                <button
                  type="button"
                  class="inline-flex max-w-[5rem] flex-col items-center gap-1"
                  title="Ver comprobante de pago"
                  @click="
                    openMediaViewer(voucherMediaHref(t.payment_voucher), 'Comprobante de pago')
                  "
                >
                  <img
                    :src="voucherMediaHref(t.payment_voucher)"
                    alt=""
                    class="h-11 w-11 rounded border border-[#e5e7eb] bg-[#f3f4f6] object-cover"
                    loading="lazy"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
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
            <td
              class="sticky right-0 z-[1] bg-white px-2 py-3 text-center shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg border border-[#bcd7ff] bg-[#eef5ff] px-2.5 py-1.5 text-[11px] font-medium text-brasper-indigoStrong transition hover:bg-[#e2eeff] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="downloadingPdfId !== null"
                :title="`Descargar PDF de ${formatTransactionCodeForDisplay(t.code)}`"
                @click.stop="downloadPdf(t)"
              >
                <svg
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                  />
                </svg>
                {{ downloadingPdfId === (t.id ?? '') ? 'Generando…' : 'PDF' }}
              </button>
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
