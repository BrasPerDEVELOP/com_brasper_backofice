<script setup lang="ts">
import { AppTooltip } from '@interface/widgets'

withDefaults(
  defineProps<{
    names?: string
    phone?: string | null
    creating?: boolean
    error?: string
  }>(),
  {
    names: '',
    phone: null,
    creating: false,
    error: ''
  }
)

const emit = defineEmits<{
  'update:names': [value: string]
  'update:phone': [value: string | null]
  advanced: []
  submit: []
  close: []
}>()

function updateNames(event: Event) {
  emit('update:names', (event.target as HTMLInputElement).value)
}

function updatePhone(event: Event) {
  const value = (event.target as HTMLInputElement).value.trim()
  emit('update:phone', value || null)
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="usuario-quick-dialog-title"
  >
    <div class="w-full max-w-lg rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
      <div class="mb-6">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-brasper-indigoStrong">
          Transacciones
        </p>
        <h2 id="usuario-quick-dialog-title" class="mt-1 text-lg font-semibold text-[#1f2937]">
          Creación rápida de cliente
        </h2>
        <p class="mt-2 text-sm text-[#6b7280]">
          Ingresa el nombre para usar al cliente inmediatamente. Puedes completar todos sus datos en la opción avanzada.
        </p>
      </div>

      <form class="space-y-5" @submit.prevent="emit('submit')">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-[#374151]">
            Nombre o razón social <span class="text-[#dc2626]">*</span>
          </label>
          <input
            :value="names"
            type="text"
            autocomplete="name"
            class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
            placeholder="Esperanza Tello"
            autofocus
            @input="updateNames"
          />
        </div>

        <div>
          <div class="mb-1.5 flex items-center gap-1.5">
            <label for="usuario-quick-phone" class="text-sm font-medium text-[#374151]">
              Teléfono <span class="text-xs font-normal text-[#6b7280]">(opcional)</span>
            </label>
            <AppTooltip label="Escribe @ seguido del nombre de usuario para buscarlo en WhatsApp.">
              <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#9ca3af] text-[10px] font-semibold leading-none text-[#6b7280]">?</span>
            </AppTooltip>
          </div>
          <input
            id="usuario-quick-phone"
            :value="phone ?? ''"
            type="text"
            maxlength="100"
            autocomplete="off"
            class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
            placeholder="987654321 o @usuario"
            @input="updatePhone"
          />
        </div>

        <p v-if="error" class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
          {{ error }}
        </p>

        <div class="flex flex-col-reverse gap-3 border-t border-[#e5e7eb] pt-5 sm:flex-row sm:justify-between">
          <button
            type="button"
            class="rounded-lg border border-brasper-indigoStrong bg-white px-4 py-2.5 text-sm font-semibold text-brasper-indigoStrong transition hover:bg-brasper-indigoStrong/5"
            @click="emit('advanced')"
          >
            Creación avanzada
          </button>
          <div class="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
              @click="emit('close')"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-60"
              :disabled="creating"
            >
              {{ creating ? 'Creando…' : 'Crear cliente' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
