<script setup lang="ts">
import { shallowRef } from 'vue'
import CampaignPreview from './CampaignPreview.vue'
import type { Campaign } from '../../domain/models'
import { statusLabel } from '../../domain/recipients'
defineProps<{ campaigns: Campaign[]; busy: boolean; canSend: boolean; ready: boolean }>()
const emit = defineEmits<{
  send: [id: string]
  test: [id: string, email: string]
  history: [id: string]
}>()
const testEmail = shallowRef('')
const confirming = shallowRef('')
const previewing = shallowRef('')
function confirmSend(id: string) {
  emit('send', id)
  confirming.value = ''
}
</script>
<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold">Campañas e historial</h2>
    <div v-if="!campaigns.length" class="history-empty">
      <span aria-hidden="true">✉</span>
      <h3>Tu primera campaña empieza aquí</h3>
      <p>Guarda un borrador para enviar una prueba y consultar sus resultados.</p>
    </div>
    <label v-if="canSend && campaigns.length" class="block text-sm"
      >Correo para las pruebas<input
        v-model="testEmail"
        type="email"
        class="mt-1 w-full rounded-lg border p-2"
        placeholder="tu-correo@empresa.com"
    /></label>
    <article
      v-for="campaign in campaigns"
      :key="campaign.id"
      class="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
    >
      <div class="flex justify-between gap-3">
        <h3 class="font-semibold">{{ campaign.name }}</h3>
        <span class="text-sm text-emerald-700">{{ statusLabel(campaign.status) }}</span>
      </div>
      <p class="text-sm">{{ campaign.subject }}</p>
      <p class="text-xs text-slate-500">
        {{ new Date(campaign.created_at).toLocaleString('es-PE') }} ·
        {{ campaign.total }} destinatarios
      </p>
      <div class="flex flex-wrap gap-3 text-xs">
        <span v-for="(count, status) in campaign.counts" :key="status"
          >{{ statusLabel(String(status)) }}: {{ count }}</span
        >
      </div>
      <button
        type="button"
        class="text-sm underline"
        @click="previewing = previewing === campaign.id ? '' : campaign.id"
      >
        {{ previewing === campaign.id ? 'Cerrar vista previa' : 'Ver correo completo' }}
      </button>
      <CampaignPreview
        v-if="previewing === campaign.id"
        :template-key="campaign.template_key ?? null"
        :subject="campaign.subject"
        :body="campaign.body"
      />
      <div class="flex flex-wrap gap-3 text-sm">
        <button :disabled="busy" class="underline" @click="emit('history', campaign.id)">
          Ver destinatarios
        </button>
        <button
          v-if="canSend"
          :disabled="busy || !ready || !testEmail"
          class="underline disabled:opacity-40"
          @click="emit('test', campaign.id, testEmail)"
        >
          Enviar prueba
        </button>
        <button
          v-if="canSend && campaign.status === 'draft'"
          :disabled="busy || !ready"
          class="rounded-lg bg-emerald-700 px-3 py-2 text-white disabled:opacity-40"
          @click="confirming = campaign.id"
        >
          Enviar campaña
        </button>
      </div>
      <div v-if="confirming === campaign.id" class="rounded-lg bg-amber-50 p-3 text-sm">
        <p>
          Se enviará este correo a {{ campaign.total }} destinatarios, excluyendo las bajas
          registradas.
        </p>
        <div class="mt-2 flex gap-4">
          <button :disabled="busy" class="font-bold" @click="confirmSend(campaign.id)">
            Confirmar envío masivo</button
          ><button @click="confirming = ''">Cancelar</button>
        </div>
      </div>
    </article>
  </section>
</template>
