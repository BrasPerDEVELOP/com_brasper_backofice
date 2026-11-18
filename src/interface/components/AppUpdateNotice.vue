<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import { useAppUpdates } from '@/interface/presentation/use_app_updates'

const { canRefresh, refresh } = useAppUpdates()
</script>

<template>
  <span class="sr-only" role="status">
    {{ canRefresh ? 'Hay una nueva versión del panel disponible.' : '' }}
  </span>
  <button
    v-if="canRefresh"
    type="button"
    aria-label="Actualizar panel"
    title="Hay una nueva versión disponible"
    class="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-brasper-indigoStrong/20 bg-brasper-indigoStrong/5 text-sm font-semibold text-brasper-indigoDark hover:bg-brasper-indigoStrong/10 active:bg-brasper-indigoStrong/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasper-indigoStrong sm:w-auto sm:px-3"
    @click="refresh"
  >
    <RefreshCw :size="16" aria-hidden="true" />
    <span class="hidden sm:inline">Actualizar panel</span>
  </button>
</template>
