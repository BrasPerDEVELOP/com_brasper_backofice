<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/modules/auth/presentation/controllers/use_auth_store_controller'
import MetricsView from '@/modules/metrics/presentation/bodies/metrics_view.vue'
import LegacyDashboardView from './legacy_dashboard_view.vue'

const authStore = useAuthStore()
const canViewMetrics = computed(() => authStore.hasPermission('metrics.view'))
</script>

<template>
  <MetricsView v-if="canViewMetrics" />
  <LegacyDashboardView v-else />
</template>
