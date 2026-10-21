<script setup lang="ts">
import { computed, ref, toRefs } from 'vue'
import type { Transaction } from '../../domain/models'
import { resolveTransactionStatusForDisplay } from '../../domain/models'
import { Domain } from '@/interface/infrastructure/services'
import { useTransactionPreviewController } from '../controllers/use_transaction_preview_controller'
import { getTransactionStatusRowBadgeClass as statusRowBadgeClass } from '../composables/use_transaction_status_labels'
const props = withDefaults(defineProps<{
  showPreviewModal: boolean
  previewTransaction: Transaction | null
  previewLoading: boolean
  previewDetailWarning?: string
  canUpdateTransactions?: boolean
}>(), { previewDetailWarning: '', canUpdateTransactions: false })
const { previewTransaction } = toRefs(props)
const emit = defineEmits<{
  close: []
  edit: []
  media: [source: string, title: string]
}>()
const closePreviewModal = () => emit('close')
const openEditFromPreview = () => emit('edit')
const openMediaViewer = (source: string, title: string) => emit('media', source, title)
const { buildPreviewSections, buildPreviewDestinations } = useTransactionPreviewController()
type VoucherField = 'send_voucher' | 'payment_voucher' | 'checked_image'
type VoucherFormValue = string | File
const isFileValue = (value: unknown): value is File => value instanceof File
const previewSections = computed(() => {
  const t = previewTransaction.value
  if (!t) return []
  return buildPreviewSections(t)
})

/** Cuentas destino estructuradas para el preview (multicuentas con titular visible). */
const previewDestinations = computed(() => {
  const t = previewTransaction.value
  if (!t) return { rows: [], totalLabel: '—' }
  return buildPreviewDestinations(t)
})

const copiedPreviewAccountIdentifier = ref('')

async function copyPreviewAccountIdentifier(value: string) {
  if (!value) return
  await navigator.clipboard.writeText(value)
  copiedPreviewAccountIdentifier.value = value
  window.setTimeout(() => {
    if (copiedPreviewAccountIdentifier.value === value) {
      copiedPreviewAccountIdentifier.value = ''
    }
  }, 1500)
}

const previewSectionGroups = computed(() => {
  const s = previewSections.value
  return {
    resumen: s.find((sec) => sec.id === 'resumen') ?? null,
    left: s.filter((sec) => ['participantes', 'condiciones'].includes(sec.id)),
    right: s.filter((sec) => ['importes', 'fechas'].includes(sec.id)),
    bottom: s.filter((sec) => ['registro', 'extra'].includes(sec.id))
  }
})

type PreviewVoucherEntry = {
  href: string
  label: string
  isImage: boolean
}

type PreviewVoucherGroup = {
  key: VoucherField
  title: string
  entries: PreviewVoucherEntry[]
}

/** Comprobantes del preview: TODAS las imágenes de cada grupo (no solo la primera). */
const previewVoucherGroups = computed<PreviewVoucherGroup[]>(() => {
  const t = previewTransaction.value
  if (!t) return []
  const groups: Array<{ key: VoucherField; title: string }> = [
    { key: 'send_voucher', title: 'Voucher envío' },
    { key: 'payment_voucher', title: 'Voucher pago' },
    { key: 'checked_image', title: 'Checklist verificación' }
  ]
  return groups
    .map(({ key, title }) => ({
      key,
      title,
      entries: transactionVoucherValues(t, key)
        .filter((value): value is string => typeof value === 'string')
        .map((value) => ({
          href: voucherMediaHref(value),
          label: getVoucherLabel(value),
          isImage: isImagePath(value)
        }))
    }))
    .filter((group) => group.entries.length > 0)
})

const previewVoucherTotal = computed(() =>
  previewVoucherGroups.value.reduce((sum, group) => sum + group.entries.length, 0)
)

function voucherMediaHref(path: unknown): string {
  if (Array.isArray(path)) {
    const first = voucherValues(path).find((value): value is string => typeof value === 'string')
    return first ? voucherMediaHref(first) : ''
  }
  if (path == null || typeof path !== 'string') return ''
  const s = path.trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://')) return Domain.ensureHttpsUrl(s)
  if (s.startsWith('/') || s.startsWith('media/') || s.includes('/')) {
    return Domain.mediaUrl(s)
  }
  // Los vouchers pueden venir solo con nombre de archivo; no deben caer en
  // `profile_images`, sino resolverse directamente bajo `/media/`.
  return Domain.mediaUrl(`media/${s}`)
}


