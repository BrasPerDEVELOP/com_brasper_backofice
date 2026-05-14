<template>
  <section class="rounded-xl border border-[#d8e5fb] bg-white p-4 shadow-md shadow-brasper-indigoStrong/10">
    <div class="mb-4">
      <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-brasper-indigoStrong">
        Configuración demo
      </p>
      <h2 class="text-xl font-semibold text-[#232b4d]">Tasas de Cambio (Demo)</h2>
      <p
        v-if="filterRatesToSelectedPair"
        class="mt-1 text-xs font-medium text-[#5b6b8c]"
      >
        Par en cotización:
        {{ calculatorStore.currencyFrom.toUpperCase() }} →
        {{ calculatorStore.currencyTo.toUpperCase() }}
      </p>
    </div>

    <div v-if="calculatorStore.isLoading" class="mt-2 text-sm text-[#666]">
      Cargando tasas demo...
    </div>
    <div v-else-if="calculatorStore.error" class="mt-2 rounded-lg bg-[#dc3545]/10 px-3 py-2 text-sm text-[#dc3545]">
      {{ calculatorStore.error }}
    </div>
    <template v-else>
      <p v-if="tasasStore.error" class="mt-2 rounded-lg bg-[#dc3545]/10 px-3 py-2 text-sm text-[#dc3545]">
        {{ tasasStore.error }}
      </p>
      <div v-if="displayRates.length === 0" class="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
        No hay fila de tasa trial para este par en el catálogo. Revisa en admin o cambia el par en la calculadora.
      </div>
      <div v-else class="mt-3 space-y-2">
        <div
          v-for="rate in displayRates"
          :key="rate.id"
          class="rounded-lg border border-[#dbe7fb] bg-[#fbfdff] p-2.5"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <label class="min-w-[4.5rem] text-xs font-medium text-[#333]">
                {{ rate.from.toUpperCase() }}-{{ rate.to.toUpperCase() }}
              </label>
              <input
                :value="draftTaxes[rate.id] ?? String(rate.rate)"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                class="w-24 rounded-md border border-[#cfdbef] bg-white px-2 py-1 text-xs text-[#333] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/20"
                @input="onDraftInput(rate.id, $event)"
              />
            </div>
            <div class="flex items-center gap-1.5 whitespace-nowrap">
              <button
                type="button"
                class="rounded-md border border-[#bcd7ff] bg-[#eef5ff] px-2.5 py-1 text-xs font-medium text-brasper-indigoStrong hover:bg-[#e2eeff]"
                @click="toggleHistory(rate.id)"
              >
                {{ expandedHistoryId === rate.id ? 'Ocultar historial' : 'Historial' }}
              </button>
              <button
                type="button"
                class="rounded-md bg-gradient-to-r from-brasper-cyanLight to-brasper-indigoStrong px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                :disabled="tasasStore.savingTrialId === rate.id"
                @click="saveRate(rate)"
              >
                {{ tasasStore.savingTrialId === rate.id ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
          <div
            v-if="expandedHistoryId === rate.id"
            class="mt-4 rounded-xl border border-[#dbe7fb] bg-white p-3"
          >
            <div v-if="tasasStore.loadingHistoryTrialId === rate.id" class="text-sm text-slate-600">
              Cargando historial...
            </div>
            <div v-else-if="getHistoryEntries(rate.id).length === 0" class="text-sm text-slate-600">
              Sin cambios registrados.
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="entry in getHistoryEntries(rate.id)"
                :key="String(entry.id)"
                class="rounded border border-slate-200 bg-white p-3"
              >
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div class="text-xs text-slate-600">
                    <span class="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                      {{ formatHistoryValue(entry.action) }}
                    </span>
                    <span class="ml-2">por {{ formatHistoryValue(entry.changed_by) }}</span>
                  </div>
                  <div class="text-xs text-slate-500">
                    {{ formatHistoryDate(entry.changed_at) }}
                  </div>
                </div>
                <div class="mb-3 flex flex-wrap gap-1">
                  <span
                    v-for="field in getChangedFields(entry)"
                    :key="`${entry.id}-field-${field}`"
                    class="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                  >
                    {{ field }}
                  </span>
                </div>
                <div class="grid gap-2 sm:grid-cols-2">
                  <div
                    v-for="field in getChangedFields(entry)"
                    :key="`${entry.id}-diff-${field}`"
                    class="rounded border border-slate-100 p-2 text-xs"
                  >
                    <div class="font-semibold text-slate-700">{{ field }}</div>
                    <div class="mt-1 text-slate-500">
                      Antes: {{ formatHistoryValue(getBeforeData(entry)[field]) }}
                    </div>
                    <div class="text-slate-700">
                      Después: {{ formatHistoryValue(getAfterData(entry)[field]) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  useCalculatorDemoStore,
  useCalculatorStore
} from '@modules/calculator/presentation/controllers/use_calculator_store_controller'
import { useTasasStore } from '../controllers/use_tasas_store_controller'
import type { ExchangeRate } from '@modules/calculator/domain/models'

const props = withDefaults(
  defineProps<{
    /** Si true, sincroniza con la calculadora principal (p. ej. modal de transacciones en API trial). */
    useMainCalculatorStore?: boolean
    /** Si true: solo la fila del par actual (origen → destino) de la calculadora. */
    filterRatesToSelectedPair?: boolean
  }>(),
  { useMainCalculatorStore: false, filterRatesToSelectedPair: false }
)

const calculatorStore = props.useMainCalculatorStore
  ? useCalculatorStore()
  : useCalculatorDemoStore()
const tasasStore = useTasasStore()

const expandedHistoryId = ref<string | null>(null)
const draftTaxes = ref<Record<string, string>>({})

const sortedRates = computed(() =>
  [...calculatorStore.taxRates].sort((a, b) => a.pair.localeCompare(b.pair))
)

const displayRates = computed(() => {
  if (!props.filterRatesToSelectedPair) return sortedRates.value
  const from = calculatorStore.currencyFrom
  const to = calculatorStore.currencyTo
  return sortedRates.value.filter((r) => r.from === from && r.to === to)
})

/** Interpreta tasa desde input (coma o punto decimal). */
function parseTaxInput(raw: string, fallback: number): number {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (t === '') return fallback
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

function onDraftInput(id: string, ev: Event): void {
  const v = (ev.target as HTMLInputElement).value
  draftTaxes.value = { ...draftTaxes.value, [id]: v }
}

async function saveRate(rate: ExchangeRate): Promise<void> {
  const draft = draftTaxes.value[rate.id]
  const parsedTax = parseTaxInput(
    draft !== undefined ? draft : String(rate.rate),
    rate.rate
  )
  const ok = await tasasStore.validateAndUpdateTaxRateTrial(
    rate.id,
    parsedTax,
    rate.from.toUpperCase(),
    rate.to.toUpperCase()
  )
  if (ok) {
    draftTaxes.value[rate.id] = String(parsedTax)
    await calculatorStore.loadData()
    if (calculatorStore.calculationMode === 'special' && calculatorStore.amountSend > 0) {
      calculatorStore.recalcFromSend()
    }
  }
}

function getHistoryEntries(taxRateId: string): Array<Record<string, unknown>> {
  return tasasStore.historyTrialByTaxRateId[taxRateId] ?? []
}

function formatHistoryValue(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function toObject(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function getChangedFields(entry: Record<string, unknown>): string[] {
  const value = entry.changed_fields
  if (!Array.isArray(value)) return []
  return value.map((field) => String(field))
}

function getBeforeData(entry: Record<string, unknown>): Record<string, unknown> {
  return toObject(entry.before_data)
}

function getAfterData(entry: Record<string, unknown>): Record<string, unknown> {
  return toObject(entry.after_data)
}

function formatHistoryDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(date)
}

async function toggleHistory(taxRateId: string): Promise<void> {
  if (expandedHistoryId.value === taxRateId) {
    expandedHistoryId.value = null
    return
  }
  expandedHistoryId.value = taxRateId
  await tasasStore.loadTaxRateHistoryTrial(taxRateId)
}

watch(
  () => calculatorStore.taxRates,
  (rates) => {
    for (const rate of rates) {
      if (!(rate.id in draftTaxes.value)) {
        draftTaxes.value[rate.id] = String(rate.rate)
      }
    }
  },
  { immediate: true, deep: true }
)
</script>
