<script setup lang="ts">
import MetricHelpTooltip from './MetricHelpTooltip.vue'

withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    accent?: string
    help: { what: string; calculation: string; interpretation: string }
  }>(),
  { hint: '', accent: '#3346a8' }
)
</script>

<template>
  <article class="kpi-card" :style="{ '--accent': accent }">
    <div class="kpi-card__top">
      <span class="kpi-card__label">{{ label }}</span>
      <MetricHelpTooltip :title="label" v-bind="help" />
    </div>
    <strong class="kpi-card__value">{{ value }}</strong>
    <span v-if="hint" class="kpi-card__hint">{{ hint }}</span>
  </article>
</template>

<style scoped>
.kpi-card {
  min-width: 0;
  padding: 16px;
  border: 1px solid #dfe6f0;
  border-top: 3px solid var(--accent);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 7px 20px rgb(15 23 42 / 4%);
}
.kpi-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kpi-card__label {
  color: #64748b;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.kpi-card__value {
  display: block;
  margin-top: 8px;
  color: #17213a;
  font-size: clamp(1.35rem, 2vw, 1.75rem);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.kpi-card__hint {
  display: block;
  margin-top: 6px;
  color: #718096;
  font-size: 0.76rem;
}
</style>
