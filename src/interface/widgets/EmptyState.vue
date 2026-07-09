<script setup lang="ts">
/**
 * Estado vacío reutilizable (sin resultados / lista vacía).
 *
 * Mismos estilos Brasper ya usados en `blog_view` — no altera el diseño.
 * El ícono por defecto puede reemplazarse vía slot `icon`;
 * acciones opcionales vía slot `actions`.
 *
 * Uso:
 *   <EmptyState title="No se encontraron artículos"
 *               description="Intenta cambiar los términos de búsqueda." />
 */
interface Props {
  title?: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  title: 'No hay datos',
  description: ''
})
</script>

<template>
  <div class="py-16 text-center text-neutral-500">
    <slot name="icon">
      <svg
        class="mx-auto h-12 w-12 text-neutral-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 4a2 2 0 00-2-2m2 2a2 2 0 11-4 0m4 0v8a2 2 0 01-2 2h-1m-4-7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    </slot>
    <h3 class="mt-4 text-lg font-semibold text-neutral-700">{{ title }}</h3>
    <p v-if="description" class="mt-1 text-sm text-neutral-500">{{ description }}</p>
    <div v-if="$slots.actions" class="mt-4 flex justify-center">
      <slot name="actions" />
    </div>
  </div>
</template>
