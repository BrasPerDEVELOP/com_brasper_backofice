<script setup lang="ts">
/**
 * Tasas mensuales a soles: una fila por mes, una columna por moneda.
 * Se guardan solo las celdas con valor; vacío = sin tasa (el panel gerencial
 * avisa de los meses que faltan).
 */
import { computed, reactive, watch } from 'vue'
import {
  FX_CURRENCIES,
  FX_CURRENCY_LABELS,
  MONTH_LABELS_ES,
  type FxCurrency,
  type FxMonthRate,
  type FxRateInput
} from '../../domain/models'

const props = defineProps<{
  year: number
  rates: FxMonthRate[]
  canEdit: boolean
  saving: boolean
}>()

const emit = defineEmits<{ save: [items: FxRateInput[]] }>()

type Grid = Record<number, Record<FxCurrency, string>>

function gridFromRates(rates: FxMonthRate[]): Grid {
  const grid: Grid = {}
  for (let month = 1; month <= 12; month += 1) grid[month] = { BRL: '', USD: '' }
  for (const rate of rates) {
    const row = grid[rate.month]
    if (row) row[rate.currency] = String(rate.rateToPen)
  }
  return grid
}

const grid = reactive<Grid>(gridFromRates(props.rates))
watch(
  () => props.rates,
  (rates) => Object.assign(grid, gridFromRates(rates)),
  { deep: true }
)

const invalidCells = computed(() => {
  const invalid: string[] = []
  for (let month = 1; month <= 12; month += 1) {
    for (const currency of FX_CURRENCIES) {
      const raw = (grid[month]?.[currency] ?? '').trim()
      if (!raw) continue
      const value = Number(raw.replace(',', '.'))
      if (!Number.isFinite(value) || value <= 0) invalid.push(`${MONTH_LABELS_ES[month - 1]} ${currency}`)
    }
  }
  return invalid
})

const dirty = computed(() => {
  const original = gridFromRates(props.rates)
  for (let month = 1; month <= 12; month += 1) {
    for (const currency of FX_CURRENCIES) {
      if ((grid[month]?.[currency] ?? '') !== (original[month]?.[currency] ?? '')) return true
    }
  }
  return false
})

function submit() {
  if (invalidCells.value.length) return
  const items: FxRateInput[] = []
  for (let month = 1; month <= 12; month += 1) {
    for (const currency of FX_CURRENCIES) {
      const raw = (grid[month]?.[currency] ?? '').trim()
      if (!raw) continue
      items.push({ year: props.year, month, currency, rateToPen: Number(raw.replace(',', '.')) })
    }
  }
  emit('save', items)
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <p class="text-sm text-[#6b7280]">
      Cuántos soles vale 1 real y 1 dólar en cada mes de {{ year }}. El panel gerencial usa
      estas tasas para expresar en soles los montos y las comisiones en reales y dólares.
    </p>

    <div class="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
      <table class="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr class="bg-[#dbeafe]">
            <th class="px-4 py-3 font-semibold text-brasper-indigoDark">Mes</th>
            <th
              v-for="currency in FX_CURRENCIES"
              :key="currency"
              class="px-4 py-3 font-semibold text-brasper-indigoDark"
            >
              {{ FX_CURRENCY_LABELS[currency] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="month in 12" :key="month" class="border-t border-[#e5e7eb]">
            <td class="px-4 py-2 font-medium text-[#232b4d]">{{ MONTH_LABELS_ES[month - 1] }}</td>
            <td v-for="currency in FX_CURRENCIES" :key="currency" class="px-4 py-2">
              <input
                v-model="grid[month]![currency]"
                type="text"
                inputmode="decimal"
                :disabled="!canEdit || saving"
                placeholder="—"
                :aria-label="`Tasa ${currency} de ${MONTH_LABELS_ES[month - 1]}`"
                class="w-32 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong disabled:bg-[#f9fafb]"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="invalidCells.length" class="text-sm text-[#dc3545]">
      Revisa estas tasas (deben ser números mayores que cero): {{ invalidCells.join(', ') }}.
    </p>

    <div v-if="canEdit" class="flex justify-end">
      <button
        type="submit"
        :disabled="!dirty || saving || invalidCells.length > 0"
        class="rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {{ saving ? 'Guardando…' : 'Guardar tasas' }}
      </button>
    </div>
  </form>
</template>
