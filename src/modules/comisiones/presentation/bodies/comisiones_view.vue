<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useComisionesStore } from '../controllers/use_comisiones_store_controller'
import type { Commission } from '../../domain/models'

const comisionesStore = useComisionesStore()
const activePair = ref<'usd-brl' | 'brl-pen' | 'brl-usd' | 'pen-brl'>('usd-brl')
const editingId = ref<string | null>(null)
const expandedHistoryId = ref<string | null>(null)

type CommissionForm = {
  coin_a: string
  coin_b: string
  percentage: string
  reverse: string
  min_amount: string
  max_amount: string
}

const editingForm = ref<CommissionForm>({
  coin_a: '',
  coin_b: '',
  percentage: '',
  reverse: '0',
  min_amount: '',
  max_amount: ''
})

const defaultPair = { key: 'usd-brl' as const, label: 'USD-BRL', coin_a: 'USD', coin_b: 'BRL' }

const pairs = [
  defaultPair,
  { key: 'brl-pen' as const, label: 'BRL-PEN', coin_a: 'BRL', coin_b: 'PEN' },
  { key: 'brl-usd' as const, label: 'BRL-USD', coin_a: 'BRL', coin_b: 'USD' },
  { key: 'pen-brl' as const, label: 'PEN-BRL', coin_a: 'PEN', coin_b: 'BRL' }
]

const activePairConfig = computed(() => pairs.find((p) => p.key === activePair.value) ?? defaultPair)

const activeCommissions = computed(() => {
  const cfg = activePairConfig.value
  return comisionesStore.commissions.filter(
    (c: Commission) => c.coin_a === cfg.coin_a && c.coin_b === cfg.coin_b
  )
})

function formatPercentage(value: number): string {
  if (Number.isNaN(value) || value === 0) return '0'
  return value.toFixed(2)
}

