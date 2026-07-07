<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    accent?: string
  }>(),
  { hint: '', accent: '#2563eb' },
)
</script>

<template>
  <div class="kpi-card" :style="{ '--accent': accent }">
    <span class="kpi-card__label">{{ label }}</span>
    <span class="kpi-card__value">{{ value }}</span>
    <span v-if="hint" class="kpi-card__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.kpi-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-left: 4px solid var(--accent);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.kpi-card__label {
  font-size: 0.78rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.kpi-card__value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.1;
}
.kpi-card__hint {
  font-size: 0.8rem;
  color: #6b7280;
}
</style>
