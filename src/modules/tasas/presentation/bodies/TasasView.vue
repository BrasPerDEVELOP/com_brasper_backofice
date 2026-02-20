<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-[#007bff]/5">
      <div class="mb-4">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Configuración</p>
        <h1 class="text-2xl font-semibold text-[#232b4d]">Tasas de Cambio</h1>
      </div>

      <div v-if="tasasStore.isLoading" class="mt-4 text-[#666]">
        Cargando tasas...
      </div>
      <template v-else>
        <p v-if="tasasStore.error" class="mt-2 rounded-lg bg-[#dc3545]/10 px-3 py-2 text-sm text-[#dc3545]">
          {{ tasasStore.error }}
        </p>
        <div class="mt-4 space-y-3">
          <div
            v-for="rate in tasasStore.taxRates"
            :key="rate.id"
            class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] p-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <label class="min-w-[6rem] text-sm font-medium text-[#333]">
                {{ rate.coin_a }}-{{ rate.coin_b }}
              </label>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-[#bcd7ff] bg-[#eef5ff] px-3 py-1.5 text-sm font-medium text-[#066ac9] hover:bg-[#e2eeff]"
                  @click="toggleHistory(rate.id)"
                >
                  {{ expandedHistoryId === rate.id ? 'Ocultar historial' : 'Historial' }}
                </button>
                <button
                  v-if="editingId !== rate.id"
                  type="button"
                  class="rounded-lg border border-[#4A52D8]/30 bg-[#4A52D8]/10 px-3 py-1.5 text-sm font-medium text-[#3C4DA7] hover:bg-[#4A52D8]/20"
                  @click="startEditing(rate)"
                >
                  Editar
                </button>
              </div>
            </div>

            <div v-if="editingId === rate.id" class="mt-3 flex flex-wrap items-center gap-2">
              <input
                v-model="editingTax"
                type="number"
                inputmode="decimal"
                step="0.000001"
                min="0"
                class="w-36 rounded-lg border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#333] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
              />
              <button
                type="button"
                class="rounded-lg bg-gradient-to-r from-[#10b981] to-[#5ED6B3] px-3 py-2 text-sm font-semibold text-[#06271d] disabled:opacity-60"
                :disabled="tasasStore.savingId === rate.id"
                @click="saveRate(rate.id, rate.coin_a, rate.coin_b)"
              >
                {{ tasasStore.savingId === rate.id ? 'Guardando...' : 'Guardar' }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-[#4A52D8]/30 bg-[#4A52D8]/10 px-3 py-2 text-sm text-[#3C4DA7] hover:bg-[#4A52D8]/20"
                @click="cancelEditing"
              >
                Cancelar
              </button>
            </div>
            <div v-else class="mt-2">
              <span
                class="inline-block w-24 rounded-lg border border-[#dbe7fb] bg-white px-3 py-2 text-sm font-semibold text-[#232b4d]"
              >
                {{ formatTax(rate.tax) }}
              </span>
            </div>
            <div
              v-if="expandedHistoryId === rate.id"
              class="mt-4 rounded-xl border border-[#dbe7fb] bg-white p-3"
            >
              <div v-if="tasasStore.loadingHistoryId === rate.id" class="text-sm text-slate-600">
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useTasasStore } from '../controllers/useTasasStore'
import type { TaxRate } from '../../domain/models'

const tasasStore = useTasasStore()
const editingId = ref<string | null>(null)
const editingTax = ref('')
const expandedHistoryId = ref<string | null>(null)

/** Formatea número con coma decimal para mostrar. */
function formatTax(value: number): string {
  if (Number.isNaN(value) || value === 0) return '0'
  return String(value).replace('.', ',')
}

function startEditing(rate: TaxRate): void {
  editingId.value = rate.id
  editingTax.value = String(rate.tax)
}

function cancelEditing(): void {
  editingId.value = null
  editingTax.value = ''
}

async function saveRate(id: string, coinA: string, coinB: string): Promise<void> {
  const parsedTax = Number(editingTax.value)
  if (Number.isNaN(parsedTax) || parsedTax <= 0) {
    tasasStore.error = 'Ingresa una tasa válida mayor a 0.'
    return
  }
  await tasasStore.updateTaxRate(id, {
    coin_a: coinA,
    coin_b: coinB,
    tax: String(parsedTax)
  })
  if (!tasasStore.error) cancelEditing()
}

function getHistoryEntries(taxRateId: string): Array<Record<string, unknown>> {
  return tasasStore.historyByTaxRateId[taxRateId] ?? []
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
  await tasasStore.loadTaxRateHistory(taxRateId)
}

onMounted(() => {
  tasasStore.loadTaxRates()
})
</script>
