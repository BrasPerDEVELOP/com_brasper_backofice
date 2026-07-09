<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'
import AppSpinner from './AppSpinner.vue'

/**
 * Diálogo de confirmación reutilizable.
 *
 * Reemplaza `window.confirm(...)` disperso en las vistas por un modal con la
 * estética Brasper ya usada (mismo overlay y botones que los modales existentes).
 *
 * Contrato:
 *   - `v-model` controla la visibilidad (open/close lo maneja el padre).
 *   - `@confirm` se emite al confirmar; el padre ejecuta la acción y cierra
 *     (p. ej. `open = false`), permitiendo flujos async con `:loading`.
 *   - `@cancel` se emite al cancelar; el diálogo se cierra solo.
 *
 * Uso:
 *   <ConfirmDialog
 *     v-model="showDelete"
 *     title="Eliminar cupón"
 *     message="Esta acción no se puede deshacer."
 *     confirm-text="Eliminar"
 *     :loading="deleting"
 *     @confirm="handleDelete"
 *   />
 */
interface Props {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  /** `danger` (rojo, por defecto) para acciones destructivas; `primary` (índigo) para el resto. */
  variant?: 'danger' | 'primary'
  /** Muestra spinner y deshabilita los botones durante una operación async. */
  loading?: boolean
  /** Cerrar al hacer clic en el fondo o presionar Escape. */
  closeOnBackdrop?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '¿Confirmar acción?',
  message: '',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  variant: 'danger',
  loading: false,
  closeOnBackdrop: true
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const open = defineModel<boolean>({ required: true })

const confirmButtonClass = computed(() =>
  props.variant === 'danger'
    ? 'bg-brasper-danger hover:opacity-90'
    : 'bg-brasper-indigoStrong hover:bg-brasper-indigoDark'
)

function onConfirm() {
  if (props.loading) return
  emit('confirm')
}

function onCancel() {
  if (props.loading) return
  emit('cancel')
  open.value = false
}

function onBackdrop() {
  if (props.closeOnBackdrop) onCancel()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closeOnBackdrop) onCancel()
}

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      @click.self="onBackdrop"
    >
      <div class="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-[#1f2937]">{{ title }}</h2>
        <p v-if="message" class="mt-2 text-sm leading-relaxed text-[#6b7280]">{{ message }}</p>

        <slot />

        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb] disabled:opacity-60"
            :disabled="loading"
            @click="onCancel"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
            :class="confirmButtonClass"
            :disabled="loading"
            @click="onConfirm"
          >
            <AppSpinner v-if="loading" size="sm" color-class="text-white" />
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
