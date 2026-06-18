<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { WORLD_CUP_EXCHANGE_RATE_OPTIONS, type MatchCouponSettings, type WorldCupCampaign, type WorldCupMatch } from '../../domain/models'

type CampaignDefaults = Pick<WorldCupCampaign, 'default_discount_percentage' | 'default_max_uses' | 'exchange_rate_scope'>

const props = defineProps<{ match: WorldCupMatch; campaignDefaults: CampaignDefaults; busy: boolean }>()
const emit = defineEmits<{
  select: [id: string, selected: boolean, settings?: MatchCouponSettings]
  action: [id: string, action: 'approve' | 'cancel']
}>()
const settings = reactive<MatchCouponSettings>({ discount_percentage: 10, max_uses: 100, exchange_rate_scope: 'PEN_BRL' })
const dateLabel = computed(() => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(props.match.starts_at)))
const badgeClass = computed(() => ({ LIVE: 'bg-emerald-100 text-emerald-800', FINISHED: 'bg-slate-200 text-slate-700', SCHEDULED: 'bg-blue-100 text-blue-800', POSTPONED: 'bg-amber-100 text-amber-800', CANCELLED: 'bg-rose-100 text-rose-800' }[props.match.status]))
const STATUS_LABELS: Record<string, string> = { SCHEDULED: 'Programado', LIVE: 'En vivo', FINISHED: 'Finalizado', POSTPONED: 'Aplazado', CANCELLED: 'Cancelado' }
const COUPON_STATUS_LABELS: Record<string, string> = { DRAFT: 'Borrador', APPROVED_WAITING: 'Aprobado · en espera', ACTIVE: 'Activo', EXPIRED: 'Expirado', CANCELLED: 'Cancelado', SUSPENDED: 'Suspendido' }
const statusLabel = computed(() => STATUS_LABELS[props.match.status] ?? props.match.status)
const couponStatusLabel = computed(() => (props.match.coupon_status ? (COUPON_STATUS_LABELS[props.match.coupon_status] ?? props.match.coupon_status) : ''))
const canConfigure = computed(() => !props.match.coupon_id || ['DRAFT', 'CANCELLED'].includes(props.match.coupon_status || ''))
const canRemove = computed(() => props.match.selected && props.match.coupon_status !== 'ACTIVE')
const exchangeRateLabel = computed(() => WORLD_CUP_EXCHANGE_RATE_OPTIONS.find((option) => option.value === props.match.coupon_exchange_rate_scope)?.label ?? 'Tipo de cambio no definido')

watch(
  () => [props.match, props.campaignDefaults] as const,
  () => Object.assign(settings, {
    discount_percentage: props.match.coupon_discount_percentage ?? props.campaignDefaults.default_discount_percentage,
    max_uses: props.match.coupon_max_uses ?? props.campaignDefaults.default_max_uses,
    exchange_rate_scope: props.match.coupon_exchange_rate_scope ?? props.campaignDefaults.exchange_rate_scope
  }),
  { immediate: true }
)
</script>

<template>
  <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ match.stage || 'Mundial 2026' }}</p><p class="mt-1 text-sm text-slate-600">{{ dateLabel }}</p></div><span class="rounded-full px-2.5 py-1 text-xs font-bold" :class="badgeClass">{{ statusLabel }}</span></div>
    <div class="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><strong class="text-slate-900">{{ match.home_team }}</strong><span class="font-mono text-lg font-bold text-brasper-indigoStrong">{{ match.home_score ?? '–' }} : {{ match.away_score ?? '–' }}</span><strong class="text-slate-900">{{ match.away_team }}</strong></div>
    <div v-if="match.coupon_code" class="mb-4 rounded-xl bg-slate-50 p-3 text-sm">
      <div class="flex justify-between gap-2"><span class="font-mono font-bold text-slate-900">{{ match.coupon_code }}</span><span class="font-semibold text-brasper-indigoStrong">{{ couponStatusLabel }}</span></div>
      <p class="mt-2 font-semibold text-slate-700">{{ match.coupon_discount_percentage }}% de descuento · {{ match.coupon_max_uses }} usos máximos</p>
      <p class="mt-1 text-xs text-slate-600">Aplica a: {{ exchangeRateLabel }}</p>
    </div>
    <form v-if="canConfigure && match.status !== 'FINISHED'" class="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3" @submit.prevent="emit('select', match.id, true, { ...settings })">
      <p class="mb-3 text-sm font-semibold text-slate-800">Cupón para {{ match.home_team }} vs {{ match.away_team }}</p>
      <div class="grid grid-cols-2 gap-2">
        <label class="text-xs font-medium text-slate-600">Descuento %<input v-model.number="settings.discount_percentage" class="coupon-field" type="number" min="0.01" max="100" step="0.01" required /></label>
        <label class="text-xs font-medium text-slate-600">Usos máximos<input v-model.number="settings.max_uses" class="coupon-field" type="number" min="1" required /></label>
        <label class="col-span-2 text-xs font-medium text-slate-600">Tipos de cambio afectados<select v-model="settings.exchange_rate_scope" class="coupon-field"><option v-for="option in WORLD_CUP_EXCHANGE_RATE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
      </div>
      <button class="mt-3 min-h-11 w-full rounded-xl bg-brasper-indigoStrong px-4 text-sm font-semibold text-white disabled:opacity-50" :disabled="busy">{{ busy ? 'Guardando…' : match.selected ? `Guardar cupón de ${settings.discount_percentage}%` : `Crear cupón de ${settings.discount_percentage}%` }}</button>
    </form>
    <div class="flex flex-wrap gap-2">
      <button v-if="match.coupon_id && match.coupon_status === 'DRAFT'" class="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50" :disabled="busy" @click="emit('action', match.coupon_id, 'approve')">Aprobar</button>
      <button v-if="canRemove" class="min-h-11 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 disabled:opacity-50" :disabled="busy" @click="emit('select', match.id, false)">{{ match.coupon_status === 'APPROVED_WAITING' ? 'Eliminar' : 'Rechazar' }}</button>
    </div>
  </article>
</template>

<style scoped>
.coupon-field { display: block; width: 100%; min-height: 2.5rem; margin-top: .25rem; border: 1px solid #cbd5e1; border-radius: .65rem; background: white; padding: 0 .5rem; color: #0f172a; }
</style>
