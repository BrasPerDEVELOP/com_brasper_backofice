<template>
  <div class="space-y-6">
    <section class="rounded-lg bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold text-on-surface">Comisiones</h1>

      <div v-if="comisionesStore.isLoading" class="mt-4 text-on-surface/70">
        Cargando comisiones...
      </div>
      <template v-else>
        <p v-if="comisionesStore.error" class="mt-2 text-sm text-red-600">
          {{ comisionesStore.error }}
        </p>
        <div v-if="comisionesStore.commissions.length === 0" class="mt-4 text-on-surface/70">
          No hay comisiones disponibles.
        </div>
        <div v-else>
          <!-- Botones de navegación -->
          <div class="mt-6 flex flex-wrap gap-2 border-b border-gray-200">
            <button
              v-for="pair in pairs"
              :key="pair.key"
              type="button"
              :class="[
                'px-4 py-2 text-sm font-medium transition-colors',
                activePair === pair.key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-on-surface/70 hover:text-on-surface'
              ]"
              @click="activePair = pair.key"
            >
              {{ pair.label }}
            </button>
          </div>

          <!-- Vista USD-BRL -->
          <div v-if="activePair === 'usd-brl'" class="mt-6">
            <h2 class="mb-3 text-lg font-semibold text-on-surface">USD-BRL</h2>
            <div v-if="usdBrlCommissions.length === 0" class="text-on-surface/70">
              No hay comisiones disponibles para este par.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="commission in usdBrlCommissions"
                :key="commission.id"
                class="rounded-lg border border-gray-200 p-4"
              >
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <span class="text-xs text-on-surface/70">Porcentaje</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatPercentage(commission.percentage) }}%
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Monto mínimo</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatAmount(commission.min_amount) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Monto máximo</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatAmount(commission.max_amount) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Reverse</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatReverse(commission.reverse) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Vista BRL-PEN -->
          <div v-if="activePair === 'brl-pen'" class="mt-6">
            <h2 class="mb-3 text-lg font-semibold text-on-surface">BRL-PEN</h2>
            <div v-if="brlPenCommissions.length === 0" class="text-on-surface/70">
              No hay comisiones disponibles para este par.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="commission in brlPenCommissions"
                :key="commission.id"
                class="rounded-lg border border-gray-200 p-4"
              >
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <span class="text-xs text-on-surface/70">Porcentaje</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatPercentage(commission.percentage) }}%
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Monto mínimo</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatAmount(commission.min_amount) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Monto máximo</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatAmount(commission.max_amount) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Reverse</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatReverse(commission.reverse) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Vista BRL-USD -->
          <div v-if="activePair === 'brl-usd'" class="mt-6">
            <h2 class="mb-3 text-lg font-semibold text-on-surface">BRL-USD</h2>
            <div v-if="brlUsdCommissions.length === 0" class="text-on-surface/70">
              No hay comisiones disponibles para este par.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="commission in brlUsdCommissions"
                :key="commission.id"
                class="rounded-lg border border-gray-200 p-4"
              >
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <span class="text-xs text-on-surface/70">Porcentaje</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatPercentage(commission.percentage) }}%
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Monto mínimo</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatAmount(commission.min_amount) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Monto máximo</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatAmount(commission.max_amount) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Reverse</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatReverse(commission.reverse) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Vista PEN-BRL -->
          <div v-if="activePair === 'pen-brl'" class="mt-6">
            <h2 class="mb-3 text-lg font-semibold text-on-surface">PEN-BRL</h2>
            <div v-if="penBrlCommissions.length === 0" class="text-on-surface/70">
              No hay comisiones disponibles para este par.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="commission in penBrlCommissions"
                :key="commission.id"
                class="rounded-lg border border-gray-200 p-4"
              >
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <span class="text-xs text-on-surface/70">Porcentaje</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatPercentage(commission.percentage) }}%
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Monto mínimo</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatAmount(commission.min_amount) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Monto máximo</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatAmount(commission.max_amount) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs text-on-surface/70">Reverse</span>
                    <p class="text-sm font-medium text-on-surface">
                      {{ formatReverse(commission.reverse) }}
                    </p>
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
import { ref, computed, onMounted } from 'vue'
import { useComisionesStore } from '../controllers/useComisionesStore'
import type { Commission } from '../../domain/models'

const comisionesStore = useComisionesStore()
const activePair = ref<'usd-brl' | 'brl-pen' | 'brl-usd' | 'pen-brl'>('usd-brl')

const pairs = [
  { key: 'usd-brl' as const, label: 'USD-BRL' },
  { key: 'brl-pen' as const, label: 'BRL-PEN' },
  { key: 'brl-usd' as const, label: 'BRL-USD' },
  { key: 'pen-brl' as const, label: 'PEN-BRL' }
]

const usdBrlCommissions = computed(() => {
  return comisionesStore.commissions.filter(
    (c: Commission) => c.coin_a === 'USD' && c.coin_b === 'BRL'
  )
})

const brlPenCommissions = computed(() => {
  return comisionesStore.commissions.filter(
    (c: Commission) => c.coin_a === 'BRL' && c.coin_b === 'PEN'
  )
})

const brlUsdCommissions = computed(() => {
  return comisionesStore.commissions.filter(
    (c: Commission) => c.coin_a === 'BRL' && c.coin_b === 'USD'
  )
})

const penBrlCommissions = computed(() => {
  return comisionesStore.commissions.filter(
    (c: Commission) => c.coin_a === 'PEN' && c.coin_b === 'BRL'
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

onMounted(() => {
  comisionesStore.loadCommissions()
})
</script>
