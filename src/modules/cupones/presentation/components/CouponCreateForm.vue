<script setup lang="ts">
import { reactive } from 'vue'

interface CouponFormModel {
  code: string
  discount_percentage: string
  max_uses: string
  origin_currency: string
  destination_currency: string
  start_date: string
  end_date: string
  is_active: boolean
}

const props = defineProps<{
  isSaving: boolean
}>()

const emit = defineEmits<{
  submit: [payload: CouponFormModel]
}>()

const form = reactive<CouponFormModel>({
  code: '',
  discount_percentage: '',
  max_uses: '',
  origin_currency: 'PEN',
  destination_currency: 'PEN',
  start_date: '',
  end_date: '',
  is_active: true
})

function resetForm(): void {
  form.code = ''
  form.discount_percentage = ''
  form.max_uses = ''
  form.origin_currency = 'PEN'
  form.destination_currency = 'PEN'
  form.start_date = ''
  form.end_date = ''
  form.is_active = true
}

async function submitForm(): Promise<void> {
  emit('submit', { ...form })
}

defineExpose({ resetForm })
</script>

<template>
  <section class="rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-[#007bff]/5">
    <div class="mb-4">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Operaciones</p>
      <h2 class="text-xl font-semibold text-[#232b4d]">Crear cupón</h2>
    </div>

    <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-4" @submit.prevent="submitForm">
      <label class="block text-sm text-[#4d5a77]">
        Código
        <input
          v-model="form.code"
          type="text"
          maxlength="32"
          class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm uppercase text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
        />
      </label>

      <label class="block text-sm text-[#4d5a77]">
        Descuento %
        <input
          v-model="form.discount_percentage"
          type="number"
          inputmode="decimal"
          min="0"
          max="100"
          step="0.01"
          class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
        />
      </label>

      <label class="block text-sm text-[#4d5a77]">
        Usos máximos
        <input
          v-model="form.max_uses"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
        />
      </label>

      <label class="flex items-end gap-3 rounded-xl border border-[#dbe7fb] bg-[#f7fbff] px-4 py-3 text-sm font-medium text-[#232b4d]">
        <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-[#a6c2ef]" />
        Cupón activo
      </label>

      <label class="block text-sm text-[#4d5a77]">
        Moneda origen
        <input
          v-model="form.origin_currency"
          type="text"
          maxlength="3"
          class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm uppercase text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
        />
      </label>

      <label class="block text-sm text-[#4d5a77]">
        Moneda destino
        <input
          v-model="form.destination_currency"
          type="text"
          maxlength="3"
          class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm uppercase text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
        />
      </label>

      <label class="block text-sm text-[#4d5a77]">
        Inicio
        <input
          v-model="form.start_date"
          type="datetime-local"
          class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
        />
      </label>

      <label class="block text-sm text-[#4d5a77]">
        Fin
        <input
          v-model="form.end_date"
          type="datetime-local"
          class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
        />
      </label>

      <div class="flex items-end gap-3 xl:col-span-4">
        <button
          type="submit"
          class="rounded-xl bg-gradient-to-r from-[#007aff] to-[#4A52D8] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="props.isSaving"
        >
          {{ props.isSaving ? 'Creando...' : 'Crear cupón' }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-[#c9d8f5] bg-white px-5 py-2.5 text-sm font-medium text-[#4d5a77] hover:bg-[#f7fbff]"
          :disabled="props.isSaving"
          @click="resetForm"
        >
          Limpiar
        </button>
      </div>
    </form>
  </section>
</template>
