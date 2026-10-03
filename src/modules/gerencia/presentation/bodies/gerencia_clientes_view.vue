<script setup lang="ts">
import { computed } from 'vue'
import MetricKpiCard from '@modules/metrics/presentation/components/MetricKpiCard.vue'
import { monthlyChanges, monthlyRetention } from '../../domain/calculations'
import { MONTH_LABELS_ES, type ManagementFilters } from '../../domain/models'
import GerenciaChart from '../components/GerenciaChart.vue'
import {
  buildCountBars,
  buildPercentLine,
  buildTopClientsBars,
  formatInt,
  monthLabels
} from '../composables/use_gerencia_chart_options'
import { useGerenciaStore } from '../controllers/use_gerencia_store_controller'

const emit = defineEmits<{ 'apply-filters': [patch: Partial<ManagementFilters>] }>()

const store = useGerenciaStore()

const months = computed(() => store.activeMonths)
const labels = computed(() => monthLabels(months.value))
const empty = computed(() => !store.isLoading && months.value.length === 0)

const activeChart = computed(() =>
  buildCountBars(labels.value, months.value.map((m) => m.activeClients), 'Clientes activos', '#3b82f6')
)
const variationChart = computed(() =>
  buildPercentLine(
    labels.value,
    monthlyChanges(months.value, store.previousMonth, (m) => m.activeClients),
    'Variación',
    '#3b82f6'
  )
)
const newChart = computed(() =>
  buildCountBars(labels.value, months.value.map((m) => m.newClients), 'Clientes nuevos', '#e11d74')
)
const retentionChart = computed(() =>
  buildPercentLine(labels.value, monthlyRetention(months.value, store.previousMonth), 'TRC', '#13a37f', {
    min: 0
  })
)

const topMonth = computed(() => store.topClients.month)
const topMonthLabel = computed(() => MONTH_LABELS_ES[topMonth.value - 1] ?? '')
const topChart = computed(() =>
  buildTopClientsBars(
    store.topClients.items.map((c) => c.name),
    store.topClients.items.map((c) => c.enviosCount)
  )
)
const selectableMonths = computed(() => months.value.map((m) => m.month))

function onTopMonth(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  emit('apply-filters', { topMonth: value >= 1 && value <= 12 ? value : null })
}

const lastMonth = computed(() => months.value[months.value.length - 1] ?? null)
const lastRetention = computed(() => {
  const series = monthlyRetention(months.value, store.previousMonth)
  const value = series[series.length - 1]
  return value == null ? '—' : `${value}%`
})
</script>

