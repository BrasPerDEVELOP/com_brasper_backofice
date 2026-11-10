<script setup lang="ts">
/**
 * Facturación electrónica: comprobantes emitidos vía APISUNAT (boletas y facturas
 * por la comisión cobrada). Para emitir, ir a Contabilidad → columna Comprobante.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AppSpinner } from '@interface/widgets'
import type { Invoice } from '../../domain/models'
import { INVOICE_STATUSES, invoiceStatusMeta, isInvoicePending, sunatIdentityLabel } from '../../domain/models'
import { useBillingStore } from '../controllers/use_billing_store'
import { BillingApiAdapter } from '../../infrastructure/adapters/billing_api_adapter'
import { formatInvoiceMoney, formatLimaDateTime } from '../composables/billing_format'
import InvoiceStatusChip from '../components/InvoiceStatusChip.vue'
import InvoiceDetailDialog from '../components/InvoiceDetailDialog.vue'

defineOptions({ name: 'FacturacionView' })

const store = useBillingStore()

const issuerFilter = ref('')
const exportIssuer = ref('')
const statusFilter = ref('')
const documentTypeFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const limaMonthParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
const exportMonth = ref(`${limaMonthParts.find((part) => part.type === 'year')?.value}-${limaMonthParts.find((part) => part.type === 'month')?.value}`)
const exportLoading = ref(false)
const exportError = ref('')
const perPage = ref(10)
const page = ref(1)

const detailOpen = ref(false)
const detailId = ref<string | null>(null)

const totalPages = computed(() => store.list.totalPages ?? 1)
const status = computed(() => store.status)
const issuers = computed(() => status.value?.issuers ?? [])
const invalidDateRange = computed(() => Boolean(dateFrom.value && dateTo.value && dateFrom.value > dateTo.value))
const hasFilters = computed(() => Boolean(issuerFilter.value || statusFilter.value || documentTypeFilter.value || dateFrom.value || dateTo.value))
function clearFilters() {
  issuerFilter.value = ''
  statusFilter.value = ''
  documentTypeFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}
/** Límites del día en hora de Lima (UTC−5) para filtrar por fecha de emisión. */
function limaDayStart(day: string): string {
  return `${day}T00:00:00-05:00`
}
function limaDayEnd(day: string): string {
  return `${day}T23:59:59-05:00`
}

async function load() {
  if (invalidDateRange.value) return
  await store.loadList({
    issuerRuc: issuerFilter.value || null,
    status: statusFilter.value || null,
    documentType: documentTypeFilter.value || null,
    dateFrom: dateFrom.value ? limaDayStart(dateFrom.value) : null,
    dateTo: dateTo.value ? limaDayEnd(dateTo.value) : null,
    page: page.value,
    pageSize: perPage.value
  })
}

watch([issuerFilter, statusFilter, documentTypeFilter, dateFrom, dateTo, perPage], () => {
  if (page.value !== 1) page.value = 1
  else void load()
})
watch(page, () => void load())

/** Si hay comprobantes esperando a SUNAT, refresca el listado cada 15 s. */
let pollTimer: ReturnType<typeof setInterval> | null = null
watch(
  () => store.list.items.some((item) => isInvoicePending(item.status)),
  (hasPending) => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = hasPending ? setInterval(() => void load(), 15_000) : null
  }
)
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})

function openDetail(invoice: Invoice) {
  detailId.value = invoice.id
  detailOpen.value = true
}

async function downloadMonth() {
  exportError.value = ''
  exportLoading.value = true
  try {
    const blob = await new BillingApiAdapter().downloadMonth(exportMonth.value, exportIssuer.value)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `comprobantes-sunat-${exportMonth.value}.zip`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    exportError.value = 'No se pudo descargar el mes. Comprueba que haya comprobantes y vuelve a intentar.'
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  void store.loadStatus()
  void load()
})

const inputClass =
  'rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-[#c7d2fe]'
</script>

