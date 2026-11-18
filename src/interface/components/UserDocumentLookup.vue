<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { lookupDocument, type DocumentLookupResult } from '@/modules/auth/infrastructure/adapters/document_lookup_api_adapter'
import type { UserIdentification } from '@/modules/auth/infrastructure/adapters/users_management_api_adapter'

const props = defineProps<{ identification?: UserIdentification; disabled?: boolean }>()
const emit = defineEmits<{
  resolved: [result: DocumentLookupResult]
  apply: [result: DocumentLookupResult]
  busy: [value: boolean]
}>()
const loading = ref(false)
const error = ref('')
const result = ref<DocumentLookupResult | null>(null)
const type = computed(() => props.identification?.document_type ?? '')
const number = computed(() => (props.identification?.document_number ?? '').replace(/[\s./-]/g, '').toUpperCase())
const supported = computed(() => ['dni', 'ruc', 'cpf', 'cnpj'].includes(type.value))
const valid = computed(() => {
  const patterns: Record<string, RegExp> = { dni: /^\d{8}$/, ruc: /^\d{11}$/, cpf: /^\d{11}$/, cnpj: /^[A-Z0-9]{12}\d{2}$/ }
  return patterns[type.value]?.test(number.value) ?? false
})
let generation = 0
let alive = true
watch([type, number], () => {
  generation++
  result.value = null
  error.value = ''
}, { flush: 'sync' })
onBeforeUnmount(() => { generation++; alive = false })

async function consult() {
  if (!valid.value || loading.value || props.disabled || result.value) return
  const current = ++generation
  loading.value = true
  emit('busy', true)
  error.value = ''
  try {
    const data = await lookupDocument(type.value, number.value)
    if (current !== generation) return
    result.value = data
    emit('resolved', data)
  } catch (reason) {
    if (current === generation) error.value = reason instanceof Error ? reason.message : 'No se pudo consultar el documento.'
  } finally {
    loading.value = false
    if (alive) emit('busy', false)
  }
}
</script>

<template>
  <div class="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:col-span-2">
    <p class="text-sm text-[#374151]">Empieza por el documento principal para completar los datos del cliente.</p>
    <button v-if="supported" type="button" :disabled="!valid || loading || disabled || !!result"
      class="rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      @click="consult">{{ loading ? 'Consultando…' : 'Consultar datos' }}</button>
    <p v-if="!supported" class="text-xs text-[#6b7280]">Consulta disponible para DNI, RUC, CPF y CNPJ. Para otros documentos, completa los datos manualmente.</p>
    <p v-else-if="!valid" class="text-xs text-[#6b7280]">Completa el número de documento para consultar.</p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <div v-if="result" role="status" class="space-y-2 text-sm text-[#374151]">
      <p>Datos encontrados: <strong>{{ result.names }} {{ result.lastnames }}</strong></p>
      <p class="text-xs">Revisa los datos antes de guardar. Puedes editarlos. {{ type === 'cpf' ? 'CPF devuelve el nombre completo en Nombres.' : '' }}</p>
      <button type="button" :disabled="disabled" class="font-medium text-brasper-indigoStrong disabled:opacity-50" @click="emit('apply', result)">Usar estos datos</button>
    </div>
  </div>
</template>
