<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { isAxiosError } from 'axios'
import { AppSpinner } from '@interface/widgets'
import { omieApi } from '../infrastructure/omie_api'
import type { OmieInvoiceList, OmieInvoiceListItem } from '../domain/models'

const statusLabels: Record<string, string> = {
  creating: 'Creando orden', validating: 'Validando orden', billing: 'Facturando',
  pending: 'En proceso', issued: 'Emitida', cancelled: 'Anulada', review_required: 'Revisar en Omie'
}
const status = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
const pageSize = ref(10)
const list = ref<OmieInvoiceList>({ items: [], total: 0, page: 1, page_size: 10, total_pages: 1 })
const loading = ref(false)
const error = ref('')
const selected = ref<OmieInvoiceListItem | null>(null)
const detailBusy = ref(false)
const detailError = ref('')
const pdfUrl = ref('')
let requestId = 0

const invalidRange = computed(() => Boolean(dateFrom.value && dateTo.value && dateFrom.value > dateTo.value))
const hasFilters = computed(() => Boolean(status.value || dateFrom.value || dateTo.value))
const totalPages = computed(() => Math.max(1, list.value.total_pages))
const inputClass = 'rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-[#c7d2fe]'

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short'
  }).format(new Date(value))
}

function money(value: string): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

function failureMessage(cause: unknown, fallback: string): string {
  const detail = isAxiosError(cause) ? cause.response?.data?.detail : null
  return typeof detail === 'string' ? detail : fallback
}

