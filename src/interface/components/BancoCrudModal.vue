<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useCuentasBancariasStore } from '@/modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller'
import BancoCrudForm from '@/interface/components/BancoCrudForm.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** País del flujo de cuenta (prefijo al crear un banco nuevo). */
    hintCountry?: 'pe' | 'br'
    /** Si true, tras cargar el catálogo agrega una fila vacía al final. */
    startOnCreateForm?: boolean
  }>(),
  { startOnCreateForm: false }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [payload?: { selectBankId?: string; deletedBankId?: string }]
}>()

const cuentasStore = useCuentasBancariasStore()

const loading = ref(false)
const listRefreshing = ref(false)
const formRef = ref<InstanceType<typeof BancoCrudForm> | null>(null)

async function hydrateBankList() {
  if (cuentasStore.banks.length > 0) {
    listRefreshing.value = true
    await cuentasStore.loadBanks(true).finally(() => {
      listRefreshing.value = false
    })
    return
  }
  loading.value = true
  try {
    await cuentasStore.loadBanks(false)
  } finally {
    loading.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    await hydrateBankList()
    await nextTick()
    formRef.value?.initFromCatalog(props.startOnCreateForm)
  }
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#dbe4f0] bg-white shadow-2xl shadow-slate-900/20"
        @click.stop
      >
        <div class="flex items-start justify-between gap-4 border-b border-[#e5eaf2] px-6 py-5">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-brasper-indigoStrong">
              Catálogo
            </p>
            <h2 class="mt-1 text-xl font-semibold text-[#111827]">Bancos</h2>
            <p class="mt-1 text-sm text-[#64748b]">
              Edita los registros en la tabla. Usa
              <span class="font-semibold text-brasper-indigoStrong">+</span>
              para agregar filas nuevas. Banco, moneda y país son obligatorios.
              <span v-if="listRefreshing" class="ml-2 font-medium text-[#0369a1]">· Sincronizando…</span>
            </p>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dbe4f0] bg-white text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#111827]"
            title="Cerrar"
            @click="close"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <BancoCrudForm
          ref="formRef"
          :loading="loading"
          :hint-country="hintCountry"
          @saved="(payload) => emit('saved', payload)"
          @close="close"
        />
      </div>
    </div>
  </Teleport>
</template>
