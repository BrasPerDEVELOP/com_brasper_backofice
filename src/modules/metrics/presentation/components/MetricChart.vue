<script setup lang="ts">
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexChartConfig } from '../composables/use_metric_chart_options'

type ApexChartType = 'line' | 'bar' | 'area'

const props = withDefaults(
  defineProps<{
    title: string
    config: ApexChartConfig
    height?: number
    empty?: boolean
  }>(),
  { height: 300, empty: false },
)

const chartType = computed<ApexChartType>(() => {
  const chart = props.config.options.chart as { type?: ApexChartType } | undefined
  return chart?.type ?? 'line'
})
</script>

<template>
  <div class="metric-chart">
    <h3 class="metric-chart__title">{{ title }}</h3>
    <div v-if="empty" class="metric-chart__empty">Sin datos para el rango seleccionado</div>
    <VueApexCharts
      v-else
      :type="chartType"
      :options="config.options"
      :series="config.series"
      :height="height"
    />
  </div>
</template>

<style scoped>
.metric-chart {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}
.metric-chart__title {
  margin: 0 0 8px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #111827;
}
.metric-chart__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 240px;
  color: #9ca3af;
  font-size: 0.9rem;
}
</style>
