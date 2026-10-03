<script setup lang="ts">
import VueApexCharts from 'vue3-apexcharts'
import MetricHelpTooltip from '@modules/metrics/presentation/components/MetricHelpTooltip.vue'
import type { ApexChartConfig } from '../composables/use_gerencia_chart_options'

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    config: ApexChartConfig
    height?: number
    empty?: boolean
    loading?: boolean
    help: { what: string; calculation: string; interpretation: string }
  }>(),
  { height: 300, subtitle: '', empty: false, loading: false }
)
</script>

<template>
  <article class="gerencia-chart" :aria-busy="loading">
    <header class="gerencia-chart__header">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <div class="gerencia-chart__actions">
        <slot name="actions" />
        <MetricHelpTooltip :title="title" v-bind="help" />
      </div>
    </header>
    <div v-if="loading" class="gerencia-chart__state">
      <span class="gerencia-chart__spinner" aria-hidden="true" />
      Actualizando datos…
    </div>
    <div v-else-if="empty" class="gerencia-chart__state">Sin datos para el periodo</div>
    <VueApexCharts
      v-else
      :type="config.type"
      :options="config.options"
      :series="config.series"
      :height="height"
    />
  </article>
</template>

<style scoped>
.gerencia-chart {
  min-width: 0;
  padding: 18px;
  border: 1px solid #dfe6f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 5%);
}
.gerencia-chart__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.gerencia-chart h3 {
  margin: 0;
  color: #17213a;
  font-size: 0.98rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.gerencia-chart p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.78rem;
}
.gerencia-chart__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.gerencia-chart__state {
  display: flex;
  min-height: 260px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: #7b879a;
  font-size: 0.86rem;
}
.gerencia-chart__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #cbd5e1;
  border-top-color: #3346a8;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 560px) {
  .gerencia-chart__header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
