<script setup lang="ts">
import { computed } from 'vue'
import { ChartBar, ChartLine, ChartPie } from '@lucide/vue'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexChartConfig, MetricChartType } from '../composables/use_metric_chart_options'
import MetricHelpTooltip from './MetricHelpTooltip.vue'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    config: ApexChartConfig
    chartType: MetricChartType
    height?: number
    empty?: boolean
    loading?: boolean
    help: { what: string; calculation: string; interpretation: string }
  }>(),
  { height: 300, subtitle: '', empty: false, loading: false }
)

const emit = defineEmits<{ 'update:chartType': [value: MetricChartType] }>()
const chartTypes = [
  { value: 'bar' as const, label: 'Barras', icon: ChartBar },
  { value: 'donut' as const, label: 'Dona', icon: ChartPie },
  { value: 'line' as const, label: 'Línea', icon: ChartLine }
]
const apexType = computed(() => props.chartType)
</script>

<template>
  <article class="metric-chart" :aria-busy="loading">
    <header class="metric-chart__header">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <div class="metric-chart__actions">
        <div class="metric-chart__types" role="group" :aria-label="`Tipo de gráfico para ${title}`">
          <button
            v-for="item in chartTypes"
            :key="item.value"
            type="button"
            :class="{ active: chartType === item.value }"
            :aria-pressed="chartType === item.value"
            :title="item.label"
            @click="emit('update:chartType', item.value)"
          >
            <component :is="item.icon" :size="15" aria-hidden="true" />
            <span class="sr-only">{{ item.label }}</span>
          </button>
        </div>
        <MetricHelpTooltip :title="title" v-bind="help" />
      </div>
    </header>
    <div v-if="loading" class="metric-chart__state">
      <span class="metric-chart__spinner" aria-hidden="true" />
      Actualizando datos…
    </div>
    <div v-else-if="empty" class="metric-chart__state">Sin datos para el rango seleccionado</div>
    <VueApexCharts
      v-else
      :type="apexType"
      :options="config.options"
      :series="config.series"
      :height="height"
    />
  </article>
</template>

<style scoped>
.metric-chart {
  min-width: 0;
  padding: 18px;
  border: 1px solid #dfe6f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 5%);
}
.metric-chart__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.metric-chart h3 {
  margin: 0;
  color: #17213a;
  font-size: 0.98rem;
  font-weight: 700;
}
.metric-chart p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.78rem;
}
.metric-chart__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.metric-chart__types {
  display: flex;
  padding: 3px;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #f7f9fc;
}
.metric-chart__types button {
  display: grid;
  width: 28px;
  height: 26px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  color: #64748b;
  background: transparent;
  cursor: pointer;
}
.metric-chart__types button:hover {
  color: #3346a8;
}
.metric-chart__types button.active {
  color: #fff;
  background: #3346a8;
  box-shadow: 0 2px 7px rgb(51 70 168 / 25%);
}
.metric-chart__types button:focus-visible {
  outline: 2px solid #08a7c7;
  outline-offset: 2px;
}
.metric-chart__state {
  display: flex;
  min-height: 260px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: #7b879a;
  font-size: 0.86rem;
}
.metric-chart__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #cbd5e1;
  border-top-color: #3346a8;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 560px) {
  .metric-chart__header {
    align-items: stretch;
    flex-direction: column;
  }
  .metric-chart__actions {
    justify-content: space-between;
  }
}
</style>
