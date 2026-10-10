<script setup lang="ts">
/**
 * Emitir boleta o factura de una operación completada.
 *
 * Antes de enviar muestra lo que saldrá (vista previa del API, sin reservar
 * número): tipo, serie, adquirente e importes. El operador puede completar la
 * razón social, la dirección o el correo y corregir el documento del cliente.
 * Emitir no se puede deshacer: un comprobante aceptado solo se anula.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { AppSpinner } from '@interface/widgets'
import type { Invoice, InvoicePreview, IssueInvoiceInput } from '../../domain/models'
import { SUNAT_IDENTITY_LABELS, sunatIdentityLabel } from '../../domain/models'
import { billingErrorMessage, useBillingStore } from '../controllers/use_billing_store'
import { formatInvoiceMoney } from '../composables/billing_format'

const props = defineProps<{
  transactionId: string | null
  transactionCode?: string | null
}>()

const emit = defineEmits<{ issued: [invoice: Invoice] }>()
const open = defineModel<boolean>({ required: true })

const store = useBillingStore()

const preview = ref<InvoicePreview | null>(null)
const loadingPreview = ref(false)
const issuing = ref(false)
const error = ref<string | null>(null)
const showDocumentFix = ref(false)
/** Tipo elegido. Arranca con el que propone el API (RUC → factura) y el operador lo cambia. */
const documentType = ref<'01' | '03' | null>(null)
/** Empresa emisora elegida (BRASPER 21, INGENITECH…). Arranca en la de por defecto. */
const issuerRuc = ref<string | null>(null)
const issuers = computed(() => store.status?.issuers ?? [])
/** Documento original del cliente (antes de correcciones): decide si hace falta pedir RUC. */
const originalDocType = ref<string | null>(null)
const rucInput = ref('')
const form = reactive<Omit<Required<IssueInvoiceInput>, 'documentType' | 'issuerRuc'>>({
  customerName: '',
  customerAddress: '',
  customerEmail: '',
  customerDocType: '',
  customerDocNumber: ''
})

let previewTimer: ReturnType<typeof setTimeout> | null = null
let previewRequest = 0

function resetForm() {
  form.customerName = ''
  form.customerAddress = ''
  form.customerEmail = ''
  form.customerDocType = ''
  form.customerDocNumber = ''
  showDocumentFix.value = false
  error.value = null
  preview.value = null
  documentType.value = null
  issuerRuc.value = store.status?.defaultIssuerRuc ?? null
  originalDocType.value = null
  rucInput.value = ''
}

async function loadPreview() {
  if (!props.transactionId) return
  const requestId = ++previewRequest
  loadingPreview.value = true
  try {
    const result = await store.preview(props.transactionId, {
      ...form,
      documentType: documentType.value,
      issuerRuc: issuerRuc.value
    })
    if (requestId === previewRequest) {
      preview.value = result
      if (documentType.value === null) {
        documentType.value = result.documentType === '01' ? '01' : '03'
        originalDocType.value = result.customerDocType
      }
    }
  } catch (e) {
    if (requestId === previewRequest) {
      error.value = billingErrorMessage(e, 'No se pudo preparar el comprobante.')
    }
  } finally {
    if (requestId === previewRequest) loadingPreview.value = false
  }
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => void loadPreview(), 450)
}

watch(
  open,
  async (isOpen) => {
    if (isOpen) {
      if (!store.status) await store.loadStatus()
      resetForm()
      void loadPreview()
    }
  },
  { immediate: true }
)

function selectIssuer(ruc: string) {
  if (issuerRuc.value === ruc || issuing.value) return
  issuerRuc.value = ruc
  void loadPreview()
}

watch(form, () => {
  if (open.value) schedulePreview()
})

onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer)
})

const isProduction = computed(() => preview.value?.environment === 'production')
const isFactura = computed(() => documentType.value === '01')
/** Factura para un cliente sin RUC en su ficha: hay que pedir el RUC aquí. */
const needsRuc = computed(() => isFactura.value && originalDocType.value !== '6')

function selectDocumentType(type: '01' | '03') {
  if (documentType.value === type) return
  documentType.value = type
  if (type === '03' && form.customerDocType === '6' && originalDocType.value !== '6') {
    // Volver a boleta: se descarta el RUC que se pidió solo para la factura.
    form.customerDocType = ''
    form.customerDocNumber = ''
    rucInput.value = ''
  } else if (type === '01' && needsRuc.value && rucInput.value) {
    form.customerDocType = '6'
    form.customerDocNumber = rucInput.value
  }
  void loadPreview()
}

watch(rucInput, (value) => {
  if (!needsRuc.value) return
  const ruc = value.replace(/\D/g, '').slice(0, 11)
  if (ruc !== value) rucInput.value = ruc
  form.customerDocType = ruc ? '6' : ''
  form.customerDocNumber = ruc
})
const confirmLabel = computed(() => {
  if (!preview.value?.documentTypeLabel) return 'Emitir'
  return isFactura.value ? 'Emitir factura' : 'Emitir boleta'
})
const igvPercent = computed(() =>
  preview.value?.igvRate != null ? `${Math.round(preview.value.igvRate * 100)}%` : ''
)

