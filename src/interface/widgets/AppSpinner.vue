<script setup lang="ts">
import { computed } from 'vue'

/**
 * Spinner de carga reutilizable.
 *
 * Reemplaza el SVG `animate-spin` repetido en blog/dashboard/transacciones.
 * Mismos estilos Brasper ya usados en pantalla — no altera el diseño.
 *
 * Uso:
 *   <AppSpinner center label="Cargando artículos..." />      // bloque de carga
 *   <AppSpinner size="sm" color-class="text-white" />        // dentro de un botón
 */
interface Props {
  /** Tamaño del ícono. */
  size?: 'sm' | 'md' | 'lg'
  /** Texto opcional debajo del spinner (solo con `center`). */
  label?: string
  /** Envuelve en un bloque centrado con padding (patrón de carga de tabla). */
  center?: boolean
  /** Clase de color Tailwind del ícono (hereda a `currentColor`). */
  colorClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  label: '',
  center: false,
  colorClass: 'text-brasper-indigoStrong'
})

const sizeClass = computed(() => ({ sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' })[props.size])
</script>

<template>
  <div v-if="center" class="flex flex-col items-center justify-center gap-3 py-16">
    <svg :class="['animate-spin', sizeClass, colorClass]" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
    <span v-if="label" class="text-sm font-medium text-neutral-500">{{ label }}</span>
  </div>
  <svg
    v-else
    :class="['animate-spin', sizeClass, colorClass]"
    fill="none"
    viewBox="0 0 24 24"
    role="status"
    aria-label="Cargando"
  >
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
</template>
