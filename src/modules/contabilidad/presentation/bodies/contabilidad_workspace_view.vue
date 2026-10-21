<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'

const AccountingView = defineAsyncComponent(() => import('./contabilidad_view.vue'))
const BillingView = defineAsyncComponent(() => import('@modules/facturacion/presentation/bodies/facturacion_view.vue'))
const authStore = useAuthStore()
const route = useRoute()
const canViewAccounting = computed(() => authStore.hasPermission('accounting.view'))
const canViewBilling = computed(() => authStore.hasPermission('billing.view'))
const activeTab = computed(() => {
  if (canViewBilling.value && (route.query.tab === 'facturacion' || !canViewAccounting.value)) return 'facturacion'
  return 'movimientos'
})
</script>

<template>
  <div class="flex w-full min-w-0 flex-col gap-4">
    <header>
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">Operaciones</p>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h1 class="text-2xl font-semibold text-[#232b4d]">Contabilidad</h1>
        <nav class="flex flex-wrap gap-2" aria-label="Secciones de Contabilidad">
          <RouterLink
            v-if="canViewAccounting"
            :to="{ path: '/app/contabilidad', query: { ...route.query, tab: undefined } }"
            class="rounded-lg px-4 py-2 text-sm font-medium transition"
            :class="activeTab === 'movimientos' ? 'bg-brasper-indigoStrong text-white' : 'bg-white text-[#374151] hover:bg-[#eef5ff]'"
            :aria-current="activeTab === 'movimientos' ? 'page' : undefined"
          >
            Movimientos
          </RouterLink>
          <RouterLink
            v-if="canViewBilling"
            :to="{ path: '/app/contabilidad', query: { ...route.query, tab: 'facturacion' } }"
            class="rounded-lg px-4 py-2 text-sm font-medium transition"
            :class="activeTab === 'facturacion' ? 'bg-brasper-indigoStrong text-white' : 'bg-white text-[#374151] hover:bg-[#eef5ff]'"
            :aria-current="activeTab === 'facturacion' ? 'page' : undefined"
          >
            Facturación
          </RouterLink>
        </nav>
      </div>
    </header>
    <BillingView v-if="activeTab === 'facturacion' && canViewBilling" />
    <AccountingView v-else-if="canViewAccounting" />
  </div>
</template>
