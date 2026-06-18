<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import CampaignSettings from '../components/CampaignSettings.vue'
import MatchCard from '../components/MatchCard.vue'
import NotificationInbox from '../components/NotificationInbox.vue'
import { useWorldCupCampaign } from '../composables/useWorldCupCampaign'
const data = useWorldCupCampaign()
const query = shallowRef('')
const status = shallowRef('ALL')
const visibleMatches = computed(() => data.matches.value.filter((match) => (status.value === 'ALL' || match.status === status.value) && `${match.home_team} ${match.away_team} ${match.stage}`.toLowerCase().includes(query.value.toLowerCase())))
onMounted(data.load)
</script>

<template>
  <main class="mx-auto max-w-7xl space-y-6 px-3 py-5 sm:px-6">
    <header class="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-brasper-indigoDark to-brasper-indigoStrong p-6 text-white lg:flex-row lg:items-end lg:justify-between"><div><p class="text-xs font-bold uppercase tracking-[.24em] text-cyan-200">Campaña temporal</p><h1 class="mt-2 text-3xl font-bold">Mundial 2026</h1><p class="mt-2 max-w-2xl text-sm text-white/80">Selecciona partidos, revisa borradores y controla cupones que solo se activan mientras el balón está en juego.</p></div><button class="min-h-11 rounded-xl bg-white px-5 font-semibold text-brasper-indigoDark disabled:cursor-wait disabled:opacity-60" :disabled="data.busyId.value === 'sync'" @click="data.sync">{{ data.busyId.value === 'sync' ? 'Sincronizando…' : 'Sincronizar partidos y cupones' }}</button></header>
    <p v-if="data.error.value" role="alert" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{{ data.error.value }}</p><p v-if="data.success.value" aria-live="polite" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{{ data.success.value }}</p>
    <div v-if="data.loading.value" class="grid gap-4 md:grid-cols-2"><div v-for="item in 4" :key="item" class="h-52 animate-pulse rounded-2xl bg-slate-200" /></div>
    <template v-else-if="data.campaign.value"><CampaignSettings :campaign="data.campaign.value" :saving="data.busyId.value === 'Configuración guardada'" @save="data.saveCampaign" /><div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><section><div class="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row"><label class="sr-only" for="match-search">Buscar partido</label><input id="match-search" v-model="query" class="min-h-11 flex-1 rounded-xl border border-slate-300 px-3" placeholder="Buscar selección o fase" /><select v-model="status" aria-label="Filtrar por estado" class="min-h-11 rounded-xl border border-slate-300 px-3"><option value="ALL">Todos</option><option value="SCHEDULED">Programados</option><option value="LIVE">En vivo</option><option value="FINISHED">Finalizados</option></select></div><div class="grid gap-4 md:grid-cols-2"><MatchCard v-for="match in visibleMatches" :key="match.id" :match="match" :campaign-defaults="data.campaign.value" :busy="data.busyId.value === match.id" @select="data.select" @action="data.couponAction" /></div><p v-if="!visibleMatches.length" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No hay partidos para este filtro. Sincroniza el calendario o cambia la búsqueda.</p></section><NotificationInbox :notifications="data.notifications.value" :busy-id="data.busyId.value" @read="data.readNotification" /></div></template>
  </main>
</template>