function formatAmount(value: number): string {
  if (Number.isNaN(value) || value === 0) return '0'
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

function formatReverse(value: string): string {
  const num = Number(value)
  if (Number.isNaN(num)) return value
  return num.toFixed(6)
}

function startEditing(commission: Commission): void {
  editingId.value = commission.id
  editingForm.value = {
    coin_a: commission.coin_a,
    coin_b: commission.coin_b,
    percentage: String(commission.percentage),
    reverse: commission.reverse,
    min_amount: String(commission.min_amount),
    max_amount: String(commission.max_amount)
  }
}

function cancelEditing(): void {
  editingId.value = null
  editingForm.value = {
    coin_a: '',
    coin_b: '',
    percentage: '',
    reverse: '0',
    min_amount: '',
    max_amount: ''
  }
}

async function saveCommission(id: string): Promise<void> {
  const ok = await comisionesStore.validateAndSaveCommission(id, editingForm.value)
  if (ok) cancelEditing()
}

async function deleteCommission(id: string): Promise<void> {
  const confirmed = window.confirm('¿Seguro que deseas eliminar esta comisión?')
  if (!confirmed) return
  await comisionesStore.deleteCommission(id)
  if (editingId.value === id) cancelEditing()
}

function getHistoryEntries(commissionId: string): Array<Record<string, unknown>> {
  return comisionesStore.historyByCommissionId[commissionId] ?? []
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

async function toggleHistory(commissionId: string): Promise<void> {
  if (expandedHistoryId.value === commissionId) {
    expandedHistoryId.value = null
    return
  }
  expandedHistoryId.value = commissionId
  await comisionesStore.loadCommissionHistory(commissionId)
}

onMounted(() => {
  comisionesStore.loadCommissions()
})
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-brasper-indigoStrong/10">
      <div class="mb-4">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">Configuración</p>
        <h1 class="text-2xl font-semibold text-[#232b4d]">Comisiones</h1>
      </div>

      <div v-if="comisionesStore.isLoading" class="mt-4 text-[#666]">Cargando comisiones...</div>
      <template v-else>
        <p v-if="comisionesStore.error" class="mt-2 rounded-lg bg-[#dc3545]/10 px-3 py-2 text-sm text-[#dc3545]">
          {{ comisionesStore.error }}
        </p>

        <div class="mt-6 flex flex-wrap gap-2 border-b border-[#dbe7fb]">
          <button
            v-for="pair in pairs"
            :key="pair.key"
            type="button"
            :class="[
              'rounded-t-lg border border-transparent px-4 py-2 text-sm font-medium transition-colors',
              activePair === pair.key
                ? 'border-brasper-cyan bg-[#eef5ff] text-brasper-indigoStrong'
                : 'text-[#666] hover:bg-[#f3f8ff] hover:text-[#232b4d]'
            ]"
            @click="activePair = pair.key"
          >
            {{ pair.label }}
          </button>
        </div>

        <div class="mt-6">
          <h2 class="mb-3 text-lg font-semibold text-[#232b4d]">{{ activePairConfig.label }}</h2>

          <div v-if="activeCommissions.length === 0" class="text-[#666]">
            No hay comisiones disponibles para este par.
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="commission in activeCommissions"
              :key="commission.id"
              class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] p-4"
            >
              <div class="mb-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-[#bcd7ff] bg-[#eef5ff] px-3 py-1.5 text-sm font-medium text-brasper-indigoStrong hover:bg-[#e2eeff]"
                  @click="toggleHistory(commission.id)"
                >
                  {{ expandedHistoryId === commission.id ? 'Ocultar historial' : 'Historial' }}
                </button>
                <button
                  v-if="editingId !== commission.id"
                  type="button"
                  class="rounded-lg border border-brasper-indigoStrong/30 bg-brasper-indigoStrong/10 px-3 py-1.5 text-sm font-medium text-brasper-indigoDark hover:bg-brasper-indigoStrong/20"
                  @click="startEditing(commission)"
                >
                  Editar
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-[#dc3545]/30 bg-[#dc3545]/10 px-3 py-1.5 text-sm font-medium text-[#dc3545] hover:bg-[#dc3545]/20 disabled:opacity-60"
                  :disabled="
                    comisionesStore.deletingId === commission.id || comisionesStore.savingId === commission.id
                  "
                  @click="deleteCommission(commission.id)"
                >
                  {{ comisionesStore.deletingId === commission.id ? 'Eliminando...' : 'Eliminar' }}
                </button>
              </div>

              <div v-if="editingId === commission.id" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div class="text-xs text-on-surface/70">
                  <label :for="`${commission.id}-coin_a`" class="block">Moneda origen</label>
                  <input
                    :id="`${commission.id}-coin_a`"
                    v-model="editingForm.coin_a"
                    type="text"
                    maxlength="3"
                    class="mt-1 w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#333] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/20"
                  />
                </div>
                <div class="text-xs text-on-surface/70">
                  <label :for="`${commission.id}-coin_b`" class="block">Moneda destino</label>
                  <input
                    :id="`${commission.id}-coin_b`"
                    v-model="editingForm.coin_b"
                    type="text"
                    maxlength="3"
                    class="mt-1 w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#333] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/20"
                  />
                </div>
                <div class="text-xs text-on-surface/70">
                  <label :for="`${commission.id}-percentage`" class="block">Porcentaje</label>
                  <input
                    :id="`${commission.id}-percentage`"
                    v-model="editingForm.percentage"
                    type="text"
                    inputmode="decimal"
                    class="mt-1 w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#333] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/20"
                  />
                </div>
                <div class="text-xs text-on-surface/70">
                  <label :for="`${commission.id}-reverse`" class="block">Reverse</label>
                  <input
                    :id="`${commission.id}-reverse`"
                    v-model="editingForm.reverse"
                    type="text"
                    inputmode="decimal"
                    class="mt-1 w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#333] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/20"
                  />
                </div>
                <div class="text-xs text-on-surface/70">
                  <label :for="`${commission.id}-min_amount`" class="block">Monto mínimo</label>
                  <input
                    :id="`${commission.id}-min_amount`"
                    v-model="editingForm.min_amount"
                    type="text"
                    inputmode="decimal"
                    class="mt-1 w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#333] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/20"
                  />
                </div>
                <div class="text-xs text-on-surface/70">
                  <label :for="`${commission.id}-max_amount`" class="block">Monto máximo</label>
                  <input
                    :id="`${commission.id}-max_amount`"
                    v-model="editingForm.max_amount"
                    type="text"
                    inputmode="decimal"
                    class="mt-1 w-full rounded-lg border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#333] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/20"
                  />
                </div>

                <div class="sm:col-span-2 lg:col-span-3 mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="cursor-pointer rounded-lg bg-gradient-to-r from-brasper-cyanLight to-brasper-indigoStrong px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="comisionesStore.savingId === commission.id"
                    @click.stop.prevent="saveCommission(commission.id)"
                  >
                    {{ comisionesStore.savingId === commission.id ? 'Guardando...' : 'Guardar' }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-brasper-indigoStrong/30 bg-brasper-indigoStrong/10 px-3 py-2 text-sm text-brasper-indigoDark hover:bg-brasper-indigoStrong/20"
                    @click="cancelEditing"
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              <div v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span class="text-xs text-[#666]">Porcentaje</span>
                  <p class="text-sm font-semibold text-[#232b4d]">{{ formatPercentage(commission.percentage) }}%</p>
                </div>
                <div>
                  <span class="text-xs text-[#666]">Monto mínimo</span>
                  <p class="text-sm font-semibold text-[#232b4d]">{{ formatAmount(commission.min_amount) }}</p>
                </div>
                <div>
                  <span class="text-xs text-[#666]">Monto máximo</span>
                  <p class="text-sm font-semibold text-[#232b4d]">{{ formatAmount(commission.max_amount) }}</p>
                </div>
                <div>
                  <span class="text-xs text-[#666]">Reverse</span>
                  <p class="text-sm font-semibold text-[#232b4d]">{{ formatReverse(commission.reverse) }}</p>
                </div>
              </div>

              <div
                v-if="expandedHistoryId === commission.id"
                class="mt-4 rounded-xl border border-[#dbe7fb] bg-white p-3"
              >
                <div
                  v-if="comisionesStore.loadingHistoryId === commission.id"
                  class="text-sm text-slate-600"
                >
                  Cargando historial...
                </div>
                <div v-else-if="getHistoryEntries(commission.id).length === 0" class="text-sm text-slate-600">
                  Sin cambios registrados.
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="entry in getHistoryEntries(commission.id)"
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
        </div>
      </template>
    </section>
  </div>
</template>