function close() {
  if (issuing.value) return
  open.value = false
}

async function confirm() {
  if (!props.transactionId || !preview.value?.canIssue || issuing.value) return
  issuing.value = true
  error.value = null
  try {
    const invoice = await store.issue(props.transactionId, {
      ...form,
      documentType: documentType.value,
      issuerRuc: issuerRuc.value
    })
    open.value = false
    emit('issued', invoice)
  } catch (e) {
    error.value = billingErrorMessage(e, 'No se pudo emitir el comprobante.')
    void loadPreview()
  } finally {
    issuing.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

const inputClass =
  'w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none transition focus:border-brasper-indigoStrong focus:ring-2 focus:ring-[#c7d2fe]'
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-invoice-title"
      @click.self="close"
    >
      <div
        class="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-xl"
      >
        <header class="border-b border-[#eef0f4] px-6 pb-4 pt-5">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">
            Facturación electrónica
          </p>
          <h2 id="issue-invoice-title" class="mt-1 text-lg font-semibold text-[#1f2937]">
            {{ preview?.documentTypeLabel ?? 'Comprobante' }}
            <span v-if="transactionCode" class="font-normal text-[#6b7280]">
              · operación {{ transactionCode }}
            </span>
          </h2>
        </header>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div
            v-if="preview"
            class="rounded-xl border px-4 py-3 text-sm"
            :class="
              isProduction
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            "
          >
            <template v-if="isProduction">
              <strong>Producción.</strong> El comprobante tiene validez tributaria ante SUNAT. Una vez
              aceptado no se borra: solo se puede anular.
            </template>
            <template v-else>
              <strong>Desarrollo.</strong> Prueba con APISUNAT: SUNAT lo valida, pero no tiene validez
              tributaria.
            </template>
          </div>

          <fieldset v-if="issuers.length > 1" class="space-y-1.5">
            <legend class="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              Empresa emisora
            </legend>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                v-for="issuer in issuers"
                :key="issuer.ruc"
                type="button"
                role="radio"
                :aria-checked="issuerRuc === issuer.ruc"
                class="rounded-xl border px-3 py-2.5 text-left transition"
                :class="
                  issuerRuc === issuer.ruc
                    ? 'border-brasper-indigoStrong bg-[#eef5ff] ring-1 ring-brasper-indigoStrong'
                    : 'border-[#e5e7eb] bg-white hover:border-[#bcd7ff]'
                "
                :disabled="issuing"
                @click="selectIssuer(issuer.ruc)"
              >
                <span class="block text-sm font-semibold text-[#1f2937]">{{ issuer.name }}</span>
                <span class="block font-mono text-[11px] text-[#6b7280]">RUC {{ issuer.ruc }}</span>
                <span v-if="!issuer.configured" class="mt-0.5 block text-[11px] font-medium text-red-600">
                  Sin token de APISUNAT
                </span>
              </button>
            </div>
          </fieldset>

          <div
            v-if="documentType"
            class="grid grid-cols-2 gap-1 rounded-xl border border-[#dbe7fb] bg-[#f5f8ff] p-1"
            role="radiogroup"
            aria-label="Tipo de comprobante"
          >
            <button
              v-for="option in [
                { value: '03', label: 'Boleta', hint: 'Consumidor final (DNI, CE, pasaporte)' },
                { value: '01', label: 'Factura', hint: 'Empresa o persona con RUC' }
              ] as const"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="documentType === option.value"
              class="rounded-lg px-3 py-2 text-left transition"
              :class="
                documentType === option.value
                  ? 'bg-white text-brasper-indigoDark shadow-sm ring-1 ring-[#bcd7ff]'
                  : 'text-[#6b7280] hover:bg-white/60'
              "
              :disabled="issuing"
              @click="selectDocumentType(option.value)"
            >
              <span class="block text-sm font-semibold">{{ option.label }}</span>
              <span class="block text-[11px] leading-tight">{{ option.hint }}</span>
            </button>
          </div>

          <div v-if="loadingPreview && !preview" class="py-10">
            <AppSpinner center label="Preparando comprobante…" />
          </div>

          <template v-if="preview">
            <div
              v-if="!preview.canIssue && preview.reason"
              class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {{ preview.reason }}
            </div>

            <section v-if="preview.totalAmount != null" class="rounded-xl border border-[#dbe7fb] bg-[#f8fbff]">
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
                <template v-if="preview.issuerName">
                  <dt class="text-[#6b7280]">Emisor</dt>
                  <dd class="text-right text-[#1f2937]">
                    {{ preview.issuerName }}
                    <span class="font-mono text-xs text-[#6b7280]">· RUC {{ preview.issuerRuc }}</span>
                  </dd>
                </template>
                <dt class="text-[#6b7280]">Serie</dt>
                <dd class="text-right font-mono text-[#1f2937]">{{ preview.series }}-········</dd>
                <dt class="text-[#6b7280]">Detalle</dt>
                <dd class="text-right text-[#1f2937]">{{ preview.itemDescription }}</dd>
                <dt class="text-[#6b7280]">Valor de venta</dt>
                <dd class="text-right tabular-nums text-[#1f2937]">
                  {{ formatInvoiceMoney(preview.taxableAmount, preview.currency) }}
                </dd>
                <dt class="text-[#6b7280]">IGV {{ igvPercent }}</dt>
                <dd class="text-right tabular-nums text-[#1f2937]">
                  {{ formatInvoiceMoney(preview.igvAmount, preview.currency) }}
                </dd>
              </dl>
              <div class="flex items-baseline justify-between border-t border-[#dbe7fb] px-4 py-3">
                <span class="text-sm font-semibold text-[#1f2937]">Importe total</span>
                <span class="text-lg font-semibold tabular-nums text-brasper-indigoDark">
                  {{ formatInvoiceMoney(preview.totalAmount, preview.currency) }}
                </span>
              </div>
            </section>

            <section class="space-y-3">
              <div class="flex items-baseline justify-between gap-3">
                <h3 class="text-sm font-semibold text-[#1f2937]">Cliente</h3>
                <span class="text-xs text-[#6b7280]">
                  {{ sunatIdentityLabel(preview.customerDocType) }}
                  <span v-if="preview.customerDocNumber && preview.customerDocNumber !== '-'" class="font-mono">
                    {{ preview.customerDocNumber }}
                  </span>
                </span>
              </div>

              <label v-if="needsRuc" class="block space-y-1">
                <span class="text-xs font-medium text-[#4b5563]">RUC del cliente</span>
                <input
                  id="issue-invoice-ruc"
                  v-model="rucInput"
                  type="text"
                  inputmode="numeric"
                  maxlength="11"
                  :class="inputClass"
                  placeholder="11 dígitos, ej. 20123456789"
                />
              </label>

              <label class="block space-y-1">
                <span class="text-xs font-medium text-[#4b5563]">
                  {{ isFactura ? 'Razón social' : 'Nombre' }}
                </span>
                <input
                  id="issue-invoice-name"
                  v-model="form.customerName"
                  type="text"
                  maxlength="250"
                  :class="inputClass"
                  :placeholder="preview.customerName ?? ''"
                />
              </label>
              <label class="block space-y-1">
                <span class="text-xs font-medium text-[#4b5563]">
                  Dirección {{ isFactura ? 'fiscal' : '' }} <span class="text-[#9ca3af]">(opcional)</span>
                </span>
                <input
                  id="issue-invoice-address"
                  v-model="form.customerAddress"
                  type="text"
                  maxlength="250"
                  :class="inputClass"
                  :placeholder="preview.customerAddress ?? 'Sin dirección'"
                />
              </label>
              <label class="block space-y-1">
                <span class="text-xs font-medium text-[#4b5563]">
                  Correo <span class="text-[#9ca3af]">(opcional)</span>
                </span>
                <input
                  id="issue-invoice-email"
                  v-model="form.customerEmail"
                  type="email"
                  maxlength="255"
                  :class="inputClass"
                  :placeholder="preview.customerEmail ?? 'Sin correo'"
                />
              </label>

              <button
                v-if="!needsRuc"
                type="button"
                class="text-xs font-medium text-brasper-indigoStrong underline decoration-transparent hover:decoration-current"
                @click="showDocumentFix = !showDocumentFix"
              >
                {{ showDocumentFix ? 'Usar el documento del cliente' : 'Corregir documento del cliente' }}
              </button>
              <div v-if="showDocumentFix && !needsRuc" class="grid grid-cols-1 gap-3 sm:grid-cols-[11rem_1fr]">
                <select id="issue-invoice-doc-type" v-model="form.customerDocType" :class="inputClass">
                  <option value="">Tipo de documento</option>
                  <option v-for="(label, code) in SUNAT_IDENTITY_LABELS" :key="code" :value="code">
                    {{ label }}
                  </option>
                </select>
                <input
                  id="issue-invoice-doc-number"
                  v-model="form.customerDocNumber"
                  type="text"
                  maxlength="40"
                  inputmode="numeric"
                  :class="inputClass"
                  placeholder="Número (RUC: 11 dígitos → factura)"
                />
              </div>
            </section>
          </template>

          <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {{ error }}
          </p>
        </div>

        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef0f4] px-6 py-4">
          <span class="text-xs text-[#6b7280]">
            <AppSpinner v-if="loadingPreview && preview" size="sm" label="Actualizando…" />
          </span>
          <div class="flex gap-3">
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb] disabled:opacity-60"
              :disabled="issuing"
              @click="close"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!preview?.canIssue || issuing || loadingPreview"
              @click="confirm"
            >
              <AppSpinner v-if="issuing" size="sm" color-class="text-white" />
              {{ issuing ? 'Enviando a SUNAT…' : confirmLabel }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
