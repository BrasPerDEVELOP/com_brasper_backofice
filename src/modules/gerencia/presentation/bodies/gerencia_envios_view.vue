<script setup lang="ts">
import { computed } from 'vue'
import MetricKpiCard from '@modules/metrics/presentation/components/MetricKpiCard.vue'
import { monthlyCurrencyShares, shares } from '../../domain/calculations'
import { CURRENCY_LABELS } from '../../domain/models'
import GerenciaChart from '../components/GerenciaChart.vue'
import {
  buildCompanyBars,
  buildCountBars,
  buildCurrencyShareBars,
  formatInt,
  monthLabels
} from '../composables/use_gerencia_chart_options'
import { useGerenciaStore } from '../controllers/use_gerencia_store_controller'

const store = useGerenciaStore()

const months = computed(() => store.activeMonths)
const labels = computed(() => monthLabels(months.value))
const empty = computed(() => !store.isLoading && months.value.length === 0)

const countChart = computed(() =>
  buildCountBars(
    labels.value,
    months.value.map((m) => m.enviosCount),
    'Envíos',
    '#e11d74'
  )
)
const shareChart = computed(() =>
  buildCurrencyShareBars(
    labels.value,
    monthlyCurrencyShares(months.value, (m) => m.enviosByCurrency)
  )
)
const companies = computed(() => store.dashboard?.companies ?? [])
const companyChart = computed(() => buildCompanyBars(labels.value, companies.value, months.value))

const yearShare = computed(() => {
  const totals = months.value.reduce(
    (acc, m) => {
      acc.PEN += m.enviosByCurrency.PEN
      acc.BRL += m.enviosByCurrency.BRL
      acc.USD += m.enviosByCurrency.USD
      return acc
    },
    { PEN: 0, BRL: 0, USD: 0 }
  )
  return shares(totals)
})
const leadingCurrency = computed(() => {
  const entries = Object.entries(yearShare.value) as Array<[keyof typeof CURRENCY_LABELS, number]>
  const [code, pct] = entries.sort((a, b) => b[1] - a[1])[0] ?? ['PEN', 0]
  return `${CURRENCY_LABELS[code]} ${pct}%`
})
const monthlyAverage = computed(() =>
  months.value.length ? store.totals.enviosCount / months.value.length : 0
)
</script>

<template>
  <div class="gerencia-tab">
    <section class="gerencia-tab__kpis" aria-label="Indicadores de envíos">
      <MetricKpiCard
        label="Envíos del año"
        :value="formatInt(store.totals.enviosCount)"
        :hint="`${months.length} meses con datos`"
        accent="#e11d74"
        :help="{
          what: 'Total de transacciones del año seleccionado.',
          calculation: 'Conteo de transacciones no eliminadas por mes, sumado de enero al último mes con envíos.',
          interpretation: 'Es el mismo universo que usan los tres gráficos de esta pestaña.'
        }"
      />
      <MetricKpiCard
        label="Promedio mensual"
        :value="formatInt(monthlyAverage)"
        hint="Envíos por mes con datos"
        accent="#3346a8"
        :help="{
          what: 'Envíos promedio por mes.',
          calculation: 'Envíos del año entre la cantidad de meses con al menos un envío.',
          interpretation: 'Sirve para comparar un mes concreto contra el ritmo del año.'
        }"
      />
      <MetricKpiCard
        label="Moneda principal"
        :value="leadingCurrency"
        hint="Participación en envíos del año"
        accent="#06b6d4"
        :help="{
          what: 'Moneda de origen con más envíos en el año.',
          calculation: 'Participación de cada moneda de origen sobre el total de envíos del año.',
          interpretation: 'El gráfico de la derecha muestra esta participación mes a mes.'
        }"
      />
    </section>

    <section class="gerencia-tab__charts" aria-label="Gráficos de envíos">
      <GerenciaChart
        title="Número de envíos por mes"
        :subtitle="`Transacciones ${store.filters.year}`"
        :config="countChart"
        :loading="store.isLoading"
        :empty="empty"
        :help="{
          what: 'Cuántas transacciones se registraron cada mes.',
          calculation: 'Conteo de transacciones por mes según su fecha de creación (hora de Lima).',
          interpretation: 'Compara meses entre sí; los meses futuros sin envíos no se muestran.'
        }"
      />
      <GerenciaChart
        title="% de envíos por moneda"
        :subtitle="`Participación mensual ${store.filters.year}`"
        :config="shareChart"
        :loading="store.isLoading"
        :empty="empty"
        :help="{
          what: 'Qué parte de los envíos de cada mes se originó en soles, reales o dólares.',
          calculation: 'Envíos por moneda de origen entre el total de envíos del mes.',
          interpretation: 'Las tres barras de cada mes siempre suman 100 %.'
        }"
      />
      <GerenciaChart
        class="gerencia-tab__wide"
        title="N° envíos / mes / razón social"
        :subtitle="`Por empresa receptora ${store.filters.year}`"
        :config="companyChart"
        :loading="store.isLoading"
        :empty="empty || companies.length === 0"
        :height="360"
        :help="{
          what: 'Envíos de cada mes separados por la razón social que recibió el dinero.',
          calculation: 'Agrupa por la empresa de la cuenta Brasper destino; si la transacción no la tiene, usa el texto de razón social registrado.',
          interpretation: 'Si una misma empresa aparece con varios nombres, unifica el campo Empresa en Cuentas Brasper.'
        }"
      />
    </section>
  </div>
</template>

<style scoped>
.gerencia-tab {
  display: grid;
  gap: 16px;
}
.gerencia-tab__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}
.gerencia-tab__charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.gerencia-tab__wide {
  grid-column: 1 / -1;
}
@media (max-width: 900px) {
  .gerencia-tab__charts {
    grid-template-columns: 1fr;
  }
  .gerencia-tab__wide {
    grid-column: auto;
  }
}
</style>
