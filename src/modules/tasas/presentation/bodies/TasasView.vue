<template>
  <div class="space-y-6">
    <section class="rounded-lg bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold text-on-surface">Tasas de Cambio</h1>

      <div v-if="tasasStore.isLoading" class="mt-4 text-on-surface/70">
        Cargando tasas...
      </div>
      <template v-else>
        <p v-if="tasasStore.error" class="mt-2 text-sm text-red-600">
          {{ tasasStore.error }}
        </p>
        <div class="mt-4 space-y-3">
          <div
            v-for="rate in tasasStore.taxRates"
            :key="rate.id"
            class="flex flex-wrap items-center gap-2 sm:gap-3"
          >
            <label class="min-w-[6rem] text-sm font-medium text-on-surface">
              {{ rate.coin_a }}-{{ rate.coin_b }}:
            </label>
            <span
              class="w-24 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-on-surface"
            >
              {{ formatTax(rate.tax) }}
            </span>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTasasStore } from '../controllers/useTasasStore'

const tasasStore = useTasasStore()

/** Formatea número con coma decimal para mostrar. */
function formatTax(value: number): string {
  if (Number.isNaN(value) || value === 0) return '0'
  return String(value).replace('.', ',')
}

onMounted(() => {
  tasasStore.loadTaxRates()
})
</script>
