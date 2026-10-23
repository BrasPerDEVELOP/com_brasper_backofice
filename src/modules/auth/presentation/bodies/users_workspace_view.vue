<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../controllers/use_auth_store_controller'
const DirectoryView = defineAsyncComponent(() => import('./usuarios_view.vue'))
const MetricsView = defineAsyncComponent(() => import('./user_metrics_view.vue'))
const route = useRoute()
const auth = useAuthStore()
const canViewMetrics = computed(() => auth.hasPermission('users.view'))
const showMetrics = computed(() => canViewMetrics.value && route.query.view === 'metrics')
</script>
<template>
  <div class="w-full min-w-0">
    <nav v-if="canViewMetrics" class="mb-5 flex flex-wrap gap-2" aria-label="Vistas de usuarios">
      <RouterLink
        :to="{ path: '/app/usuarios', query: { ...route.query, view: undefined } }"
        class="rounded-lg px-4 py-2 text-sm font-medium"
        :class="!showMetrics ? 'bg-brasper-indigoStrong text-white' : 'bg-white text-[#374151]'"
        :aria-current="!showMetrics ? 'page' : undefined"
        >Directorio</RouterLink
      >
      <RouterLink
        :to="{ path: '/app/usuarios', query: { ...route.query, view: 'metrics' } }"
        class="rounded-lg px-4 py-2 text-sm font-medium"
        :class="showMetrics ? 'bg-brasper-indigoStrong text-white' : 'bg-white text-[#374151]'"
        :aria-current="showMetrics ? 'page' : undefined"
        >Métricas</RouterLink
      >
    </nav>
    <MetricsView v-if="showMetrics" />
    <DirectoryView v-else />
  </div>
</template>