<template>
  <div class="w-full min-w-0 max-w-full space-y-6">
    <p v-if="store.statusError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ store.statusError }}
    </p>
    <p v-if="status && !status.enabled" class="text-sm text-[#6b7280]">
      Con la facturación apagada se pueden consultar comprobantes, pero no emitir. Se activa en el
      servidor con <code class="rounded bg-[#f3f4f6] px-1">BILLING_ENABLED=true</code>.
    </p>

    <section class="rounded-xl border border-[#dbe4f4] bg-white p-4 sm:p-5" aria-labelledby="billing-export-title">
      <div class="mb-4">
        <h2 id="billing-export-title" class="text-sm font-semibold text-[#17243b]">Descarga mensual de comprobantes</h2>
        <p class="mt-1 text-xs text-[#617089]">Un ZIP con PDF, XML firmado y CDR de los comprobantes SUNAT del mes.</p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
      <label class="space-y-1">
        <span class="block text-xs font-medium text-[#4b5563]">Mes para descargar</span>
        <input v-model="exportMonth" type="month" :class="inputClass" />
      </label>
      <label v-if="issuers.length > 1" class="space-y-1">
        <span class="block text-xs font-medium text-[#4b5563]">Empresa</span>
        <select v-model="exportIssuer" :class="inputClass">
          <option value="">Todas las empresas</option>
          <option v-for="issuer in issuers" :key="issuer.ruc" :value="issuer.ruc">{{ issuer.name }}</option>
        </select>
      </label>
      <button type="button" :disabled="exportLoading || !exportMonth" class="rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-50" @click="downloadMonth">
        {{ exportLoading ? 'Preparando ZIP…' : 'Descargar ZIP del mes' }}
      </button>
      </div>
      <p v-if="exportError" role="alert" class="mt-3 text-sm text-red-700">{{ exportError }}</p>
    </section>

    <section class="rounded-xl border border-[#dbe4f4] bg-white p-4 sm:p-5" aria-labelledby="billing-filters-title">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="billing-filters-title" class="text-sm font-semibold text-[#17243b]">Filtrar comprobantes</h2>
        <button v-if="hasFilters" type="button" class="text-sm font-medium text-brasper-indigoStrong hover:underline" @click="clearFilters">Limpiar filtros</button>
      </div>
      <div class="flex flex-wrap items-end gap-3">
      <label v-if="issuers.length > 1" class="space-y-1">
        <span class="block text-xs font-medium text-[#4b5563]">Empresa</span>
        <select id="billing-filter-issuer" v-model="issuerFilter" :class="inputClass">
          <option value="">Todas</option>
          <option v-for="issuer in issuers" :key="issuer.ruc" :value="issuer.ruc">{{ issuer.name }}</option>
        </select>
      </label>
      <label class="space-y-1">
        <span class="block text-xs font-medium text-[#4b5563]">Estado</span>
        <select id="billing-filter-status" v-model="statusFilter" :class="inputClass">
          <option value="">Todos</option>
          <option v-for="s in INVOICE_STATUSES" :key="s" :value="s">{{ invoiceStatusMeta(s).label }}</option>
        </select>
      </label>
      <label class="space-y-1">
        <span class="block text-xs font-medium text-[#4b5563]">Tipo</span>
        <select id="billing-filter-type" v-model="documentTypeFilter" :class="inputClass">
          <option value="">Boletas y facturas</option>
          <option value="03">Boletas</option>
          <option value="01">Facturas</option>
        </select>
      </label>
      <label class="space-y-1">
        <span class="block text-xs font-medium text-[#4b5563]">Emitidos desde</span>
        <input id="billing-filter-from" v-model="dateFrom" type="date" :class="inputClass" />
      </label>
      <label class="space-y-1">
        <span class="block text-xs font-medium text-[#4b5563]">Hasta</span>
        <input id="billing-filter-to" v-model="dateTo" type="date" :min="dateFrom || undefined" :class="inputClass" />
      </label>
      <span v-if="store.listLoading" class="pb-2"><AppSpinner size="sm" label="Cargando…" /></span>
      </div>
      <p v-if="invalidDateRange" role="alert" class="mt-3 text-sm text-red-700">La fecha «Desde» debe ser anterior o igual a «Hasta».</p>
      <p v-else class="mt-3 text-xs text-[#617089]">{{ store.list.total }} comprobantes encontrados</p>
    </section>

    <p v-if="store.listError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ store.listError }}
    </p>

    <div v-if="!invalidDateRange" class="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
      <table class="w-full min-w-[64rem] text-sm">
        <thead>
          <tr class="bg-[#dbeafe] text-left text-xs font-semibold text-brasper-indigoDark">
            <th class="px-4 py-3">Comprobante</th>
            <th class="px-4 py-3">Emisor</th>
            <th class="px-4 py-3">Emisión (Lima)</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3 text-right">Valor de venta</th>
            <th class="px-4 py-3 text-right">IGV</th>
            <th class="px-4 py-3 text-right">Total</th>
            <th class="px-4 py-3 text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!store.list.items.length && !store.listLoading">
            <td colspan="8" class="px-6 py-12 text-center text-[#6b7280]">
              No hay comprobantes con estos filtros. Se emiten desde Contabilidad, en la columna
              «Comprobante SUNAT» de cada operación finalizada.
            </td>
          </tr>
          <tr
            v-for="invoice in store.list.items"
            :key="invoice.id"
            class="cursor-pointer border-t border-[#e5e7eb] transition hover:bg-[#f9fafb]"
            tabindex="0"
            @click="openDetail(invoice)"
            @keydown.enter="openDetail(invoice)"
          >
            <td class="px-4 py-3">
              <span class="block font-mono font-medium text-[#1f2937]">{{ invoice.fullNumber }}</span>
              <span class="text-xs text-[#6b7280]">{{ invoice.documentTypeLabel }}</span>
            </td>
            <td class="max-w-[12rem] px-4 py-3">
              <span class="block truncate text-[#1f2937]" :title="invoice.issuerName">{{ invoice.issuerName }}</span>
              <span class="font-mono text-xs text-[#6b7280]">{{ invoice.issuerRuc }}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-[#374151]">{{ formatLimaDateTime(invoice.issueDate) }}</td>
            <td class="max-w-[16rem] px-4 py-3">
              <span class="block truncate text-[#1f2937]" :title="invoice.customerName">{{ invoice.customerName }}</span>
              <span class="text-xs text-[#6b7280]">
                {{ sunatIdentityLabel(invoice.customerDocType) }}
                <span v-if="invoice.customerDocNumber !== '-'" class="font-mono">{{ invoice.customerDocNumber }}</span>
              </span>
            </td>
            <td class="px-4 py-3 text-right tabular-nums">{{ formatInvoiceMoney(invoice.taxableAmount, invoice.currency) }}</td>
            <td class="px-4 py-3 text-right tabular-nums">{{ formatInvoiceMoney(invoice.igvAmount, invoice.currency) }}</td>
            <td class="px-4 py-3 text-right font-semibold tabular-nums">{{ formatInvoiceMoney(invoice.totalAmount, invoice.currency) }}</td>
            <td class="px-4 py-3 text-center"><InvoiceStatusChip :status="invoice.status" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!invalidDateRange" class="flex flex-wrap items-center justify-between gap-3 text-sm text-[#6b7280]">
      <label class="flex items-center gap-2">
        Comprobantes por página
        <select v-model.number="perPage" :class="inputClass" :disabled="store.listLoading">
          <option v-for="size in [10, 25, 50, 100]" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
      <span>{{ store.list.total }} comprobantes · página {{ page }} de {{ totalPages }}</span>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg border border-[#e5e7eb] px-3 py-1.5 hover:bg-[#f3f4f6] disabled:opacity-40"
          :disabled="store.listLoading || page <= 1"
          @click="page -= 1"
        >
          Anterior
        </button>
        <button
          type="button"
          class="rounded-lg border border-[#e5e7eb] px-3 py-1.5 hover:bg-[#f3f4f6] disabled:opacity-40"
          :disabled="store.listLoading || page >= totalPages"
          @click="page += 1"
        >
          Siguiente
        </button>
      </div>
    </div>

    <InvoiceDetailDialog v-model="detailOpen" :invoice-id="detailId" @updated="() => void load()" />
  </div>
</template>
