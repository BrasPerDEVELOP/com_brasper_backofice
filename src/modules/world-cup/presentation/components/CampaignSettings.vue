<script setup lang="ts">
import { reactive, watch } from 'vue'
import { WORLD_CUP_EXCHANGE_RATE_OPTIONS, type WorldCupCampaign } from '../../domain/models'

const props = defineProps<{ campaign: WorldCupCampaign; saving: boolean }>()
const emit = defineEmits<{ save: [payload: Omit<WorldCupCampaign, 'id' | 'name' | 'updated_at'>] }>()
const form = reactive({
  enabled: false, mode: 'REVIEW' as 'REVIEW' | 'AUTOMATIC', default_discount_percentage: 10,
  default_max_uses: 100, exchange_rate_scope: 'PEN_BRL' as WorldCupCampaign['exchange_rate_scope'],
  code_template: 'MUNDIAL-{HOME}-{AWAY}', emails: ''
})
watch(() => props.campaign, (value) => Object.assign(form, { ...value, emails: value.notification_emails.join(', ') }), { immediate: true })
function submit() {
  const { emails, ...payload } = form
  emit('save', { ...payload, notification_emails: emails.split(',').map((item) => item.trim()).filter(Boolean) })
}
</script>

<template>
  <form class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" @submit.prevent="submit">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div><p class="text-xs font-bold uppercase tracking-[.2em] text-brasper-indigoStrong">Plantilla</p><h2 class="text-xl font-semibold text-slate-900">Reglas de campaña</h2></div>
      <label class="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-semibold"><input v-model="form.enabled" type="checkbox" /> Campaña habilitada</label>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label class="text-sm font-medium text-slate-700">Modo<select v-model="form.mode" class="field"><option value="REVIEW">Revisión</option><option value="AUTOMATIC">Automático</option></select></label>
      <label class="text-sm font-medium text-slate-700">Descuento %<input v-model.number="form.default_discount_percentage" class="field" type="number" min="0.01" max="100" step="0.01" /></label>
      <label class="text-sm font-medium text-slate-700">Usos máximos<input v-model.number="form.default_max_uses" class="field" type="number" min="1" /></label>
      <label class="text-sm font-medium text-slate-700 sm:col-span-2">Tipos de cambio afectados<select v-model="form.exchange_rate_scope" class="field"><option v-for="option in WORLD_CUP_EXCHANGE_RATE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
      <label class="text-sm font-medium text-slate-700 sm:col-span-2">Formato del código<input v-model="form.code_template" class="field uppercase" /><span class="mt-1 block text-xs font-normal text-slate-500">Variables: {'{HOME}'}, {'{AWAY}'}, {'{DATE}'}</span></label>
      <label class="text-sm font-medium text-slate-700 sm:col-span-2 xl:col-span-4">Correos de alerta<input v-model="form.emails" class="field" type="text" placeholder="marketing@empresa.com, operaciones@empresa.com" /></label>
    </div>
    <button class="mt-5 min-h-11 rounded-xl bg-brasper-indigoStrong px-5 font-semibold text-white transition hover:brightness-110 disabled:opacity-50" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar reglas' }}</button>
  </form>
</template>

<style scoped>
.field { display:block; width:100%; min-height:2.75rem; margin-top:.25rem; border:1px solid #cbd5e1; border-radius:.75rem; background:#fff; padding:0 .75rem; color:#0f172a; outline:none; transition:border-color .2s, box-shadow .2s; }
.field:focus { border-color:#3655a5; box-shadow:0 0 0 3px rgb(54 85 165 / 20%); }
</style>
