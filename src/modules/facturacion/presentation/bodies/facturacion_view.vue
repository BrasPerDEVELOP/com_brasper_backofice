<script setup lang="ts">
/**
 * Facturación electrónica: comprobantes emitidos vía APISUNAT (boletas y facturas
 * por la comisión cobrada). Para emitir, ir a Contabilidad → columna Comprobante.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { AppSpinner, PageHeader } from '@interface/widgets'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import type { Invoice } from '../../domain/models'
import { INVOICE_STATUSES, invoiceStatusMeta, isInvoicePending, sunatIdentityLabel } from '../../domain/models'
import { useBillingStore } from '../controllers/use_billing_store'
import { formatInvoiceMoney, formatLimaDateTime } from '../composables/billing_format'
import InvoiceStatusChip from '../components/InvoiceStatusChip.vue'
import InvoiceDetailDialog from '../components/InvoiceDetailDialog.vue'

defineOptions({ name: 'FacturacionView' })

const store = useBillingStore()
const authStore = useAuthStore()

const issuerFilter = ref('')
const statusFilter = ref('')
const documentTypeFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const perPage = 25
const page = ref(1)

const detailOpen = ref(false)
const detailId = ref<string | null>(null)

const canSeeAccounting = computed(() => authStore.hasPermission('accounting.view'))
const totalPages = computed(() => Math.max(1, Math.ceil(store.list.total / perPage)))
const status = computed(() => store.status)
const issuers = computed(() => status.value?.issuers ?? [])
const lastNumber = (issuerRuc: string, documentType: string) =>
  status.value?.series.find((s) => s.issuerRuc === issuerRuc && s.documentType === documentType)
    ?.lastNumber ?? 0

/** Límites del día en hora de Lima (UTC−5) para filtrar por fecha de emisión. */
function limaDayStart(day: string): string {
  return `${day}T00:00:00-05:00`
}
function limaDayEnd(day: string): string {
  return `${day}T23:59:59-05:00`
}

async function load() {
  await store.loadList({
    issuerRuc: issuerFilter.value || null,
    status: statusFilter.value || null,
    documentType: documentTypeFilter.value || null,
    dateFrom: dateFrom.value ? limaDayStart(dateFrom.value) : null,
    dateTo: dateTo.value ? limaDayEnd(dateTo.value) : null,
    skip: (page.value - 1) * perPage,
    limit: perPage
  })
}

watch([issuerFilter, statusFilter, documentTypeFilter, dateFrom, dateTo], () => {
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

onMounted(() => {
  void store.loadStatus()
  void load()
})

const inputClass =
  'rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-[#c7d2fe]'
</script>

<template>
  <div class="w-full min-w-0 max-w-full space-y-6">
    <PageHeader
      eyebrow="Contabilidad"
      title="Facturación electrónica"
      subtitle="Boletas y facturas por la comisión de cada operación, emitidas vía APISUNAT."
    >
      <template #actions>
        <RouterLink
          v-if="canSeeAccounting"
          to="/app/contabilidad"
          class="rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark"
        >
          Emitir desde Contabilidad
        </RouterLink>
      </template>
    </PageHeader>

    <!-- Configuración vigente: ambiente, emisor y correlativos. -->
    <section
      v-if="status"
      class="space-y-2 rounded-xl border px-4 py-3 text-sm"
      :class="
        !status.enabled
          ? 'border-[#e5e7eb] bg-[#f9fafb] text-[#4b5563]'
          : status.isProduction
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
      "
    >
      <p class="flex flex-wrap gap-x-6 gap-y-1">
        <span class="font-semibold">
          <template v-if="!status.enabled">Facturación apagada</template>
          <template v-else-if="status.isProduction">Producción · con validez tributaria</template>
          <template v-else>Desarrollo · pruebas sin validez tributaria</template>
        </span>
        <span>Emisión {{ status.autoIssue ? 'automática al finalizar' : 'manual' }}</span>
      </p>
      <ul class="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <li v-for="issuer in issuers" :key="issuer.ruc" class="min-w-0">
          <span class="font-medium">{{ issuer.name }}</span>
          <span class="font-mono text-xs"> · RUC {{ issuer.ruc }}</span>
          <span v-if="issuer.isDefault && issuers.length > 1" class="text-xs"> · por defecto</span>
          <span v-if="!issuer.configured" class="text-xs font-semibold text-red-700"> · sin token</span>
          <span class="block text-xs">
            Boletas <span class="font-mono">{{ status.seriesBoleta }}</span> (último
            {{ lastNumber(issuer.ruc, '03') }}) · Facturas
            <span class="font-mono">{{ status.seriesFactura }}</span> (último
            {{ lastNumber(issuer.ruc, '01') }})
          </span>
        </li>
      </ul>
    </section>
    <p v-else-if="store.statusError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ store.statusError }}
    </p>
    <p v-if="status && !status.enabled" class="text-sm text-[#6b7280]">
      Con la facturación apagada se pueden consultar comprobantes, pero no emitir. Se activa en el
      servidor con <code class="rounded bg-[#f3f4f6] px-1">BILLING_ENABLED=true</code>.
    </p>

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
        <input id="billing-filter-to" v-model="dateTo" type="date" :class="inputClass" />
      </label>
      <span v-if="store.listLoading" class="pb-2"><AppSpinner size="sm" label="Cargando…" /></span>
    </div>

    <p v-if="store.listError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ store.listError }}
    </p>

    <div class="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
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

    <div v-if="store.list.total > perPage" class="flex items-center justify-between text-sm text-[#6b7280]">
      <span>{{ store.list.total }} comprobantes · página {{ page }} de {{ totalPages }}</span>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg border border-[#e5e7eb] px-3 py-1.5 hover:bg-[#f3f4f6] disabled:opacity-40"
          :disabled="page <= 1"
          @click="page -= 1"
        >
          Anterior
        </button>
        <button
          type="button"
          class="rounded-lg border border-[#e5e7eb] px-3 py-1.5 hover:bg-[#f3f4f6] disabled:opacity-40"
          :disabled="page >= totalPages"
          @click="page += 1"
        >
          Siguiente
        </button>
      </div>
    </div>

    <InvoiceDetailDialog v-model="detailOpen" :invoice-id="detailId" @updated="() => void load()" />
  </div>
</template>
