<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  useComisionesStore,
  useComisionesContabilidadStore
} from '../controllers/use_comisiones_store_controller'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import { PageHeader } from '@interface/widgets'
import CommissionsPanel from '../components/CommissionsPanel.vue'
import AccountingCommissionFixedSettings from '../components/AccountingCommissionFixedSettings.vue'

type CommissionScope = 'sales' | 'accounting'

const authStore = useAuthStore()
const comisionesStore = useComisionesStore()
const comisionesContabilidadStore = useComisionesContabilidadStore()

/**
 * Las comisiones de contabilidad son para el equipo contable: se muestran a
 * quien puede ver Contabilidad (el rol admin pasa todos los chequeos).
 * El API las protege con los mismos permisos `commissions.*` que las de venta.
 */
const canViewAccountingScope = computed(() => authStore.hasPermission('accounting.view'))

const activeScope = ref<CommissionScope>('sales')

const scopes = computed(() => {
  const items: Array<{ key: CommissionScope; label: string }> = [
    { key: 'sales', label: 'Comisiones de venta' }
  ]
  if (canViewAccountingScope.value) {
    items.push({ key: 'accounting', label: 'Comisiones de contabilidad' })
  }
  return items
})

// Si el usuario pierde el acceso contable (cambio de permisos en caliente),
// la pestaña activa vuelve a venta en vez de quedar apuntando a algo oculto.
watch(canViewAccountingScope, (allowed) => {
  if (!allowed && activeScope.value === 'accounting') activeScope.value = 'sales'
})
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-brasper-indigoStrong/10">
      <PageHeader eyebrow="Configuración" title="Comisiones" />

      <div v-if="scopes.length > 1" class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="scope in scopes"
          :key="scope.key"
          type="button"
          :class="[
            'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            activeScope === scope.key
              ? 'border-brasper-indigoStrong bg-brasper-indigoStrong text-white'
              : 'border-[#cfdbef] bg-white text-[#666] hover:bg-[#f3f8ff] hover:text-[#232b4d]'
          ]"
          @click="activeScope = scope.key"
        >
          {{ scope.label }}
        </button>
      </div>

      <CommissionsPanel v-if="activeScope === 'sales'" :store="comisionesStore" />
      <!-- El API de contabilidad no expone historial: se oculta el botón. -->
      <template v-else>
        <AccountingCommissionFixedSettings />
        <CommissionsPanel :store="comisionesContabilidadStore" :show-history="false" />
      </template>
    </section>
  </div>
</template>
