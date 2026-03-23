<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import type { Coupon } from '../../domain/models'

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
  coupons: Coupon[]
  currencyOptions: Array<{ value: string; label: string }>
  savingId: string | null
  deletingId?: string | null
}>()

const emit = defineEmits<{
  save: [id: string, payload: CouponFormModel]
  delete: [coupon: Coupon]
}>()

const editingId = shallowRef<string | null>(null)
const editingForm = reactive<CouponFormModel>({
  code: '',
  discount_percentage: '',
  max_uses: '',
  origin_currency: '',
  destination_currency: '',
  start_date: '',
  end_date: '',
  is_active: false
})

const orderedCoupons = computed(() =>
  [...props.coupons].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
)

function toLocalDateTime(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date)
}

function startEditing(coupon: Coupon): void {
  editingId.value = coupon.id
  editingForm.code = coupon.code
  editingForm.discount_percentage = String(coupon.discount_percentage)
  editingForm.max_uses = String(coupon.max_uses)
  editingForm.origin_currency = coupon.origin_currency
  editingForm.destination_currency = coupon.destination_currency
  editingForm.start_date = toLocalDateTime(coupon.start_date)
  editingForm.end_date = toLocalDateTime(coupon.end_date)
  editingForm.is_active = coupon.is_active
}

function cancelEditing(): void {
  editingId.value = null
  editingForm.code = ''
  editingForm.discount_percentage = ''
  editingForm.max_uses = ''
  editingForm.origin_currency = ''
  editingForm.destination_currency = ''
  editingForm.start_date = ''
  editingForm.end_date = ''
  editingForm.is_active = false
}

function submitEdit(id: string): void {
  emit('save', id, { ...editingForm })
}

function emitDelete(coupon: Coupon): void {
  emit('delete', coupon)
}
</script>

<template>
  <section class="rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-[#007bff]/5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Listado</p>
        <h2 class="text-xl font-semibold text-[#232b4d]">Cupones registrados</h2>
      </div>
      <span class="rounded-full bg-[#eef5ff] px-3 py-1 text-sm font-medium text-[#066ac9]">
        {{ props.coupons.length }} cupones
      </span>
    </div>

    <div v-if="orderedCoupons.length === 0" class="rounded-xl border border-dashed border-[#c9d8f5] bg-[#fbfdff] px-4 py-6 text-sm text-[#667085]">
      Aún no hay cupones creados.
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="coupon in orderedCoupons"
        :key="coupon.id"
        class="rounded-2xl border border-[#dbe7fb] bg-[#fbfdff] p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-semibold text-[#232b4d]">{{ coupon.code }}</h3>
              <span
                :class="[
                  'rounded-full px-2.5 py-1 text-xs font-semibold',
                  coupon.is_active ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'
                ]"
              >
                {{ coupon.is_active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2 text-sm text-[#4d5a77]">
              <span class="rounded-lg bg-white px-2.5 py-1">{{ coupon.discount_percentage }}%</span>
              <span class="rounded-lg bg-white px-2.5 py-1">Usos: {{ coupon.max_uses }}</span>
              <span class="rounded-lg bg-white px-2.5 py-1">
                {{ coupon.origin_currency }} → {{ coupon.destination_currency }}
              </span>
            </div>
            <p class="text-sm text-[#667085]">
              Vigencia: {{ formatDate(coupon.start_date) }} hasta {{ formatDate(coupon.end_date) }}
            </p>
          </div>

          <div v-if="editingId !== coupon.id" class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-xl border border-[#4A52D8]/30 bg-[#4A52D8]/10 px-4 py-2 text-sm font-medium text-[#3C4DA7] hover:bg-[#4A52D8]/20"
              @click="startEditing(coupon)"
            >
              Editar
            </button>
            <button
              type="button"
              class="rounded-xl border border-[#dc3545]/30 bg-[#dc3545]/10 px-4 py-2 text-sm font-medium text-[#dc3545] hover:bg-[#dc3545]/20 disabled:opacity-60"
              :disabled="props.deletingId === coupon.id"
              @click="emitDelete(coupon)"
            >
              {{ props.deletingId === coupon.id ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </div>

        <form
          v-if="editingId === coupon.id"
          class="mt-4 grid gap-4 border-t border-[#dbe7fb] pt-4 md:grid-cols-2 xl:grid-cols-4"
          @submit.prevent="submitEdit(coupon.id)"
        >
          <label class="block text-sm text-[#4d5a77]">
            Código
            <input
              v-model="editingForm.code"
              type="text"
              maxlength="32"
              class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm uppercase text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
            />
          </label>
          <label class="block text-sm text-[#4d5a77]">
            Descuento %
            <input
              v-model="editingForm.discount_percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
            />
          </label>
          <label class="block text-sm text-[#4d5a77]">
            Usos máximos
            <input
              v-model="editingForm.max_uses"
              type="number"
              min="0"
              step="1"
              class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
            />
          </label>
          <label class="flex items-end gap-3 rounded-xl border border-[#dbe7fb] bg-white px-4 py-3 text-sm font-medium text-[#232b4d]">
            <input v-model="editingForm.is_active" type="checkbox" class="h-4 w-4 rounded border-[#a6c2ef]" />
            Cupón activo
          </label>
          <label class="block text-sm text-[#4d5a77]">
            Moneda origen
            <select
              v-model="editingForm.origin_currency"
              class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm uppercase text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
            >
              <option
                v-for="option in props.currencyOptions"
                :key="`edit-origin-${option.value}`"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="block text-sm text-[#4d5a77]">
            Moneda destino
            <select
              v-model="editingForm.destination_currency"
              class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm uppercase text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
            >
              <option
                v-for="option in props.currencyOptions"
                :key="`edit-destination-${option.value}`"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="block text-sm text-[#4d5a77]">
            Inicio
            <input
              v-model="editingForm.start_date"
              type="datetime-local"
              class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
            />
          </label>
          <label class="block text-sm text-[#4d5a77]">
            Fin
            <input
              v-model="editingForm.end_date"
              type="datetime-local"
              class="mt-1 w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2 text-sm text-[#232b4d] outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/20"
            />
          </label>

          <div class="flex items-end gap-3 xl:col-span-4">
            <button
              type="submit"
              class="rounded-xl bg-gradient-to-r from-[#10b981] to-[#5ED6B3] px-5 py-2.5 text-sm font-semibold text-[#06271d] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.savingId === coupon.id"
            >
              {{ props.savingId === coupon.id ? 'Guardando...' : 'Guardar cambios' }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-[#c9d8f5] bg-white px-5 py-2.5 text-sm font-medium text-[#4d5a77] hover:bg-[#f7fbff]"
              :disabled="props.savingId === coupon.id"
              @click="cancelEditing"
            >
              Cancelar
            </button>
          </div>
        </form>
      </article>
    </div>
  </section>
</template>
