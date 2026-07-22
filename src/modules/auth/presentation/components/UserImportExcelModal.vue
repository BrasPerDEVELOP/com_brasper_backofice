<script setup lang="ts">
import { ref, watch } from 'vue'
import { createUser } from '../../infrastructure/adapters/users_management_api_adapter'
import { parseUsersFromExcel } from '../../infrastructure/utils/excel_users_parser'

const props = defineProps<{ modelValue: boolean; defaultRole: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  imported: [result: { created: number; errors: string[] }]
}>()
const file = ref<File | null>(null)
const input = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref('')

watch(() => props.modelValue, (open) => {
  if (!open) return
  file.value = null
  error.value = ''
  if (input.value) input.value.value = ''
})

async function submit() {
  if (!file.value) return
  loading.value = true
  error.value = ''
  try {
    const payloads = await parseUsersFromExcel(file.value, props.defaultRole)
    if (!payloads.length) {
      error.value = 'No se encontraron filas válidas con email en el archivo'
      return
    }
    let created = 0
    const errors: string[] = []
    for (const payload of payloads) {
      try {
        await createUser(payload)
        created += 1
      } catch (cause) {
        errors.push(`${payload.email}: ${cause instanceof Error ? cause.message : 'Error'}`)
      }
    }
    emit('imported', { created, errors })
    emit('update:modelValue', false)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Error al procesar el archivo Excel'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
        <h2 class="mb-4 text-lg font-semibold text-[#1f2937]">Importar usuarios desde Excel</h2>
        <div class="mb-4 rounded-lg bg-[#f9fafb] p-4 text-sm text-[#6b7280]"><p class="font-medium text-[#374151]">Formatos aceptados: .xlsx, .xls</p><p class="mt-2">Columnas: email, nombres, apellidos, tipo_documento, n_documento y rol.</p></div>
        <form class="space-y-4" @submit.prevent="submit">
          <label class="block text-sm font-medium text-[#374151]">Archivo<input ref="input" type="file" accept=".xlsx,.xls" required class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm" @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null" /></label>
          <p v-if="error" class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">{{ error }}</p>
          <div class="flex gap-3"><button type="submit" class="rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" :disabled="loading || !file">{{ loading ? 'Importando...' : 'Importar' }}</button><button type="button" class="rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm" @click="emit('update:modelValue', false)">Cancelar</button></div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
