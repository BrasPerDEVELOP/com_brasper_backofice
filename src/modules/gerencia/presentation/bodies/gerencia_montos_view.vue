<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import MetricKpiCard from '@modules/metrics/presentation/components/MetricKpiCard.vue'
import { monthlyChanges, shares } from '../../domain/calculations'
import {
  CURRENCY_CODES,
  CURRENCY_LABELS,
  MONTH_LABELS_ES,
  type CurrencyCode
} from '../../domain/models'
import GerenciaChart from '../components/GerenciaChart.vue'
import {
  buildCountBars,
  buildCurrencyLines,
  buildCurrencyShareBars,
  buildSignedBars,
  formatMoney,
  monthLabels
} from '../composables/use_gerencia_chart_options'
import { useGerenciaStore } from '../controllers/use_gerencia_store_controller'

const store = useGerenciaStore()

const months = computed(() => store.activeMonths)
const labels = computed(() => monthLabels(months.value))
const empty = computed(() => !store.isLoading && months.value.length === 0)
const linesChart = computed(() => buildCurrencyLines(labels.value, months.value))

/** Meses con total en soles calculable (todas sus tasas registradas). */
const penMonths = computed(() => months.value.filter((m) => m.volumePenTotal != null))
const penLabels = computed(() => monthLabels(penMonths.value))
const penEmpty = computed(() => !store.isLoading && penMonths.value.length === 0)

const penTotalChart = computed(() =>
  buildCountBars(
    penLabels.value,
    penMonths.value.map((m) => Math.round(m.volumePenTotal ?? 0)),
    'Monto total',
    '#06b6d4'
  )
)
const penShareChart = computed(() => {
  const values = { PEN: [], BRL: [], USD: [] } as Record<CurrencyCode, number[]>
  for (const m of penMonths.value) {
    const share = shares({
      PEN: m.volumePenByCurrency.PEN ?? 0,
      BRL: m.volumePenByCurrency.BRL ?? 0,
      USD: m.volumePenByCurrency.USD ?? 0
    })
    for (const code of CURRENCY_CODES) values[code].push(share[code])
  }
  return buildCurrencyShareBars(penLabels.value, values)
})
const penChangeChart = computed(() =>
  buildSignedBars(
    labels.value,
    monthlyChanges(months.value, store.previousMonth, (m) => m.volumePenTotal ?? NaN).map(
      (v) => (v == null || Number.isNaN(v) ? null : v)
    ),
    'Variación'
  )
)

const fxMissingText = computed(() =>
  store.fxMissing
    .map((item) => `${MONTH_LABELS_ES[item.month - 1]} (${CURRENCY_LABELS[item.currency]})`)
    .join(', ')
)

const ACCENTS = { PEN: '#ec4899', BRL: '#06b6d4', USD: '#eab308' } as const

function formatPen(value: number | null): string {
  return value == null ? '—' : formatMoney(value, 'PEN')
}
</script>

<template>
  <div class="gerencia-tab">
    <section class="gerencia-tab__kpis" aria-label="Montos enviados en el año">
      <MetricKpiCard
        v-for="code in CURRENCY_CODES"
        :key="code"
        :label="`Enviado en ${CURRENCY_LABELS[code].toLowerCase()}`"
        :value="formatMoney(store.totals.volumeOrigin[code], code)"
        :hint="`Moneda de origen ${code}`"
        :accent="ACCENTS[code]"
        :help="{
          what: `Monto total originado en ${CURRENCY_LABELS[code].toLowerCase()} durante el año.`,
          calculation: `Suma del monto de origen de las transacciones cuya moneda de origen es ${code}.`,
          interpretation: 'Cada moneda conserva su unidad; no se convierten ni se suman entre sí.'
        }"
      />
      <MetricKpiCard
        label="Total del año en soles"
        :value="formatPen(store.totals.volumePenTotal)"
        hint="Con las tasas mensuales registradas"
        accent="#3346a8"
        :help="{
          what: 'Todo lo enviado en el año expresado en soles.',
          calculation: 'Suma de cada mes: soles + reales × tasa del mes + dólares × tasa del mes.',
          interpretation: 'Aparece vacío si falta la tasa de algún mes con envíos; regístrala en Egresos › Tasas a soles.'
        }"
      />
    </section>

    <div v-if="store.fxMissing.length" class="gerencia-tab__warning" role="status">
      <strong>Faltan tasas a soles:</strong> {{ fxMissingText }}.
      Los gráficos en soles omiten esos meses.
      <RouterLink to="/app/egresos?tab=tasas" class="gerencia-tab__link">Registrar tasas</RouterLink>
    </div>

    <section class="gerencia-tab__charts" aria-label="Gráficos de montos">
      <GerenciaChart
        class="gerencia-tab__wide"
        title="Montos enviados por mes y moneda"
        :subtitle="`Monto de origen ${store.filters.year}`"
        :config="linesChart"
        :loading="store.isLoading"
        :empty="empty"
        :height="360"
        :help="{
          what: 'Evolución mensual del dinero enviado, separado por moneda de origen.',
          calculation: 'Suma del monto de origen por mes y moneda.',
          interpretation: 'Las tres líneas están en unidades distintas (S/, R$, $): compara la tendencia, no la altura entre ellas.'
        }"
      />
      <GerenciaChart
        title="Monto total por mes (expresado en soles)"
        :subtitle="`Soles + reales y dólares convertidos ${store.filters.year}`"
        :config="penTotalChart"
        :loading="store.isLoading"
        :empty="penEmpty"
        :help="{
          what: 'Todo lo enviado cada mes, en soles.',
          calculation: 'Soles + reales × tasa del mes + dólares × tasa del mes (tasas registradas en Egresos › Tasas a soles).',
          interpretation: 'Permite comparar meses sin mezclar monedas. Los meses sin tasa no se muestran.'
        }"
      />
      <GerenciaChart
        title="% de representación por moneda (en soles)"
        subtitle="Participación de cada moneda en el total mensual"
        :config="penShareChart"
        :loading="store.isLoading"
        :empty="penEmpty"
        :help="{
          what: 'Qué parte del monto total de cada mes vino en soles, reales o dólares.',
          calculation: 'Monto en soles de cada moneda entre el total del mes en soles.',
          interpretation: 'A diferencia del % de envíos, aquí pesa el dinero y no la cantidad de operaciones.'
        }"
      />
      <GerenciaChart
        class="gerencia-tab__wide"
        title="% de variación mensual del monto total (en soles)"
        subtitle="Respecto al mes anterior"
        :config="penChangeChart"
        :loading="store.isLoading"
        :empty="penEmpty"
        :help="{
          what: 'Cuánto creció o cayó el monto total enviado frente al mes anterior.',
          calculation: '(total del mes − total del mes anterior) ÷ total del mes anterior, ambos en soles.',
          interpretation: 'Verde crece, rojo cae. Si falta la tasa del mes o del anterior, la barra queda vacía.'
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
.gerencia-tab__warning {
  padding: 12px 14px;
  border: 1px solid #fde68a;
  border-radius: 12px;
  color: #92400e;
  background: #fffbeb;
  font-size: 0.82rem;
  line-height: 1.5;
}
.gerencia-tab__link {
  margin-left: 6px;
  color: #3346a8;
  font-weight: 700;
  text-decoration: underline;
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
