<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw } from '@lucide/vue'
import {
  CURRENCY_CODES,
  CURRENCY_LABELS,
  currentYear,
  type CurrencyCode,
  type ManagementFilters
} from '../../domain/models'

const props = defineProps<{
  modelValue: ManagementFilters
  companies: string[]
  loading: boolean
}>()

const emit = defineEmits<{
  apply: [patch: Partial<ManagementFilters>]
  reset: []
}>()

const FIRST_YEAR = 2024
const years = computed(() => {
  const last = Math.max(currentYear(), props.modelValue.year)
  const list: number[] = []
  for (let y = last; y >= FIRST_YEAR; y -= 1) list.push(y)
  return list
})

function onYear(event: Event) {
  emit('apply', { year: Number((event.target as HTMLSelectElement).value) })
}
function onCurrency(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('apply', { currency: value ? (value as CurrencyCode) : null })
}
function onCompany(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('apply', { company: value || null })
}
</script>

<template>
  <section class="gerencia-filters" aria-label="Filtros del panel gerencial">
    <label class="gerencia-filters__field">
      <span>Año</span>
      <select :value="modelValue.year" :disabled="loading" @change="onYear">
        <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
      </select>
    </label>
    <label class="gerencia-filters__field">
      <span>Moneda</span>
      <select :value="modelValue.currency ?? ''" :disabled="loading" @change="onCurrency">
        <option value="">Todas</option>
        <option v-for="code in CURRENCY_CODES" :key="code" :value="code">
          {{ CURRENCY_LABELS[code] }} ({{ code }})
        </option>
      </select>
    </label>
    <label class="gerencia-filters__field">
      <span>Razón social</span>
      <select :value="modelValue.company ?? ''" :disabled="loading" @change="onCompany">
        <option value="">Todas</option>
        <option v-for="company in companies" :key="company" :value="company">{{ company }}</option>
      </select>
    </label>
    <button class="gerencia-filters__reset" type="button" :disabled="loading" @click="emit('reset')">
      <RotateCcw :size="14" aria-hidden="true" />
      Limpiar
    </button>
  </section>
</template>

<style scoped>
.gerencia-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #dfe6f0;
  border-radius: 14px;
  background: #fff;
}
.gerencia-filters__field {
  display: grid;
  min-width: 150px;
  gap: 4px;
  color: #475569;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.gerencia-filters__field select {
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  color: #17213a;
  background: #fff;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 500;
  text-transform: none;
  letter-spacing: normal;
}
.gerencia-filters__reset {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  color: #475569;
  background: #f8fafc;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.gerencia-filters__reset:disabled,
.gerencia-filters__field select:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
