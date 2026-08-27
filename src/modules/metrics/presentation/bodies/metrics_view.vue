<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RefreshCw } from '@lucide/vue'
import EmptyState from '@/interface/widgets/EmptyState.vue'
import PageHeader from '@/interface/widgets/PageHeader.vue'
import {
  DEFAULT_METRICS_FILTERS,
  METRICS_CORRIDORS,
  type CurrencyCode,
  type Granularity,
  type MetricsFilters
} from '../../domain/models'
import MetricChart from '../components/MetricChart.vue'
import MetricKpiCard from '../components/MetricKpiCard.vue'
import MetricsFilterBar from '../components/MetricsFilterBar.vue'
import {
  buildAgentVolumeChart,
  buildPeriodCountChart,
  buildPeriodVolumeChart,
  buildSingleSeriesChart,
  type MetricChartType
} from '../composables/use_metric_chart_options'
import { useMetricsStore } from '../controllers/use_metrics_store_controller'

const store = useMetricsStore()
const route = useRoute()
const router = useRouter()

const chartTypes = reactive<Record<string, MetricChartType>>({
  envios: 'bar',
  volumen: 'line',
  clientes: 'line',
  estados: 'bar',
  etiquetas: 'donut',
  asesoresEnvios: 'bar',
  asesoresVolumen: 'bar'
})

const STATUS_LABELS: Record<string, string> = {
  verification: 'En verificación',
  verified: 'Verificado',
  completed: 'Finalizada',
  failed: 'Fallida'
}

const currencies = computed<CurrencyCode[]>(() => {
  if (store.filters.corridor === 'all') return ['PEN', 'BRL', 'USD']
  return [store.filters.corridor.split('_')[0] as CurrencyCode]
})
const hasData = computed(() => store.totals.enviosCount > 0)
const statusLabels = computed(() =>
  (store.metrics?.breakdownByStatus ?? []).map((item) => STATUS_LABELS[item.key] ?? item.key)
)
const statusValues = computed(() =>
  (store.metrics?.breakdownByStatus ?? []).map((item) => item.count)
)
const tagLabels = computed(() => (store.metrics?.breakdownByTag ?? []).map((item) => item.label))
const tagValues = computed(() => (store.metrics?.breakdownByTag ?? []).map((item) => item.count))
const agents = computed(() => store.metrics?.breakdownByAgent ?? [])

const enviosChart = computed(() =>
  buildPeriodCountChart(store.series, store.granularity, 'envios', chartTypes.envios ?? 'bar')
)
const volumeChart = computed(() =>
  buildPeriodVolumeChart(
    store.series,
    store.granularity,
    currencies.value,
    chartTypes.volumen ?? 'line'
  )
)
const clientsChart = computed(() =>
  buildPeriodCountChart(store.series, store.granularity, 'clientes', chartTypes.clientes ?? 'line')
)
const statusChart = computed(() =>
  buildSingleSeriesChart(
    statusLabels.value,
    statusValues.value,
    'Transacciones',
    chartTypes.estados ?? 'bar'
  )
)
const tagChart = computed(() =>
  buildSingleSeriesChart(
    tagLabels.value,
    tagValues.value,
    'Transacciones etiquetadas',
    chartTypes.etiquetas ?? 'donut'
  )
)
const advisorShipmentsChart = computed(() =>
  buildSingleSeriesChart(
    agents.value.map((item) => item.agentName),
    agents.value.map((item) => item.enviosCount),
    'Envíos gestionados',
    chartTypes.asesoresEnvios ?? 'bar',
    { horizontal: true }
  )
)
const advisorVolumeChart = computed(() =>
  buildAgentVolumeChart(agents.value, currencies.value, chartTypes.asesoresVolumen ?? 'bar')
)

function formatInt(value: number): string {
  return value.toLocaleString('es-PE')
}

