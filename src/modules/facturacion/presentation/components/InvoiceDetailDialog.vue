<script setup lang="ts">
/**
 * Detalle de un comprobante: estado en SUNAT, errores u observaciones, archivos
 * (PDF, XML, CDR), historial y acciones (consultar, reintentar, anular).
 * Mientras espera a SUNAT se vuelve a leer sola cada 10 s.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { AppSpinner } from '@interface/widgets'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import type { Invoice } from '../../domain/models'
import {
  canRetryInvoice,
  canVoidInvoice,
  invoiceEventLabel,
  invoiceStatusMeta,
  isInvoicePending,
  sunatIdentityLabel
} from '../../domain/models'
import { billingErrorMessage, useBillingStore } from '../controllers/use_billing_store'
import { formatInvoiceMoney, formatLimaDateTime } from '../composables/billing_format'
import InvoiceStatusChip from './InvoiceStatusChip.vue'

const props = defineProps<{ invoiceId: string | null }>()
const emit = defineEmits<{ updated: [invoice: Invoice] }>()
const open = defineModel<boolean>({ required: true })

const store = useBillingStore()
const authStore = useAuthStore()

const invoice = ref<Invoice | null>(null)
const loading = ref(false)
const busy = ref<null | 'refresh' | 'retry' | 'void' | 'pdf'>(null)
const error = ref<string | null>(null)
const voidMode = ref(false)
const voidReason = ref('')

const canIssue = computed(() => authStore.hasPermission('billing.issue'))
const canVoid = computed(() => authStore.hasPermission('billing.void'))
const meta = computed(() => (invoice.value ? invoiceStatusMeta(invoice.value.status) : null))
const isProduction = computed(() => invoice.value?.environment === 'production')
const voidReasonValid = computed(() => {
  const length = voidReason.value.trim().length
  return length >= 3 && length <= 100
})

let pollTimer: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function syncPolling() {
  stopPolling()
  if (open.value && invoice.value && isInvoicePending(invoice.value.status)) {
    pollTimer = setInterval(() => void reload(true), 10_000)
  }
}

async function reload(silent = false) {
  if (!props.invoiceId) return
  if (!silent) loading.value = true
  try {
    const previousStatus = invoice.value?.status
    invoice.value = await store.getInvoice(props.invoiceId)
    if (!silent) error.value = null
    if (previousStatus && previousStatus !== invoice.value.status) emit('updated', invoice.value)
  } catch (e) {
    if (!silent) error.value = billingErrorMessage(e, 'No se pudo cargar el comprobante.')
  } finally {
    loading.value = false
    syncPolling()
  }
}

watch(
  [open, () => props.invoiceId],
  ([isOpen]) => {
    if (isOpen) {
      invoice.value = null
      voidMode.value = false
      voidReason.value = ''
      error.value = null
      void reload()
    } else {
      stopPolling()
    }
  },
  { immediate: true }
)

async function run(action: 'refresh' | 'retry' | 'void' | 'pdf') {
  if (!invoice.value || busy.value) return
  busy.value = action
  error.value = null
  try {
    if (action === 'pdf') {
      await store.openPdf(invoice.value)
      return
    }
    const current = invoice.value
    const result =
      action === 'refresh'
        ? await store.refresh(current.id)
        : action === 'retry'
          ? await store.retry(current.id)
          : await store.voidInvoice(current.id, voidReason.value)
    invoice.value = result.id === current.id ? result : await store.getInvoice(result.id)
    voidMode.value = false
    emit('updated', invoice.value)
  } catch (e) {
    error.value = billingErrorMessage(
      e,
      action === 'pdf' ? 'No se pudo descargar el PDF.' : 'La acción no se completó.'
    )
  } finally {
    busy.value = null
    syncPolling()
  }
}

function close() {
  if (busy.value && busy.value !== 'pdf') return
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}
watch(
  open,
  (isOpen) => {
    if (isOpen) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  stopPolling()
  document.removeEventListener('keydown', onKeydown)
})

const actionButton =
  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-detail-title"
      @click.self="close"
    >
      <aside class="flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b border-[#eef0f4] px-6 py-5">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">
              {{ invoice?.documentTypeLabel ?? 'Comprobante' }}
            </p>
            <h2 id="invoice-detail-title" class="mt-1 font-mono text-xl font-semibold text-[#1f2937]">
              {{ invoice?.fullNumber ?? '—' }}
            </h2>
            <div v-if="invoice" class="mt-2 flex flex-wrap items-center gap-2">
              <InvoiceStatusChip :status="invoice.status" size="md" />
              <span
                class="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                :class="
                  isProduction
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                "
              >
                {{ isProduction ? 'PRODUCCIÓN' : 'DESARROLLO' }}
              </span>
            </div>
          </div>
          <button
            type="button"
            class="rounded-lg p-2 text-[#6b7280] transition hover:bg-[#f3f4f6]"
            aria-label="Cerrar"
            @click="close"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div v-if="loading && !invoice" class="py-16">
            <AppSpinner center label="Cargando comprobante…" />
          </div>

          <template v-if="invoice && meta">
            <p class="text-sm text-[#4b5563]">{{ meta.hint }}</p>

            <div
              v-if="invoice.faults.length || invoice.lastError"
              class="space-y-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              <p class="font-semibold">{{ invoice.faults.length ? 'Errores de SUNAT' : 'Último error' }}</p>
              <ul v-if="invoice.faults.length" class="list-disc space-y-0.5 pl-5">
                <li v-for="(fault, i) in invoice.faults" :key="i">{{ fault }}</li>
              </ul>
              <p v-else class="break-words">{{ invoice.lastError }}</p>
            </div>

            <div
              v-if="invoice.notes.length"
              class="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <p class="font-semibold">Observaciones de SUNAT</p>
              <ul class="list-disc space-y-0.5 pl-5">
                <li v-for="(note, i) in invoice.notes" :key="i">{{ note }}</li>
              </ul>
            </div>

            <section class="rounded-xl border border-[#dbe7fb] bg-[#f8fbff]">
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
                <dt class="text-[#6b7280]">Valor de venta</dt>
                <dd class="text-right tabular-nums">{{ formatInvoiceMoney(invoice.taxableAmount, invoice.currency) }}</dd>
                <dt class="text-[#6b7280]">IGV {{ Math.round(invoice.igvRate * 100) }}%</dt>
                <dd class="text-right tabular-nums">{{ formatInvoiceMoney(invoice.igvAmount, invoice.currency) }}</dd>
              </dl>
              <div class="flex items-baseline justify-between border-t border-[#dbe7fb] px-4 py-3">
                <span class="text-sm font-semibold">Importe total</span>
                <span class="text-lg font-semibold tabular-nums text-brasper-indigoDark">
                  {{ formatInvoiceMoney(invoice.totalAmount, invoice.currency) }}
                </span>
              </div>
            </section>

            <section>
              <h3 class="mb-2 text-sm font-semibold text-[#1f2937]">Cliente</h3>
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt class="text-[#6b7280]">Emisor</dt>
                <dd class="text-right">
                  {{ invoice.issuerName }}
                  <span class="block font-mono text-xs text-[#6b7280]">RUC {{ invoice.issuerRuc }}</span>
                </dd>
                <dt class="text-[#6b7280]">{{ sunatIdentityLabel(invoice.customerDocType) }}</dt>
                <dd class="text-right font-mono">{{ invoice.customerDocNumber }}</dd>
                <dt class="text-[#6b7280]">Nombre</dt>
                <dd class="text-right">{{ invoice.customerName }}</dd>
                <template v-if="invoice.customerAddress">
                  <dt class="text-[#6b7280]">Dirección</dt>
                  <dd class="text-right">{{ invoice.customerAddress }}</dd>
                </template>
                <template v-if="invoice.customerEmail">
                  <dt class="text-[#6b7280]">Correo</dt>
                  <dd class="break-all text-right">{{ invoice.customerEmail }}</dd>
                </template>
                <dt class="text-[#6b7280]">Emisión</dt>
                <dd class="text-right">{{ formatLimaDateTime(invoice.issueDate) }}</dd>
                <template v-if="invoice.acceptedAt">
                  <dt class="text-[#6b7280]">Aceptado</dt>
                  <dd class="text-right">{{ formatLimaDateTime(invoice.acceptedAt) }}</dd>
                </template>
                <template v-if="invoice.voidReason">
                  <dt class="text-[#6b7280]">Motivo de anulación</dt>
                  <dd class="text-right">{{ invoice.voidReason }}</dd>
                </template>
              </dl>
            </section>

            <section v-if="invoice.status === 'accepted' || invoice.xmlUrl || invoice.cdrUrl">
              <h3 class="mb-2 text-sm font-semibold text-[#1f2937]">Archivos</h3>
              <div class="flex flex-wrap gap-2">
                <button
                  v-if="invoice.status === 'accepted' || invoice.status === 'voided'"
                  type="button"
                  :class="[actionButton, 'border-[#bcd7ff] bg-[#eef5ff] text-brasper-indigoStrong hover:bg-[#e2eeff]']"
                  :disabled="busy !== null"
                  @click="run('pdf')"
                >
                  <AppSpinner v-if="busy === 'pdf'" size="sm" />
                  Descargar PDF
                </button>
                <a
                  v-if="invoice.xmlUrl"
                  :href="invoice.xmlUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  :class="[actionButton, 'border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]']"
                >
                  XML firmado
                </a>
                <a
                  v-if="invoice.cdrUrl"
                  :href="invoice.cdrUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  :class="[actionButton, 'border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]']"
                >
                  CDR de SUNAT
                </a>
              </div>
            </section>

            <section v-if="voidMode" class="space-y-2 rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
              <label for="invoice-void-reason" class="block text-sm font-semibold text-red-800">
                Motivo de la anulación
              </label>
              <input
                id="invoice-void-reason"
                v-model="voidReason"
                type="text"
                maxlength="100"
                class="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                placeholder="Ej. Error en el monto de la comisión"
              />
              <p class="text-xs text-red-700">
                Entre 3 y 100 caracteres. La anulación se comunica a SUNAT y no se puede revertir.
              </p>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  :class="[actionButton, 'border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-[#f9fafb]']"
                  :disabled="busy === 'void'"
                  @click="voidMode = false"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  :class="[actionButton, 'border-transparent bg-brasper-danger text-white hover:opacity-90']"
                  :disabled="!voidReasonValid || busy !== null"
                  @click="run('void')"
                >
                  <AppSpinner v-if="busy === 'void'" size="sm" color-class="text-white" />
                  Anular comprobante
                </button>
              </div>
            </section>

            <section v-if="invoice.events.length">
              <h3 class="mb-2 text-sm font-semibold text-[#1f2937]">Historial</h3>
              <ol class="space-y-2 border-l border-[#e5e7eb] pl-4">
                <li v-for="event in invoice.events" :key="event.id" class="relative text-sm">
                  <span class="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#c7d2fe]" aria-hidden="true" />
                  <span class="font-medium text-[#374151]">{{ invoiceEventLabel(event.event) }}</span>
                  <span class="ml-2 text-xs text-[#9ca3af]">{{ formatLimaDateTime(event.createdAt) }}</span>
                </li>
              </ol>
            </section>
          </template>

          <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {{ error }}
          </p>
        </div>

        <footer v-if="invoice" class="flex flex-wrap justify-end gap-2 border-t border-[#eef0f4] px-6 py-4">
          <button
            v-if="invoice.status === 'sent'"
            type="button"
            :class="[actionButton, 'border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]']"
            :disabled="busy !== null"
            title="Pregunta a SUNAT ahora, sin esperar la consulta automática"
            @click="run('refresh')"
          >
            <AppSpinner v-if="busy === 'refresh'" size="sm" />
            Consultar SUNAT
          </button>
          <button
            v-if="canIssue && canRetryInvoice(invoice.status)"
            type="button"
            :class="[actionButton, 'border-transparent bg-brasper-indigoStrong text-white hover:bg-brasper-indigoDark']"
            :disabled="busy !== null"
            :title="invoice.status === 'rejected' ? 'Emite un comprobante nuevo con el siguiente número' : 'Reenvía con el mismo número'"
            @click="run('retry')"
          >
            <AppSpinner v-if="busy === 'retry'" size="sm" color-class="text-white" />
            {{ invoice.status === 'rejected' ? 'Emitir de nuevo' : 'Reintentar' }}
          </button>
          <button
            v-if="canVoid && canVoidInvoice(invoice.status) && !voidMode"
            type="button"
            :class="[actionButton, 'border-red-200 bg-white text-red-700 hover:bg-red-50']"
            :disabled="busy !== null"
            @click="voidMode = true"
          >
            Anular
          </button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