function getVoucherLabel(v: unknown): string {
  const values = voucherValues(v)
  if (values.length > 1) return `${values.length} archivos`
  if (values.length === 1 && values[0] !== v) return getVoucherLabel(values[0])
  if (isFileValue(v)) {
    return v.name
  }
  if (typeof v === 'string' && v.trim()) {
    const clean = v.trim().split('?')[0]?.split('#')[0] ?? ''
    return clean.split('/').filter(Boolean).pop() ?? 'Imagen actual'
  }
  return 'Archivo seleccionado'
}

function voucherValues(value: unknown): VoucherFormValue[] {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.flatMap((item) => voucherValues(item))
  if (isFileValue(value)) return [value]
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function transactionVoucherValues(
  transaction: Transaction | null | undefined,
  field: VoucherField
): VoucherFormValue[] {
  if (!transaction) return []
  const rec = transaction as Record<string, unknown>
  // El parser ya fusiona singular+plural en `field`; el API además conserva
  // `${field}s` crudo. Sin dedupe cada archivo aparecería dos veces.
  const seen = new Set<string>()
  return voucherValues([rec[field], rec[`${field}s`], rec[`${field}_files`]]).filter((value) => {
    if (typeof value !== 'string') return true
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}


function isImagePath(path: string): boolean {
  const clean = path.trim().split('?')[0]?.split('#')[0]?.toLowerCase() ?? ''
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'].some((ext) =>
    clean.endsWith(ext)
  )
}


</script>

<template>
    <!-- Modal Previsualizar -->
    <Teleport to="body">
      <div
        v-if="showPreviewModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      >
        <div
          class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#d8e5fb] bg-white shadow-xl"
        >
          <!-- Cabecera -->
          <div
            class="flex items-center justify-between border-b border-[#e5e7eb] bg-[#fafbfc] px-6 py-4"
          >
            <div>
              <h2 class="text-lg font-semibold text-[#1f2937]">Previsualizar transacción</h2>
              <p class="mt-0.5 text-xs text-[#6b7280]">
                Datos resueltos con tasas, comisiones y cuentas del backoffice
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6]"
              aria-label="Cerrar"
              @click="closePreviewModal"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Cuerpo -->
          <div class="flex-1 overflow-y-auto">
            <p
              v-if="previewLoading"
              class="flex items-center justify-center gap-2 py-12 text-sm text-[#6b7280]"
            >
              <span
                class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brasper-indigoStrong border-t-transparent"
              />
              Cargando detalle de la transacción…
            </p>

            <template v-else-if="previewTransaction">
              <div v-if="previewTransaction.observaciones" class="whitespace-pre-wrap rounded border p-4 text-sm"><strong>Observaciones</strong><p>{{ previewTransaction.observaciones }}</p></div>
              <div
                v-if="previewDetailWarning"
                class="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                role="status"
              >
                {{ previewDetailWarning }}
              </div>

              <!-- Hero: código, estado y verificación -->
              <div
                v-if="previewSectionGroups.resumen"
                class="border-b border-[#e8eef8] bg-gradient-to-r from-[#f0f4ff] to-[#f8faff] px-6 py-5"
              >
                <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">
                      Código
                    </p>
                    <p class="font-mono text-2xl font-bold text-brasper-indigoStrong leading-tight">
                      {{
                        previewSectionGroups.resumen.items.find((i) => i.label === 'Código')
                          ?.value ?? '—'
                      }}
                    </p>
                  </div>
                  <div class="hidden h-10 w-px bg-[#d1d5db] sm:block" />
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">
                      Estado
                    </p>
                    <span
                      class="mt-1 inline-flex rounded-full px-3 py-1 text-sm font-semibold"
                      :class="
                        statusRowBadgeClass(
                          resolveTransactionStatusForDisplay(previewTransaction) ??
                            previewTransaction.status
                        )
                      "
                    >
                      {{
                        previewSectionGroups.resumen.items.find((i) => i.label === 'Estado')
                          ?.value ?? '—'
                      }}
                    </span>
                  </div>
                  <div class="hidden h-10 w-px bg-[#d1d5db] sm:block" />
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">
                      Verificada
                    </p>
                    <span
                      class="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
                      :class="
                        previewSectionGroups.resumen.items.find((i) => i.label === 'Verificada')
                          ?.value === 'Sí'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-600'
                      "
                    >
                      <svg
                        v-if="
                          previewSectionGroups.resumen.items.find((i) => i.label === 'Verificada')
                            ?.value === 'Sí'
                        "
                        class="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {{
                        previewSectionGroups.resumen.items.find((i) => i.label === 'Verificada')
                          ?.value ?? '—'
                      }}
                    </span>
                  </div>
                  <div class="hidden h-10 w-px bg-[#d1d5db] sm:block" />
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">
                      Ventas / asesor
                    </p>
                    <p class="mt-1 text-sm font-semibold text-[#111827]">
                      {{
                        previewSectionGroups.resumen.items.find(
                          (i) => i.label === 'Ventas / asesor'
                        )?.value ?? '—'
                      }}
                    </p>
                  </div>
                  <div class="hidden h-10 w-px bg-[#d1d5db] sm:block" />
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">
                      N.º operación
                    </p>
                    <p class="mt-1 font-mono text-sm font-semibold tabular-nums text-[#111827]">
                      {{
                        previewSectionGroups.resumen.items.find((i) => i.label === 'N.º operación')
                          ?.value ?? '—'
                      }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Grid principal: izquierda / derecha -->
              <div class="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-[#e8eef8]">
                <!-- Columna izquierda: Participantes + Cuentas destino + Condiciones -->
                <div class="space-y-4 p-5">
                  <section
                    v-for="section in previewSectionGroups.left.filter(
                      (s) => s.id === 'participantes'
                    )"
                    :key="section.id"
                    class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                  >
                    <div class="mb-3 border-b border-[#e5e7eb]/80 pb-2">
                      <h3
                        class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong"
                      >
                        {{ section.title }}
                      </h3>
                      <p v-if="section.subtitle" class="mt-1 text-xs text-[#6b7280]">
                        {{ section.subtitle }}
                      </p>
                    </div>
                    <dl class="space-y-2.5">
                      <div
                        v-for="(item, i) in section.items"
                        :key="`${section.id}-${i}-${item.label}`"
                        class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                      >
                        <dt
                          class="shrink-0 text-xs font-medium uppercase tracking-wide text-[#6b7280] sm:min-w-[8rem]"
                        >
                          {{ item.label }}
                        </dt>
                        <dd class="min-w-0 text-right text-sm font-medium">
                          <span
                            v-if="item.variant === 'mono'"
                            class="break-all text-xs text-[#374151]"
                            >{{ item.value }}</span
                          >
                          <span v-else class="text-[#111827]">{{ item.value }}</span>
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <!-- Cuentas destino: una fila por cuenta con titular y monto -->
                  <section
                    v-if="previewDestinations.rows.length"
                    class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                  >
                    <div
                      class="mb-3 flex items-start justify-between gap-3 border-b border-[#e5e7eb]/80 pb-2"
                    >
                      <div>
                        <h3
                          class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong"
                        >
                          Cuentas destino
                        </h3>
                        <p class="mt-1 text-xs text-[#6b7280]">Distribución del monto a recibir</p>
                      </div>
                      <span
                        class="shrink-0 rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brasper-indigoStrong"
                      >
                        {{ previewDestinations.rows.length }}
                        {{ previewDestinations.rows.length === 1 ? 'cuenta' : 'cuentas' }}
                      </span>
                    </div>
                    <ul class="space-y-2">
                      <li
                        v-for="row in previewDestinations.rows"
                        :key="`preview-destination-${row.position}`"
                        class="rounded-lg border border-[#e8eef8] bg-white px-3 py-2.5"
                      >
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <p
                              class="truncate text-sm font-semibold text-[#111827]"
                              :title="row.bankLabel"
                            >
                              {{ row.bankLabel }}
                            </p>
                            <div v-if="row.identifiers.length" class="mt-1 space-y-1">
                              <button
                                v-for="identifier in row.identifiers"
                                :key="`${row.position}-${identifier.label}-${identifier.value}`"
                                type="button"
                                class="group flex max-w-full items-start gap-1.5 text-left text-xs tabular-nums text-[#6b7280] transition hover:text-brasper-indigoStrong"
                                :title="`Copiar ${identifier.label}: ${identifier.value}`"
                                @click="copyPreviewAccountIdentifier(identifier.value)"
                              >
                                <span class="shrink-0 font-medium">{{ identifier.label }}:</span>
                                <span class="break-all font-mono">{{ identifier.value }}</span>
                                <span
                                  class="shrink-0 font-sans text-[10px] font-semibold text-brasper-indigoStrong"
                                >
                                  {{
                                    copiedPreviewAccountIdentifier === identifier.value
                                      ? 'Copiado'
                                      : 'Copiar'
                                  }}
                                </span>
                              </button>
                            </div>
                            <p
                              class="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-[#374151]"
                              :title="row.holderLabel"
                            >
                              <svg
                                class="h-3.5 w-3.5 shrink-0 text-[#9ca3af]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                              <span class="truncate">{{ row.holderLabel }}</span>
                            </p>
                          </div>
                          <div class="shrink-0 text-right">
                            <p class="text-sm font-semibold tabular-nums text-[#111827]">
                              {{ row.amountLabel }}
                            </p>
                            <p
                              v-if="row.shareLabel"
                              class="mt-0.5 text-[11px] font-medium tabular-nums text-[#6b7280]"
                            >
                              {{ row.shareLabel }} del total
                            </p>
                          </div>
                        </div>
                      </li>
                    </ul>
                    <div
                      v-if="previewDestinations.rows.length > 1"
                      class="mt-2.5 flex items-baseline justify-between gap-3 border-t border-[#e8eef8] pt-2"
                    >
                      <span class="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                        Total distribuido
                      </span>
                      <span class="text-sm font-semibold tabular-nums text-[#111827]">
                        {{ previewDestinations.totalLabel }}
                      </span>
                    </div>
                  </section>

                  <section
                    v-for="section in previewSectionGroups.left.filter(
                      (s) => s.id === 'condiciones'
                    )"
                    :key="section.id"
                    class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                  >
                    <div class="mb-3 border-b border-[#e5e7eb]/80 pb-2">
                      <h3
                        class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong"
                      >
                        {{ section.title }}
                      </h3>
                      <p v-if="section.subtitle" class="mt-1 text-xs text-[#6b7280]">
                        {{ section.subtitle }}
                      </p>
                    </div>
                    <dl class="space-y-2.5">
                      <div
                        v-for="(item, i) in section.items"
                        :key="`${section.id}-${i}-${item.label}`"
                        class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                      >
                        <dt
                          class="shrink-0 text-xs font-medium uppercase tracking-wide text-[#6b7280] sm:min-w-[8rem]"
                        >
                          {{ item.label }}
                        </dt>
                        <dd class="min-w-0 text-right text-sm font-medium">
                          <span
                            v-if="item.variant === 'mono'"
                            class="break-all text-xs text-[#374151]"
                            >{{ item.value }}</span
                          >
                          <span v-else class="text-[#111827]">{{ item.value }}</span>
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>

                <!-- Columna derecha: Importes + Fechas -->
                <div class="space-y-4 border-t border-[#e8eef8] p-5 lg:border-t-0">
                  <!-- Importes con énfasis en valores monetarios -->
                  <section
                    v-for="section in previewSectionGroups.right.filter((s) => s.id === 'importes')"
                    :key="section.id"
                    class="rounded-xl border border-[#d8e5fb] bg-[#f5f8ff] p-4 shadow-sm"
                  >
                    <div class="mb-3 border-b border-[#d8e5fb]/80 pb-2">
                      <h3
                        class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong"
                      >
                        {{ section.title }}
                      </h3>
                    </div>
                    <dl class="space-y-2.5">
                      <template
                        v-for="(item, i) in section.items"
                        :key="`${section.id}-${i}-${item.label}`"
                      >
                        <div
                          v-if="item.variant === 'separator'"
                          class="-mx-1 my-1 border-t border-[#d8e5fb]"
                        />
                        <div v-else class="flex items-baseline justify-between gap-4">
                          <dt class="text-xs font-medium text-[#6b7280]">{{ item.label }}</dt>
                          <dd class="tabular-nums text-sm font-semibold text-[#111827]">
                            {{ item.value }}
                          </dd>
                        </div>
                      </template>
                    </dl>
                  </section>

                  <!-- Fechas -->
                  <section
                    v-for="section in previewSectionGroups.right.filter((s) => s.id === 'fechas')"
                    :key="section.id"
                    class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                  >
                    <div class="mb-3 border-b border-[#e5e7eb]/80 pb-2">
                      <h3
                        class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong"
                      >
                        {{ section.title }}
                      </h3>
                      <p v-if="section.subtitle" class="mt-1 text-xs text-[#6b7280]">
                        {{ section.subtitle }}
                      </p>
                    </div>
                    <dl class="space-y-2.5">
                      <div
                        v-for="(item, i) in section.items"
                        :key="`${section.id}-${i}-${item.label}`"
                        class="flex items-baseline justify-between gap-4"
                      >
                        <dt class="text-xs font-medium text-[#6b7280]">{{ item.label }}</dt>
                        <dd class="text-sm font-medium text-[#111827]">{{ item.value }}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              </div>

              <!-- Registro + Extra: full width, compacto en 2 columnas -->
              <div
                v-if="previewSectionGroups.bottom.length > 0"
                class="border-t border-[#e8eef8] px-5 pb-5 pt-4 space-y-4"
              >
                <section
                  v-for="section in previewSectionGroups.bottom"
                  :key="section.id"
                  class="rounded-xl border border-[#e8eef8] bg-[#fbfdff] p-4 shadow-sm"
                >
                  <div class="mb-3 border-b border-[#e5e7eb]/80 pb-2">
                    <h3
                      class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong"
                    >
                      {{ section.title }}
                    </h3>
                    <p v-if="section.subtitle" class="mt-1 text-xs text-[#6b7280]">
                      {{ section.subtitle }}
                    </p>
                  </div>
                  <dl class="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
                    <div
                      v-for="(item, i) in section.items"
                      :key="`${section.id}-${i}-${item.label}`"
                      class="flex flex-col gap-0.5"
                    >
                      <dt class="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                        {{ item.label }}
                      </dt>
                      <dd class="text-xs font-medium text-[#374151]">
                        <span v-if="item.variant === 'mono'" class="break-all font-mono">{{
                          item.value
                        }}</span>
                        <span v-else>{{ item.value }}</span>
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              <!-- Comprobantes: todas las imágenes de cada grupo -->
              <div
                v-if="previewVoucherGroups.length > 0"
                class="border-t border-[#e8eef8] px-5 pb-5 pt-4"
              >
                <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3
                      class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brasper-indigoStrong"
                    >
                      Comprobantes
                    </h3>
                    <p class="mt-1 text-xs text-[#6b7280]">
                      Clic en una miniatura para abrir en tamaño completo
                    </p>
                  </div>
                  <span
                    class="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-brasper-indigoStrong"
                  >
                    {{ previewVoucherTotal }}
                    {{ previewVoucherTotal === 1 ? 'archivo' : 'archivos' }}
                  </span>
                </div>
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <section
                    v-for="group in previewVoucherGroups"
                    :key="group.key"
                    class="flex flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f9fafb]"
                  >
                    <div
                      class="flex items-center justify-between gap-2 border-b border-[#e5e7eb] bg-white px-3 py-2"
                    >
                      <span class="text-xs font-semibold text-[#374151]">{{ group.title }}</span>
                      <span
                        class="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#6b7280]"
                      >
                        {{ group.entries.length }}
                      </span>
                    </div>
                    <div class="flex-1 space-y-2 p-2">
                      <button
                        v-for="(entry, entryIdx) in group.entries"
                        :key="`${group.key}-${entryIdx}-${entry.href}`"
                        type="button"
                        class="group/voucher block w-full cursor-pointer overflow-hidden rounded-lg border border-[#e5e7eb] bg-white text-left transition hover:border-brasper-indigoStrong/40 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brasper-indigoStrong"
                        :title="entry.label"
                        @click="openMediaViewer(entry.href, `${group.title} · ${entry.label}`)"
                      >
                        <img
                          v-if="entry.isImage"
                          :src="entry.href"
                          :alt="`${group.title} · ${entry.label}`"
                          loading="lazy"
                          class="max-h-40 w-full bg-[#f3f4f6] object-contain transition group-hover/voucher:opacity-90"
                          @error="($event.target as HTMLImageElement).classList.add('hidden')"
                        />
                        <span class="flex items-center gap-2 px-3 py-2">
                          <svg
                            class="h-3.5 w-3.5 shrink-0 text-[#9ca3af]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              v-if="!entry.isImage"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              v-else
                            />
                          </svg>
                          <span class="min-w-0 truncate text-xs font-medium text-[#374151]">
                            {{ entry.label }}
                          </span>
                          <span
                            class="ml-auto shrink-0 text-[11px] font-semibold text-brasper-indigoStrong opacity-0 transition group-hover/voucher:opacity-100"
                          >
                            Abrir
                          </span>
                        </span>
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </template>
          </div>

          <!-- Pie -->
          <div
            v-if="previewTransaction && !previewLoading"
            class="flex flex-wrap items-center justify-end gap-2 border-t border-[#e5e7eb] bg-[#fafbfc] px-6 py-4"
          >
            <slot name="actions" />
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb]"
              @click="closePreviewModal"
            >
              Cerrar
            </button>
            <button
              v-if="previewTransaction.id && canUpdateTransactions"
              type="button"
              class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white hover:bg-brasper-indigoDark"
              @click="openEditFromPreview"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              Editar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

</template>
