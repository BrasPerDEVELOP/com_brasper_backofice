<script setup lang="ts">
/**
 * Fase C3 — Tabla reutilizable (misma estética Brasper)
 * TODO: props columns, rows, sortable, @row-click
 */
defineOptions({ name: 'DataTable' })
</script>

<template>
  <div class="rounded-md border overflow-auto">
    <!-- TODO: implementar o extraer markup de TransactionTable -->
    <slot />
  </div>
</template>