<template>
  <div class="gerencia-tab">
    <section class="gerencia-tab__kpis" aria-label="Indicadores de clientes">
      <MetricKpiCard
        label="Clientes activos del año"
        :value="formatInt(store.totals.activeClients)"
        hint="Con al menos un envío en el año"
        accent="#3b82f6"
        :help="{
          what: 'Clientes distintos que enviaron al menos una vez en el año.',
          calculation: 'Cuenta usuarios distintos con transacciones en el año; no es la suma de los meses porque un cliente repite.',
          interpretation: 'Compáralo con los clientes nuevos para ver cuánto pesa la cartera recurrente.'
        }"
      />
      <MetricKpiCard
        label="Clientes nuevos del año"
        :value="formatInt(store.totals.newClients)"
        hint="Primera transacción en el año"
        accent="#e11d74"
        :help="{
          what: 'Clientes cuya primera transacción histórica ocurrió este año.',
          calculation: 'Toma la fecha de la primera transacción de cada cliente y cuenta las que caen en cada mes.',
          interpretation: 'Los meses iniciales del sistema concentran clientes nuevos porque no hay histórico anterior.'
        }"
      />
      <MetricKpiCard
        :label="`Activos en ${lastMonth ? MONTH_LABELS_ES[lastMonth.month - 1] : '—'}`"
        :value="formatInt(lastMonth?.activeClients ?? 0)"
        :hint="`${formatInt(lastMonth?.newClients ?? 0)} nuevos`"
        accent="#13a37f"
        :help="{
          what: 'Clientes activos del último mes con datos.',
          calculation: 'Usuarios distintos con transacciones en ese mes.',
          interpretation: 'Es el valor de la última barra del gráfico de activos.'
        }"
      />
      <MetricKpiCard
        label="Retención último mes"
        :value="lastRetention"
        hint="TRC"
        accent="#08a7c7"
        :help="{
          what: 'Tasa de retención de clientes del último mes con datos.',
          calculation: '(activos del mes − nuevos del mes) ÷ activos del mes anterior.',
          interpretation: 'Por encima de 100 % significa que volvieron clientes que no enviaron el mes anterior.'
        }"
      />
    </section>

    <section class="gerencia-tab__charts" aria-label="Gráficos de clientes">
      <GerenciaChart
        title="Número de clientes activos por mes"
        :subtitle="`Clientes con envíos ${store.filters.year}`"
        :config="activeChart"
        :loading="store.isLoading"
        :empty="empty"
        :help="{
          what: 'Cuántos clientes distintos enviaron cada mes.',
          calculation: 'Usuarios distintos con al menos una transacción en el mes.',
          interpretation: 'Un cliente que envía varias veces en el mes cuenta una sola vez.'
        }"
      />
      <GerenciaChart
        title="% de variación de clientes activos por mes"
        subtitle="Respecto al mes anterior"
        :config="variationChart"
        :loading="store.isLoading"
        :empty="empty"
        :help="{
          what: 'Cuánto creció o cayó la base de clientes activos frente al mes anterior.',
          calculation: '(activos del mes − activos del mes anterior) ÷ activos del mes anterior. Enero usa diciembre del año anterior.',
          interpretation: 'Si el mes anterior no tiene datos, el punto queda vacío en lugar de mostrar 0.'
        }"
      />
      <GerenciaChart
        title="Clientes nuevos por mes"
        :subtitle="`Captación ${store.filters.year}`"
        :config="newChart"
        :loading="store.isLoading"
        :empty="empty"
        :help="{
          what: 'Clientes que hicieron su primera transacción en cada mes.',
          calculation: 'Primera transacción histórica de cada cliente, agrupada por mes.',
          interpretation: 'No depende de etiquetas: es la primera operación real del cliente.'
        }"
      />
      <GerenciaChart
        title="% tasa de retención de clientes (TRC)"
        subtitle="Clientes recurrentes sobre activos del mes anterior"
        :config="retentionChart"
        :loading="store.isLoading"
        :empty="empty"
        :help="{
          what: 'Qué parte de los clientes del mes anterior volvió a enviar.',
          calculation: '(activos del mes − nuevos del mes) ÷ activos del mes anterior.',
          interpretation: 'Misma fórmula que el reporte de gerencia; valores por encima de 100 % indican reactivación de clientes antiguos.'
        }"
      />
      <GerenciaChart
        class="gerencia-tab__wide"
        title="Clientes top con mayor N° de envíos"
        :subtitle="topMonthLabel ? `${topMonthLabel} ${store.filters.year}` : ''"
        :config="topChart"
        :loading="store.isLoading"
        :empty="!store.isLoading && store.topClients.items.length === 0"
        :height="380"
        :help="{
          what: 'Los clientes que más envíos hicieron en el mes elegido.',
          calculation: 'Conteo de transacciones por cliente en el mes, ordenado de mayor a menor (máximo 15).',
          interpretation: 'Cambia el mes con el selector; por defecto se muestra el último mes con envíos.'
        }"
      >
        <template #actions>
          <label class="gerencia-tab__month">
            <span class="sr-only">Mes del top de clientes</span>
            <select :value="topMonth" :disabled="store.isLoading" @change="onTopMonth">
              <option v-for="month in selectableMonths" :key="month" :value="month">
                {{ MONTH_LABELS_ES[month - 1] }}
              </option>
            </select>
          </label>
        </template>
      </GerenciaChart>
    </section>
  </div>
</template>

<style scoped>
.gerencia-tab {
  display: grid;
  gap: 16px;
}
.gerencia-tab__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}
.gerencia-tab__charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.gerencia-tab__wide {
  grid-column: 1 / -1;
}
.gerencia-tab__month select {
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #17213a;
  background: #fff;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
@media (max-width: 900px) {
  .gerencia-tab__charts {
    grid-template-columns: 1fr;
  }
  .gerencia-tab__wide {
    grid-column: auto;
  }
}
</style>