function formatMoney(value: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

function queryValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function filtersFromQuery(): MetricsFilters {
  const corridorRaw = queryValue(route.query.corridor)
  const corridor = METRICS_CORRIDORS.some((item) => item.value === corridorRaw)
    ? (corridorRaw as MetricsFilters['corridor'])
    : DEFAULT_METRICS_FILTERS.corridor
  const granularityRaw = queryValue(route.query.granularity)
  const granularity: Granularity =
    granularityRaw === 'day' || granularityRaw === 'month' || granularityRaw === 'year'
      ? granularityRaw
      : 'week'
  const tagQuery = route.query.tags
  const tagIds = Array.isArray(tagQuery)
    ? tagQuery.filter((item): item is string => typeof item === 'string')
    : typeof tagQuery === 'string'
      ? [tagQuery]
      : []
  return {
    corridor,
    granularity,
    dateFrom: queryValue(route.query.from),
    dateTo: queryValue(route.query.to),
    status: queryValue(route.query.status),
    agentId: queryValue(route.query.agent),
    tagIds
  }
}

async function applyFilters(filters: MetricsFilters) {
  await router.replace({
    query: {
      corridor: filters.corridor === 'all' ? undefined : filters.corridor,
      granularity: filters.granularity === 'week' ? undefined : filters.granularity,
      from: filters.dateFrom || undefined,
      to: filters.dateTo || undefined,
      status: filters.status || undefined,
      agent: filters.agentId || undefined,
      tags: filters.tagIds.length ? filters.tagIds : undefined
    }
  })
  await store.applyFilters(filters)
}

async function resetFilters() {
  await router.replace({ query: {} })
  await store.applyFilters({ ...DEFAULT_METRICS_FILTERS, tagIds: [] })
}

onMounted(async () => {
  store.filters = filtersFromQuery()
  await store.loadMetricsOverview()
})
</script>

<template>
  <main class="metrics-view">
    <PageHeader
      eyebrow="Operaciones"
      title="Panel de métricas"
      subtitle="Envíos, dinero, clientes y desempeño de asesores bajo un mismo conjunto de filtros."
    >
      <template #actions>
        <span v-if="store.corridor" class="metrics-view__scope">{{ store.corridor }}</span>
        <button
          class="metrics-view__refresh"
          type="button"
          :disabled="store.isLoading"
          @click="store.loadMetricsOverview()"
        >
          <RefreshCw :size="16" :class="{ spinning: store.isLoading }" aria-hidden="true" />
          Actualizar
        </button>
      </template>
    </PageHeader>

    <MetricsFilterBar
      :model-value="store.filters"
      :agents="store.availableAgents"
      :tags="store.availableTags"
      :loading="store.isLoading"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <div v-if="store.error" class="metrics-view__error" role="alert">
      <span>{{ store.error }}</span>
      <button type="button" @click="store.loadMetricsOverview()">Reintentar</button>
    </div>

    <section class="metrics-view__kpis" aria-label="Indicadores principales">
      <MetricKpiCard
        label="Envíos totales"
        :value="formatInt(store.totals.enviosCount)"
        hint="Transacciones dentro del rango"
        accent="#3346a8"
        :help="{
          what: 'Cantidad total de envíos que cumplen los filtros.',
          calculation:
            'Conteo de transacciones no eliminadas dentro del rango y corredor seleccionados.',
          interpretation:
            'Al cambiar un filtro, este total y todos los gráficos usan exactamente el mismo universo.'
        }"
      />
      <MetricKpiCard
        label="Clientes nuevos"
        :value="formatInt(store.totals.clientesNuevos)"
        hint="Según etiqueta configurada"
        accent="#13a37f"
        :help="{
          what: 'Transacciones identificadas como captación de cliente nuevo.',
          calculation: 'Cuenta transacciones con la etiqueta marcada como counts_as_new_client.',
          interpretation: 'Si ninguna etiqueta tiene esa configuración, el indicador será cero.'
        }"
      />
      <MetricKpiCard
        label="Asesores activos"
        :value="formatInt(store.totals.activeAgents)"
        hint="Con al menos un envío"
        accent="#08a7c7"
        :help="{
          what: 'Número de asesores que gestionaron al menos un envío filtrado.',
          calculation:
            'Cuenta asesores distintos con transacciones; Sin asesor se muestra aparte y no suma aquí.',
          interpretation: 'Permite comparar carga operativa con la cantidad de personas activas.'
        }"
      />
      <MetricKpiCard
        v-for="currency in currencies"
        :key="currency"
        :label="`Dinero enviado · ${currency}`"
        :value="formatMoney(store.totals.volumeOrigin[currency], currency)"
        hint="Monto en moneda de origen"
        accent="#f59e0b"
        :help="{
          what: `Volumen total originado en ${currency}.`,
          calculation: `Suma origin_amount únicamente para transacciones cuya moneda de origen es ${currency}.`,
          interpretation:
            'Las monedas nunca se convierten ni se suman entre sí; cada total conserva su unidad.'
        }"
      />
    </section>

    <EmptyState
      v-if="!store.isLoading && !store.error && !hasData"
      title="No hay transacciones para estos filtros"
      description="Prueba otro corredor, amplía el rango de fechas o limpia los filtros avanzados."
    >
      <template #actions>
        <button class="metrics-view__empty-action" type="button" @click="resetFilters">
          Limpiar filtros
        </button>
      </template>
    </EmptyState>

    <section v-else class="metrics-view__charts" aria-label="Gráficos de métricas">
      <MetricChart
        title="Evolución de envíos"
        subtitle="Cantidad por periodo"
        :chart-type="chartTypes.envios ?? 'bar'"
        :config="enviosChart"
        :loading="store.isLoading"
        :empty="!store.series.length"
        :help="{
          what: 'Cómo se distribuyen los envíos a lo largo del tiempo.',
          calculation: 'Agrupa el conteo de transacciones por día, semana o mes.',
          interpretation:
            'Pasa el cursor por cada punto o barra para ver el valor exacto del periodo.'
        }"
        @update:chart-type="chartTypes.envios = $event"
      />
      <MetricChart
        title="Dinero enviado por periodo"
        subtitle="Volumen en moneda de origen"
        :chart-type="chartTypes.volumen ?? 'line'"
        :config="volumeChart"
        :loading="store.isLoading"
        :empty="!store.series.length"
        :help="{
          what: 'Monto enviado en cada periodo, separado por moneda.',
          calculation: 'Suma origin_amount por periodo y moneda de origen.',
          interpretation:
            'Las series PEN, BRL y USD se comparan visualmente, pero no se suman entre sí.'
        }"
        @update:chart-type="chartTypes.volumen = $event"
      />
      <MetricChart
        title="Clientes nuevos"
        subtitle="Captación por periodo"
        :chart-type="chartTypes.clientes ?? 'line'"
        :config="clientsChart"
        :loading="store.isLoading"
        :empty="!store.series.length"
        :help="{
          what: 'Evolución de captaciones identificadas por el equipo.',
          calculation:
            'Agrupa por periodo las transacciones con la etiqueta configurada para cliente nuevo.',
          interpretation: 'Un aumento muestra más captaciones registradas en ese periodo.'
        }"
        @update:chart-type="chartTypes.clientes = $event"
      />
      <MetricChart
        title="Distribución por estado"
        subtitle="Situación actual de las transacciones"
        :chart-type="chartTypes.estados ?? 'bar'"
        :config="statusChart"
        :loading="store.isLoading"
        :empty="!statusValues.length"
        :help="{
          what: 'Cantidad de transacciones en cada estado operativo.',
          calculation:
            'Agrupa por status; verified incluye los estados legados equivalentes y checklist confirmado.',
          interpretation:
            'Sirve para detectar acumulaciones en verificación, finalizadas o fallidas.'
        }"
        @update:chart-type="chartTypes.estados = $event"
      />
      <MetricChart
        title="Distribución por etiquetas"
        subtitle="Clasificación comercial y operativa"
        :chart-type="chartTypes.etiquetas ?? 'donut'"
        :config="tagChart"
        :loading="store.isLoading"
        :empty="!tagValues.length"
        :help="{
          what: 'Cuántas transacciones tienen cada etiqueta.',
          calculation: 'Cuenta transacciones distintas por etiqueta dentro del universo filtrado.',
          interpretation:
            'Una transacción puede tener varias etiquetas, por eso la suma puede superar el total de envíos.'
        }"
        @update:chart-type="chartTypes.etiquetas = $event"
      />
      <MetricChart
        title="Envíos por asesor"
        subtitle="Incluye operaciones sin asignación"
        :chart-type="chartTypes.asesoresEnvios ?? 'bar'"
        :config="advisorShipmentsChart"
        :loading="store.isLoading"
        :empty="!agents.length"
        :height="340"
        :help="{
          what: 'Total de envíos gestionados por cada asesor.',
          calculation:
            'Agrupa el conteo por agent_id; los registros sin agent_id aparecen como Sin asesor.',
          interpretation:
            'Permite comparar carga de trabajo e identificar envíos pendientes de asignación.'
        }"
        @update:chart-type="chartTypes.asesoresEnvios = $event"
      />
      <MetricChart
        class="metrics-view__wide-chart"
        title="Dinero enviado por asesor"
        subtitle="Volumen gestionado, separado por moneda"
        :chart-type="chartTypes.asesoresVolumen ?? 'bar'"
        :config="advisorVolumeChart"
        :loading="store.isLoading"
        :empty="!agents.length"
        :height="380"
        :help="{
          what: 'Monto total de origen gestionado por cada asesor.',
          calculation:
            'Suma origin_amount por agent_id y moneda de origen; Sin asesor conserva las operaciones no asignadas.',
          interpretation: 'Compara volumen gestionado sin mezclar PEN, BRL y USD.'
        }"
        @update:chart-type="chartTypes.asesoresVolumen = $event"
      />
    </section>
  </main>
</template>

<style scoped>
.metrics-view {
  display: grid;
  gap: 18px;
  padding-bottom: 36px;
}
.metrics-view__scope {
  padding: 7px 10px;
  border: 1px solid #ccd6e5;
  border-radius: 999px;
  color: #3346a8;
  background: #f4f6ff;
  font-size: 0.76rem;
  font-weight: 700;
}
.metrics-view__refresh,
.metrics-view__empty-action {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid #3346a8;
  border-radius: 9px;
  color: #fff;
  background: #3346a8;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
.metrics-view__refresh:disabled {
  opacity: 0.6;
  cursor: wait;
}
.metrics-view__refresh .spinning {
  animation: spin 0.8s linear infinite;
}
.metrics-view__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  color: #9f1239;
  background: #fff1f2;
  font-size: 0.82rem;
}
.metrics-view__error button {
  border: 0;
  color: #9f1239;
  background: transparent;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
}
.metrics-view__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}
.metrics-view__charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.metrics-view__wide-chart {
  grid-column: 1 / -1;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 900px) {
  .metrics-view__charts {
    grid-template-columns: 1fr;
  }
  .metrics-view__wide-chart {
    grid-column: auto;
  }
}
</style>
