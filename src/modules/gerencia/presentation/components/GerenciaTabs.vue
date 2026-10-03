<script setup lang="ts">
import { RouterLink } from 'vue-router'

const TABS = [
  { to: '/app/gerencia/envios', label: 'Envíos' },
  { to: '/app/gerencia/clientes', label: 'Clientes' },
  { to: '/app/gerencia/montos', label: 'Montos' },
  { to: '/app/gerencia/resultados', label: 'Resultados' }
] as const
</script>

<template>
  <nav class="gerencia-tabs" aria-label="Secciones del panel gerencial">
    <RouterLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      class="gerencia-tabs__tab"
      active-class="gerencia-tabs__tab--active"
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.gerencia-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid #dfe6f0;
  border-radius: 12px;
  background: #f4f6fb;
  overflow-x: auto;
}
.gerencia-tabs__tab {
  padding: 8px 16px;
  border-radius: 9px;
  color: #475569;
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.gerencia-tabs__tab:hover {
  color: #3346a8;
}
.gerencia-tabs__tab--active {
  color: #fff;
  background: #3346a8;
  box-shadow: 0 2px 7px rgb(51 70 168 / 25%);
}
.gerencia-tabs__tab:focus-visible {
  outline: 2px solid #08a7c7;
  outline-offset: 2px;
}
</style>
