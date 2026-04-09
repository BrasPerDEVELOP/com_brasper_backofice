<template>
  <div class="mx-auto max-w-6xl px-3 pb-8 md:px-4">
    <div
      class="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-6 xl:gap-8"
    >
      <div id="calculator-produccion" class="min-w-0 space-y-5 scroll-mt-4">
        <p
          class="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-brasper-indigoStrong"
        >
          Producción
        </p>
        <CalculatorConversionCard variant="production" />
        <TasasView compact />
      </div>

      <div id="calculator-demo" class="min-w-0 space-y-5 scroll-mt-4">
        <p
          class="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-brasper-cyanLight"
        >
          Demo (trial)
        </p>
        <CalculatorConversionCard variant="demo" />
        <TasasDemoCompact />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import CalculatorConversionCard from '../components/CalculatorConversionCard.vue'
import TasasView from '@modules/tasas/presentation/bodies/tasas_view.vue'
import TasasDemoCompact from '@modules/tasas/presentation/components/tasas_demo_compact.vue'

const route = useRoute()

onMounted(() => {
  nextTick(() => {
    if (route.hash === '#calculator-demo') {
      document.getElementById('calculator-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
})
</script>
