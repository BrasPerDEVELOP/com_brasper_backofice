<script setup lang="ts">
import { reactive, watch } from 'vue'
import { TRANSACTION_STATUS_LABELS } from '@modules/transacciones/domain/models'
import type { CurrencyCode, Granularity, WeeklyMetricsFilters } from '../../domain/models'
import { GRANULARITY_LABELS } from '../../domain/models'

interface AgentOption {
  id: string
  name: string
}

const props = defineProps<{
  filters: WeeklyMetricsFilters
  agents: AgentOption[]
  loading?: boolean
}>()

const emit = defineEmits<{ (e: 'apply', filters: WeeklyMetricsFilters): void }>()

const CURRENCIES: CurrencyCode[] = ['PEN', 'BRL', 'USD']
const STATUS_ENTRIES = Object.entries(TRANSACTION_STATUS_LABELS) as [string, string][]
const GRANULARITY_ENTRIES = Object.entries(GRANULARITY_LABELS) as [Granularity, string][]

// Estado local editable; se sincroniza si el padre reemplaza los filtros.
const local = reactive<WeeklyMetricsFilters>({ ...props.filters })
watch(
  () => props.filters,
  (next) => Object.assign(local, next),
  { deep: true },
)

function apply() {
  emit('apply', { ...local })
}
</script>

<template>
  <div class="metrics-filters">
    <div class="metrics-filters__group">
      <label id="metrics-corridor-label">Corredor</label>
      <div class="metrics-filters__corridor" role="group" aria-labelledby="metrics-corridor-label">
        <select v-model="local.originCurrency" aria-label="Moneda de origen">
          <option v-for="c in CURRENCIES" :key="`o-${c}`" :value="c">{{ c }}</option>
        </select>
        <span aria-hidden="true">→</span>
        <select v-model="local.destinationCurrency" aria-label="Moneda de destino">
          <option v-for="c in CURRENCIES" :key="`d-${c}`" :value="c">{{ c }}</option>
        </select>
      </div>
    </div>

    <div class="metrics-filters__group">
      <label for="metrics-granularity">Agrupar por</label>
      <select id="metrics-granularity" v-model="local.granularity">
        <option v-for="[value, label] in GRANULARITY_ENTRIES" :key="value" :value="value">{{ label }}</option>
      </select>
    </div>

    <div class="metrics-filters__group">
      <label for="metrics-date-from">Desde</label>
      <input id="metrics-date-from" type="date" v-model="local.dateFrom" />
    </div>

    <div class="metrics-filters__group">
      <label for="metrics-date-to">Hasta</label>
      <input id="metrics-date-to" type="date" v-model="local.dateTo" />
    </div>

    <div class="metrics-filters__group">
      <label for="metrics-status">Estado</label>
      <select id="metrics-status" v-model="local.status">
        <option :value="null">Todas</option>
        <option v-for="[value, label] in STATUS_ENTRIES" :key="value" :value="value">{{ label }}</option>
      </select>
    </div>

    <div class="metrics-filters__group">
      <label for="metrics-agent">Asesor</label>
      <select id="metrics-agent" v-model="local.agentId">
        <option :value="null">Todos</option>
        <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
    </div>

    <button class="metrics-filters__apply" :disabled="loading" @click="apply">
      {{ loading ? 'Cargando…' : 'Aplicar' }}
    </button>
  </div>
</template>

<style scoped>
.metrics-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px;
}
.metrics-filters__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.metrics-filters__group label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.metrics-filters__corridor {
  display: flex;
  align-items: center;
  gap: 6px;
}
.metrics-filters select,
.metrics-filters input {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 0.9rem;
  background: #fff;
  color: #111827;
}
.metrics-filters__apply {
  margin-left: auto;
  border: none;
  background: #2563eb;
  color: #fff;
  border-radius: 8px;
  padding: 9px 18px;
  font-weight: 600;
  cursor: pointer;
}
.metrics-filters__apply:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
