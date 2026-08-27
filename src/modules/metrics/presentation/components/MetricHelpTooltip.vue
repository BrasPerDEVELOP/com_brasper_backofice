<script setup lang="ts">
import { ref } from 'vue'
import { Info } from '@lucide/vue'

defineProps<{
  title: string
  what: string
  calculation: string
  interpretation: string
}>()

const open = ref(false)
</script>

<template>
  <div
    class="metric-help"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @focusin="open = true"
    @focusout="open = false"
    @keydown.esc="open = false"
  >
    <button
      type="button"
      :aria-label="`Cómo se calcula ${title}`"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Info :size="16" aria-hidden="true" />
    </button>
    <div v-if="open" class="metric-help__content" role="tooltip">
      <strong>{{ title }}</strong>
      <p><b>Qué muestra:</b> {{ what }}</p>
      <p><b>Cómo se calcula:</b> {{ calculation }}</p>
      <p><b>Cómo leerlo:</b> {{ interpretation }}</p>
    </div>
  </div>
</template>

<style scoped>
.metric-help {
  position: relative;
  flex: 0 0 auto;
}
.metric-help button {
  display: grid;
  width: 30px;
  height: 30px;
  cursor: help;
  list-style: none;
  place-items: center;
  border: 1px solid #dbe3ef;
  border-radius: 999px;
  color: #52627a;
  background: #fff;
}
.metric-help button:hover,
.metric-help button:focus-visible {
  border-color: #3346a8;
  color: #3346a8;
  outline: none;
  box-shadow: 0 0 0 3px rgb(51 70 168 / 12%);
}
.metric-help__content {
  position: absolute;
  z-index: 40;
  top: calc(100% + 8px);
  right: 0;
  width: min(320px, calc(100vw - 40px));
  padding: 14px;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  background: #fff;
  color: #334155;
  box-shadow: 0 18px 45px rgb(15 23 42 / 18%);
  font-size: 0.78rem;
  line-height: 1.45;
}
.metric-help__content strong {
  color: #17213a;
  font-size: 0.85rem;
}
.metric-help__content p {
  margin: 8px 0 0;
}
.metric-help__content b {
  color: #17213a;
}
</style>
