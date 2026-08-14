<script setup lang="ts">
interface Props {
  label: string
  width: number
  minWidth: number
  maxWidth: number
  active?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  resizeStart: [event: PointerEvent]
  resizeStep: [delta: number]
}>()

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  event.stopPropagation()
  emit('resizeStep', event.key === 'ArrowLeft' ? -12 : 12)
}
</script>

<template>
  <button
    type="button"
    class="column-resize-handle"
    :class="{ 'column-resize-handle--active': active }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="`Ajustar ancho de ${label}`"
    :aria-valuemin="minWidth"
    :aria-valuemax="maxWidth"
    :aria-valuenow="width"
    :title="`Arrastra para ajustar ${label}`"
    @pointerdown.stop.prevent="emit('resizeStart', $event)"
    @keydown="onKeydown"
  >
    <span class="column-resize-handle__line" aria-hidden="true" />
  </button>
</template>

<style scoped>
.column-resize-handle {
  position: absolute;
  top: 0;
  right: -6px;
  z-index: 4;
  width: 12px;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}

.column-resize-handle__line {
  display: block;
  width: 2px;
  height: 100%;
  margin: 0 auto;
  background: #2563eb;
  opacity: 0;
  transition: opacity 120ms ease;
}

.column-resize-handle:hover .column-resize-handle__line,
.column-resize-handle:focus-visible .column-resize-handle__line,
.column-resize-handle--active .column-resize-handle__line {
  opacity: 1;
}

.column-resize-handle:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}
</style>