async function load() {
  if (invalidRange.value) return
  const current = ++requestId
  loading.value = true
  error.value = ''
  try {
    const data = await omieApi.listInvoices({
      page: page.value, pageSize: pageSize.value,
      status: status.value || undefined,
      dateFrom: dateFrom.value ? `${dateFrom.value}T00:00:00-05:00` : undefined,
      dateTo: dateTo.value ? `${dateTo.value}T23:59:59-05:00` : undefined
    })
    if (current === requestId) list.value = data
  } catch (cause) {
    if (current === requestId) error.value = failureMessage(cause, 'No se pudieron cargar las notas fiscales de Omie.')
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch([status, dateFrom, dateTo, pageSize], () => {
  if (page.value !== 1) page.value = 1
  else void load()
})
watch(page, () => void load())
onMounted(() => void load())

function clearFilters() {
  status.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}

function openDetail(item: OmieInvoiceListItem) {
  selected.value = item
  detailError.value = ''
  pdfUrl.value = ''
}

async function refresh() {
  if (!selected.value || detailBusy.value) return
  detailBusy.value = true
  detailError.value = ''
  try {
    const record = await omieApi.refresh(selected.value.transaction_id)
    const updated = { ...selected.value, ...record }
    selected.value = updated
    list.value = { ...list.value, items: list.value.items.map((item) =>
      item.transaction_id === updated.transaction_id ? updated : item) }
    pdfUrl.value = ''
  } catch (cause) {
    detailError.value = failureMessage(cause, 'No se pudo consultar el estado en Omie. Intenta más tarde.')
  } finally {
    detailBusy.value = false
  }
}

async function preparePdf() {
  if (!selected.value || detailBusy.value) return
  detailBusy.value = true
  detailError.value = ''
  try {
    pdfUrl.value = await omieApi.pdf(selected.value.transaction_id)
  } catch (cause) {
    detailError.value = failureMessage(cause, 'No se pudo obtener el PDF de la nota fiscal.')
  } finally {
    detailBusy.value = false
  }
}
</script>

<template>
  <div class="w-full min-w-0 max-w-full space-y-5">
    <div>
      <h2 class="text-lg font-semibold text-[#17243b]">Notas fiscales de servicio · Omie</h2>
      <p class="mt-1 text-sm text-[#617089]">Emisiones de Brasil para operaciones de reales a soles o dólares.</p>
    </div>

    <section class="rounded-xl border border-[#dbe4f4] bg-white p-4 sm:p-5" aria-label="Filtrar notas fiscales">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-[#17243b]">Filtrar notas fiscales</h3>
        <button v-if="hasFilters" type="button" class="text-sm font-medium text-brasper-indigoStrong hover:underline" @click="clearFilters">Limpiar filtros</button>
      </div>
      <div class="mt-4 flex flex-wrap items-end gap-3">
        <label class="space-y-1 text-xs font-medium text-[#4b5563]">Estado
          <select v-model="status" :class="inputClass" class="block">
            <option value="">Todos</option>
            <option v-for="(label, key) in statusLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-medium text-[#4b5563]">Registradas desde
          <input v-model="dateFrom" type="date" :class="inputClass" class="block" />
        </label>
        <label class="space-y-1 text-xs font-medium text-[#4b5563]">Hasta
          <input v-model="dateTo" type="date" :min="dateFrom || undefined" :class="inputClass" class="block" />
        </label>
        <AppSpinner v-if="loading" size="sm" label="Cargando notas…" />
      </div>
      <p v-if="invalidRange" role="alert" class="mt-3 text-sm text-red-700">La fecha inicial debe ser anterior o igual a la final.</p>
      <p v-else class="mt-3 text-xs text-[#617089]">{{ list.total }} registros encontrados</p>
    </section>

    <p v-if="error" role="alert" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</p>
    <div v-if="!invalidRange" class="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
      <table class="w-full min-w-[62rem] text-sm">
        <thead>
          <tr class="bg-[#dbeafe] text-left text-xs font-semibold text-brasper-indigoDark">
            <th class="px-4 py-3">NFS-e</th>
            <th class="px-4 py-3">Operación</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Emisor</th>
            <th class="px-4 py-3">Registrado (Lima)</th>
            <th class="px-4 py-3 text-right">Total</th>
            <th class="px-4 py-3 text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!list.items.length && !loading">
            <td colspan="7" class="px-6 py-12 text-center text-[#6b7280]">No hay notas fiscales con estos filtros. Los intentos nuevos se crean desde Movimientos.</td>
          </tr>
          <tr v-for="item in list.items" :key="item.transaction_id" tabindex="0" class="cursor-pointer border-t border-[#e5e7eb] hover:bg-[#f9fafb]" @click="openDetail(item)" @keydown.enter="openDetail(item)">
            <td class="px-4 py-3 font-mono font-medium">{{ item.nfse_number ? `NFS-e ${item.nfse_number}` : 'Pendiente de número' }}</td>
            <td class="px-4 py-3 font-mono">{{ item.transaction_code }}</td>
            <td class="max-w-[15rem] px-4 py-3"><span class="block truncate" :title="item.customer">{{ item.customer || '—' }}</span><span class="font-mono text-xs text-[#6b7280]">{{ item.document }}</span></td>
            <td class="max-w-[12rem] truncate px-4 py-3" :title="item.issuer">{{ item.issuer || '—' }}</td>
            <td class="whitespace-nowrap px-4 py-3">{{ dateTime(item.created_at) }}</td>
            <td class="px-4 py-3 text-right font-semibold tabular-nums">{{ money(item.total) }}</td>
            <td class="px-4 py-3 text-center"><span class="rounded-full px-2 py-1 text-xs font-medium" :class="item.status === 'issued' ? 'bg-emerald-50 text-emerald-800' : item.status === 'cancelled' || item.status === 'review_required' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'">{{ statusLabels[item.status] || item.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="!invalidRange" class="flex flex-wrap items-center justify-between gap-3 text-sm text-[#6b7280]">
      <label class="flex items-center gap-2">Registros por página
        <select v-model.number="pageSize" :class="inputClass" :disabled="loading">
          <option v-for="size in [10, 25, 50, 100]" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
      <span>{{ list.total }} registros · página {{ page }} de {{ totalPages }}</span>
      <div class="flex gap-2">
        <button type="button" class="rounded-lg border px-3 py-1.5 disabled:opacity-40" :disabled="loading || page <= 1" @click="page -= 1">Anterior</button>
        <button type="button" class="rounded-lg border px-3 py-1.5 disabled:opacity-40" :disabled="loading || page >= totalPages" @click="page += 1">Siguiente</button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="selected" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" @click.self="selected = null" @keydown.esc="selected = null">
        <section role="dialog" aria-modal="true" aria-label="Detalle de nota fiscal" class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-[#17243b]">{{ selected.nfse_number ? `NFS-e ${selected.nfse_number}` : 'Nota fiscal en proceso' }}</h2>
          <p class="mt-1 text-sm text-[#617089]">Operación {{ selected.transaction_code }} · {{ statusLabels[selected.status] || selected.status }}</p>
          <dl class="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt class="text-[#6b7280]">Cliente</dt><dd class="text-right">{{ selected.customer }}</dd>
            <dt class="text-[#6b7280]">CPF/CNPJ</dt><dd class="text-right font-mono">{{ selected.document }}</dd>
            <dt class="text-[#6b7280]">Emisor</dt><dd class="text-right">{{ selected.issuer }}</dd>
            <dt class="text-[#6b7280]">Servicio</dt><dd class="text-right">{{ selected.service }}</dd>
            <dt class="text-[#6b7280]">Orden de servicio</dt><dd class="text-right font-mono">{{ selected.os_id || '—' }}</dd>
            <dt class="text-[#6b7280]">Total</dt><dd class="text-right font-semibold">{{ money(selected.total) }}</dd>
          </dl>
          <p v-if="selected.error" class="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{{ selected.error }}</p>
          <p v-if="detailError" role="alert" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ detailError }}</p>
          <div class="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" class="rounded-lg border px-4 py-2 text-sm" @click="selected = null">Cerrar</button>
            <button type="button" class="rounded-lg border border-indigo-200 px-4 py-2 text-sm text-indigo-700 disabled:opacity-50" :disabled="detailBusy" @click="refresh">Consultar estado</button>
            <button v-if="['issued', 'cancelled'].includes(selected.status) && !pdfUrl" type="button" class="rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm text-white disabled:opacity-50" :disabled="detailBusy" @click="preparePdf">Preparar PDF</button>
            <a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener noreferrer" class="rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm text-white">Abrir PDF</a>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
