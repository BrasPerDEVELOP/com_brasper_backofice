<script setup lang="ts">
/**
 * Encabezado de página reutilizable (eyebrow + título + subtítulo + acciones).
 *
 * Mismos estilos Brasper ya usados en `comisiones_view` — no altera el diseño.
 * Acciones a la derecha vía slot `actions`.
 *
 * Uso:
 *   <PageHeader eyebrow="Configuración" title="Comisiones">
 *     <template #actions><button ...>Nuevo</button></template>
 *   </PageHeader>
 */
interface Props {
  title: string
  eyebrow?: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
    <div>
      <p
        v-if="eyebrow"
        class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong"
      >
        {{ eyebrow }}
      </p>
      <h1 class="text-2xl font-semibold text-[#232b4d]">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-[#666]">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
