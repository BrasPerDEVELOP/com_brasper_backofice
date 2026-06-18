<script setup lang="ts">
import type { AdminNotification } from '../../domain/models'
defineProps<{ notifications: readonly AdminNotification[]; busyId: string | null }>()
const emit = defineEmits<{ read: [id: string] }>()
</script>
<template>
  <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 class="text-lg font-semibold text-slate-900">Alertas internas</h2><div class="mt-4 space-y-3"><p v-if="!notifications.length" class="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay alertas pendientes.</p><button v-for="item in notifications" :key="item.id" class="block w-full rounded-xl border p-3 text-left transition hover:bg-slate-50 disabled:opacity-60" :class="item.read_at ? 'border-slate-200' : 'border-amber-300 bg-amber-50'" :disabled="Boolean(item.read_at) || busyId === item.id" @click="emit('read', item.id)"><span class="block font-semibold text-slate-900">{{ item.title }}</span><span class="mt-1 block text-sm text-slate-600">{{ item.message }}</span><span class="mt-2 block text-xs text-slate-500">Email: {{ item.email_status }}</span></button></div></section>
</template>
