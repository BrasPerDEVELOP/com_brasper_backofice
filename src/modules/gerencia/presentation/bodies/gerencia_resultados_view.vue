<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import MetricKpiCard from '@modules/metrics/presentation/components/MetricKpiCard.vue'
import { CURRENCY_LABELS, MONTH_LABELS_ES, type ManagementFilters } from '../../domain/models'
import GerenciaChart from '../components/GerenciaChart.vue'
import {
  buildCountBars,
  buildSignedBars,
  buildTopClientsBars,
  formatMoney,
  monthLabels
} from '../composables/use_gerencia_chart_options'
import { useGerenciaStore } from '../controllers/use_gerencia_store_controller'

const emit = defineEmits<{ 'apply-filters': [patch: Partial<ManagementFilters>] }>()

const store = useGerenciaStore()

const months = computed(() => store.activeMonths)
const labels = computed(() => monthLabels(months.value))
const empty = computed(() => !store.isLoading && months.value.length === 0)

/** Meses con ingreso calculable (todas las tasas del mes registradas). */
const revenueMonths = computed(() => months.value.filter((m) => m.revenuePen != null))
const revenueLabels = computed(() => monthLabels(revenueMonths.value))
const revenueEmpty = computed(() => !store.isLoading && revenueMonths.value.length === 0)

const revenueChart = computed(() =>
  buildCountBars(
    revenueLabels.value,
    revenueMonths.value.map((m) => Math.round(m.revenuePen ?? 0)),
    'Ingreso bruto',
    '#e11d74'
  )
)
const expensesChart = computed(() =>
  buildCountBars(labels.value, months.value.map((m) => Math.round(m.expensesPen)), 'Costos', '#3b82f6')
)
const netChart = computed(() =>
  buildSignedBars(
    revenueLabels.value,
    revenueMonths.value.map((m) => (m.netPen == null ? null : Math.round(m.netPen))),
    'Ganancia neta',
    (v) => (v == null ? '—' : formatMoney(v, 'PEN'))
  )
)

const selectedMonth = computed(() => store.topClients.month)
const selectedMonthLabel = computed(() => MONTH_LABELS_ES[selectedMonth.value - 1] ?? '')
const categoryChart = computed(() => {
  const config = buildTopClientsBars(
    store.expensesByCategory.map((c) => c.category),
    store.expensesByCategory.map((c) => c.share)
  )
  return {
    ...config,
    options: {
      ...config.options,
      colors: ['#3b82f6'],
      dataLabels: {
        enabled: true,
        offsetY: -18,
        style: { colors: ['#17213a'], fontSize: '11px', fontWeight: 700 },
        formatter: (v: number) => `${Math.round(v)}%`
      },
      yaxis: { max: 100, labels: { formatter: (v: number) => `${Math.round(v)}%` } },
      tooltip: {
        y: {
          formatter: (v: number, { dataPointIndex }: { dataPointIndex: number }) => {
            const item = store.expensesByCategory[dataPointIndex]
            return item ? `${v.toFixed(1)}% · ${formatMoney(item.amountPen, 'PEN')}` : `${v}%`
          }
        }
      }
    }
  }
})
const selectableMonths = computed(() => months.value.map((m) => m.month))

function onMonth(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  emit('apply-filters', { topMonth: value >= 1 && value <= 12 ? value : null })
}

const fxMissingText = computed(() =>
  store.fxMissing
    .map((item) => `${MONTH_LABELS_ES[item.month - 1]} (${CURRENCY_LABELS[item.currency]})`)
    .join(', ')
)

function formatPen(value: number | null): string {
  return value == null ? '—' : formatMoney(value, 'PEN')
}
</script>

