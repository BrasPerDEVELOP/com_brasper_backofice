<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef } from 'vue'
import BancoCrudForm from '@/interface/components/BancoCrudForm.vue'
import { useAuthStore } from '@/modules/auth/presentation/controllers/use_auth_store_controller'
import { useCuentasBancariasStore } from '../controllers/use_cuentas_bancarias_store_controller'

const authStore = useAuthStore()
const cuentasStore = useCuentasBancariasStore()
const formRef = useTemplateRef<InstanceType<typeof BancoCrudForm>>('form')
const loading = shallowRef(true)
const successMessage = shallowRef('')

const canCreate = computed(() => authStore.hasPermission('company_bank_accounts.create'))
const canUpdate = computed(() => authStore.hasPermission('company_bank_accounts.update'))
const canDelete = computed(() => authStore.hasPermission('company_bank_accounts.delete'))

async function loadAccounts() {
  loading.value = true
  successMessage.value = ''
  await cuentasStore.loadBanks(true)
  loading.value = false
  await nextTick()
  formRef.value?.initFromCatalog(false)
}

function onSaved() {
  successMessage.value = 'Las cuentas operativas de Brasper se actualizaron correctamente.'
}

onMounted(loadAccounts)
</script>

<template>
  <section class="space-y-5">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">Configuración corporativa</p>
        <h1 class="mt-1 text-2xl font-semibold text-[#1f2937]">Cuentas Brasper</h1>
        <p class="mt-1 max-w-3xl text-sm text-[#6b7280]">Administra la razón social, banco, moneda, país y número de las cuentas operativas utilizadas en transferencias.</p>
      </div>
      <button type="button" class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]" :disabled="loading" @click="loadAccounts">Actualizar</button>
    </header>

    <div class="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e3a8a]">
      Estos registros alimentan los bancos y cuentas disponibles en las transferencias. Elimina una cuenta únicamente si ya no está siendo utilizada.
    </div>
    <p v-if="successMessage" class="rounded-lg bg-[#dcfce7] px-4 py-3 text-sm font-medium text-[#166534]">{{ successMessage }}</p>

    <div class="overflow-hidden rounded-2xl border border-[#dbe4f0] bg-white shadow-sm">
      <BancoCrudForm
        ref="form"
        :loading="loading"
        :can-create="canCreate"
        :can-update="canUpdate"
        :can-delete="canDelete"
        :show-close="false"
        @saved="onSaved"
      />
    </div>
  </section>
</template>
