<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchUsers } from '@modules/auth/infrastructure/adapters/users_management_api_adapter'
import { useMetricsStore } from '../controllers/use_metrics_store_controller'
import type { MetricsFilters } from '../../domain/models'
import {
  buildCajaChart,
  buildClientesChart,
  buildEnviosChart,
  buildFacturadoChart,
} from '../composables/use_metric_chart_options'
import WeeklyMetricsFilters from '../components/WeeklyMetricsFilters.vue'
import MetricKpiCard from '../components/MetricKpiCard.vue'
import MetricChart from '../components/MetricChart.vue'

const store = useMetricsStore()
const agents = ref<{ id: string; name: string }[]>([])

const CURRENCY_SYMBOL: Record<string, string> = { PEN: 'S/', BRL: 'R$', USD: '$' }

function money(value: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? ''
  return `${symbol} ${value.toLocaleString('es-PE', { maximumFractionDigits: 2 })}`
}

function count(value: number): string {
  return value.toLocaleString('es-PE', { maximumFractionDigits: 0 })
}

const originCurrency = computed(() => store.filters.originCurrency)
const destinationCurrency = computed(() => store.filters.destinationCurrency)

// Sufijo de título según la granularidad efectiva de los datos.
const PERIOD_SUFFIX: Record<string, string> = { day: 'por día', week: 'por semana', month: 'por mes' }
const periodSuffix = computed(() => PERIOD_SUFFIX[store.granularity] ?? 'por periodo')

const enviosChart = computed(() => buildEnviosChart(store.weeks, store.granularity))
const clientesChart = computed(() => buildClientesChart(store.weeks, store.granularity))
const cajaChart = computed(() => buildCajaChart(store.weeks, store.granularity))
const facturadoChart = computed(() => buildFacturadoChart(store.weeks, store.granularity))

// `empty` por gráfico: cada panel decide su propio estado vacío según su métrica.
const enviosEmpty = computed(() => !store.weeks.some((w) => w.enviosCount > 0 || w.enviosVolumeOrigin > 0))
const clientesEmpty = computed(() => !store.weeks.some((w) => w.clientesNuevos > 0))
const cajaEmpty = computed(() => !store.weeks.some((w) => w.cajaOriginIn !== 0 || w.cajaDestinationOut !== 0))
const facturadoEmpty = computed(() => !store.weeks.some((w) => w.facturadoDestino !== 0))

async function onApply(filters: MetricsFilters) {
  await store.applyFilters(filters)
}

onMounted(async () => {
  try {
    const users = await fetchUsers()
    agents.value = users
      .filter((u) => (u.role ?? '').toLowerCase() !== 'client')
      .map((u) => ({ id: u.id, name: u.name || u.email || u.id }))
  } catch {
    agents.value = []
  }
  await store.loadWeeklyMetrics()
})
</script>

<template>
  <section class="metrics-view">
    <header class="metrics-view__header">
      <h1>Métricas</h1>
      <span v-if="store.corridor" class="metrics-view__corridor">Corredor {{ store.corridor }}</span>
    </header>

    <WeeklyMetricsFilters
      :filters="store.filters"
      :agents="agents"
      :loading="store.isLoading"
      @apply="onApply"
    />

    <p v-if="store.error" class="metrics-view__error">{{ store.error }}</p>

    <div class="metrics-view__kpis">
      <MetricKpiCard
        label="Envíos"
        :value="count(store.totals.enviosCount)"
        :hint="money(store.totals.enviosVolumeOrigin, originCurrency)"
        accent="#2563eb"
      />
      <MetricKpiCard
        label="Clientes nuevos"
        :value="count(store.totals.clientesNuevos)"
        accent="#10b981"
      />
      <MetricKpiCard
        label="Facturado destino"
        :value="money(store.totals.facturadoDestino, destinationCurrency)"
        accent="#8b5cf6"
      />
      <MetricKpiCard
        label="Cuadre de caja"
        :value="money(store.totals.cajaOriginIn, originCurrency)"
        :hint="`→ ${money(store.totals.cajaDestinationOut, destinationCurrency)} · dif ${money(store.totals.cajaDiferencia, originCurrency)}`"
        accent="#f59e0b"
      />
    </div>

    <div class="metrics-view__charts">
      <MetricChart :title="`Envíos ${periodSuffix}`" :config="enviosChart" :empty="enviosEmpty" />
      <MetricChart :title="`Clientes nuevos ${periodSuffix}`" :config="clientesChart" :empty="clientesEmpty" />
      <MetricChart title="Cuadre de caja (soles in vs reales out)" :config="cajaChart" :empty="cajaEmpty" />
      <MetricChart :title="`Facturado destino ${periodSuffix}`" :config="facturadoChart" :empty="facturadoEmpty" />
    </div>
  </section>
</template>

<style scoped>
.metrics-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px;
}
.metrics-view__header {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.metrics-view__header h1 {
  margin: 0;
  font-size: 1.4rem;
  color: #111827;
}
.metrics-view__corridor {
  font-size: 0.85rem;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 3px 10px;
}
.metrics-view__error {
  color: #b91c1c;
  background: #fee2e2;
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0;
}
.metrics-view__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}
.metrics-view__charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
</style>