<template>
  <div class="gerencia-tab">
    <section class="gerencia-tab__kpis" aria-label="Resultados del año">
      <MetricKpiCard
        label="Ingreso bruto del año"
        :value="formatPen(store.totals.revenuePen)"
        hint="Comisiones cobradas, en soles"
        accent="#e11d74"
        :help="{
          what: 'Comisiones cobradas en el año, expresadas en soles.',
          calculation: 'Suma de la comisión de cada transacción, convertida a soles con la tasa mensual de su moneda de origen.',
          interpretation: 'Queda vacío si falta la tasa de algún mes con envíos.'
        }"
      />
      <MetricKpiCard
        label="Costos del año"
        :value="formatMoney(store.totals.expensesPen, 'PEN')"
        hint="Egresos registrados"
        accent="#3b82f6"
        :help="{
          what: 'Egresos de la empresa registrados en el año.',
          calculation: 'Suma de los egresos cargados en Egresos (siempre en soles).',
          interpretation: 'No depende de los filtros de moneda ni razón social: son gastos de la empresa.'
        }"
      />
      <MetricKpiCard
        label="Ganancia neta del año"
        :value="formatPen(store.totals.netPen)"
        hint="Ingreso bruto − costos"
        :accent="(store.totals.netPen ?? 0) < 0 ? '#ef4444' : '#13a37f'"
        :help="{
          what: 'Resultado del año.',
          calculation: 'Ingreso bruto del año menos costos del año.',
          interpretation: 'En rojo cuando los costos superan a las comisiones.'
        }"
      />
    </section>

    <div v-if="store.fxMissing.length" class="gerencia-tab__warning" role="status">
      <strong>Faltan tasas a soles:</strong> {{ fxMissingText }}.
      El ingreso y la ganancia de esos meses no se pueden calcular.
      <RouterLink to="/app/egresos?tab=tasas" class="gerencia-tab__link">Registrar tasas</RouterLink>
    </div>

    <section class="gerencia-tab__charts" aria-label="Gráficos de resultados">
      <GerenciaChart
        title="Ingreso bruto / ventas por mes (en soles)"
        :subtitle="`Comisiones cobradas ${store.filters.year}`"
        :config="revenueChart"
        :loading="store.isLoading"
        :empty="revenueEmpty"
        :help="{
          what: 'Cuánto cobró la empresa en comisiones cada mes.',
          calculation: 'Suma de la comisión de cada transacción del mes, convertida a soles con la tasa mensual.',
          interpretation: 'Los meses sin tasa registrada no se muestran.'
        }"
      />
      <GerenciaChart
        title="Costos por mes (en soles)"
        :subtitle="`Egresos ${store.filters.year}`"
        :config="expensesChart"
        :loading="store.isLoading"
        :empty="empty"
        :help="{
          what: 'Egresos de la empresa por mes.',
          calculation: 'Suma de los egresos registrados en cada mes.',
          interpretation: 'Carga o corrige los egresos en el menú Egresos.'
        }"
      />
      <GerenciaChart
        title="Ganancia neta por mes (en soles)"
        subtitle="Ingreso bruto − costos"
        :config="netChart"
        :loading="store.isLoading"
        :empty="revenueEmpty"
        :help="{
          what: 'Resultado de cada mes.',
          calculation: 'Ingreso bruto del mes menos costos del mes.',
          interpretation: 'Verde ganancia, rojo pérdida.'
        }"
      />
      <GerenciaChart
        title="Costos por categoría"
        :subtitle="selectedMonthLabel ? `${selectedMonthLabel} ${store.filters.year}` : ''"
        :config="categoryChart"
        :loading="store.isLoading"
        :empty="!store.isLoading && store.expensesByCategory.length === 0"
        :help="{
          what: 'Peso de cada categoría de gasto en el mes elegido.',
          calculation: 'Egresos de la categoría entre el total de egresos del mes.',
          interpretation: 'Cambia el mes con el selector; es el mismo mes que el top de clientes.'
        }"
      >
        <template #actions>
          <label class="gerencia-tab__month">
            <span class="sr-only">Mes de los costos por categoría</span>
            <select :value="selectedMonth" :disabled="store.isLoading" @change="onMonth">
              <option v-for="month in selectableMonths" :key="month" :value="month">
                {{ MONTH_LABELS_ES[month - 1] }}
              </option>
            </select>
          </label>
        </template>
      </GerenciaChart>
    </section>

    <RouterLink to="/app/egresos" class="gerencia-tab__cta">Ir a Egresos y tasas a soles →</RouterLink>
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
.gerencia-tab__warning {
  padding: 12px 14px;
  border: 1px solid #fde68a;
  border-radius: 12px;
  color: #92400e;
  background: #fffbeb;
  font-size: 0.82rem;
  line-height: 1.5;
}
.gerencia-tab__link {
  margin-left: 6px;
  color: #3346a8;
  font-weight: 700;
  text-decoration: underline;
}
.gerencia-tab__cta {
  justify-self: end;
  color: #3346a8;
  font-size: 0.82rem;
  font-weight: 700;
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
}
</style>
