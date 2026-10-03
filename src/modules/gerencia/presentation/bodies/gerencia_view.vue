<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { RefreshCw } from '@lucide/vue'
import PageHeader from '@/interface/widgets/PageHeader.vue'
import {
  CURRENCY_CODES,
  currentYear,
  type CurrencyCode,
  type ManagementFilters
} from '../../domain/models'
import GerenciaFilterBar from '../components/GerenciaFilterBar.vue'
import GerenciaTabs from '../components/GerenciaTabs.vue'
import { useGerenciaStore } from '../controllers/use_gerencia_store_controller'

const store = useGerenciaStore()
const route = useRoute()
const router = useRouter()

function queryValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/** Los filtros viven en la URL para poder compartir una vista exacta. */
function filtersFromQuery(): ManagementFilters {
  const year = Number(queryValue(route.query.year))
  const currencyRaw = queryValue(route.query.currency)
  const monthRaw = Number(queryValue(route.query.month))
  return {
    year: Number.isInteger(year) && year >= 2000 ? year : currentYear(),
    corridor: 'all',
    currency: (CURRENCY_CODES as readonly string[]).includes(currencyRaw ?? '')
      ? (currencyRaw as CurrencyCode)
      : null,
    company: queryValue(route.query.company),
    status: null,
    topMonth: Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : null
  }
}

async function syncQuery(filters: ManagementFilters) {
  await router.replace({
    query: {
      year: filters.year === currentYear() ? undefined : String(filters.year),
      currency: filters.currency ?? undefined,
      company: filters.company ?? undefined,
      month: filters.topMonth ? String(filters.topMonth) : undefined
    }
  })
}

async function applyFilters(patch: Partial<ManagementFilters>) {
  const next = { ...store.filters, ...patch }
  await syncQuery(next)
  await store.applyFilters(patch)
}

async function resetFilters() {
  await router.replace({ query: {} })
  await store.resetFilters()
}

onMounted(async () => {
  store.filters = filtersFromQuery()
  await store.load()
})
</script>

<template>
  <main class="gerencia-view">
    <PageHeader
      eyebrow="Gerencia"
      title="Dashboard gerencial"
      subtitle="Envíos, clientes y montos por mes, con los mismos cortes que el reporte de gerencia."
    >
      <template #actions>
        <span class="gerencia-view__scope">{{ store.filters.year }}</span>
        <button
          class="gerencia-view__refresh"
          type="button"
          :disabled="store.isLoading"
          @click="store.load()"
        >
          <RefreshCw :size="16" :class="{ spinning: store.isLoading }" aria-hidden="true" />
          Actualizar
        </button>
      </template>
    </PageHeader>

    <GerenciaFilterBar
      :model-value="store.filters"
      :companies="store.availableCompanies"
      :loading="store.isLoading"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <GerenciaTabs />

    <div v-if="store.error" class="gerencia-view__error" role="alert">
      <span>{{ store.error }}</span>
      <button type="button" @click="store.load()">Reintentar</button>
    </div>

    <RouterView v-else @apply-filters="applyFilters" />
  </main>
</template>

<style scoped>
.gerencia-view {
  display: grid;
  gap: 16px;
  padding-bottom: 36px;
}
.gerencia-view__scope {
  padding: 7px 10px;
  border: 1px solid #ccd6e5;
  border-radius: 999px;
  color: #3346a8;
  background: #f4f6ff;
  font-size: 0.76rem;
  font-weight: 700;
}
.gerencia-view__refresh {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid #3346a8;
  border-radius: 9px;
  color: #fff;
  background: #3346a8;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
.gerencia-view__refresh:disabled {
  opacity: 0.6;
  cursor: wait;
}
.gerencia-view__refresh .spinning {
  animation: spin 0.8s linear infinite;
}
.gerencia-view__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  color: #9f1239;
  background: #fff1f2;
  font-size: 0.82rem;
}
.gerencia-view__error button {
  border: 0;
  color: #9f1239;
  background: transparent;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
