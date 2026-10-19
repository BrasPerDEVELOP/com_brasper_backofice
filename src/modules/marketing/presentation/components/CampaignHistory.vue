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
      class="campaign-card rounded-xl border border-slate-200 bg-white p-5 space-y-3"
    >
      <div class="flex justify-between gap-3">
        <h3 class="font-semibold">{{ campaign.name }}</h3>
        <span class="campaign-status" :class="'status-' + campaign.status">{{
          statusLabel(campaign.status)
        }}</span>
      </div>
      <p class="text-sm">{{ campaign.subject }}</p>
      <p class="text-xs text-slate-500">
        {{ new Date(campaign.created_at).toLocaleString('es-PE') }} ·
        {{ campaign.total }} destinatarios
      </p>
      <div class="campaign-results">
        <div>
          <span>Destinatarios</span><strong>{{ campaign.total.toLocaleString('es-PE') }}</strong>
        </div>
        <div>
          <span>Aceptados por SMTP</span><strong>{{ campaign.counts.sent ?? 0 }}</strong>
        </div>
        <div>
          <span>Pendientes / en proceso</span
          ><strong>{{ (campaign.counts.pending ?? 0) + (campaign.counts.processing ?? 0) }}</strong>
        </div>
        <div>
          <span>Fallidos</span
          ><strong :class="{ 'result-error': campaign.counts.failed }">{{
            campaign.counts.failed ?? 0
          }}</strong>
        </div>
        <div>
          <span>Excluidos por baja</span><strong>{{ campaign.counts.suppressed ?? 0 }}</strong>
        </div>
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
      <div class="campaign-actions flex flex-wrap gap-3 text-sm">
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

<style scoped>
.campaign-card {
  border-color: #e4e8f1;
  padding: 22px;
  margin-top: 16px;
}
.campaign-card h3 {
  font-size: 16px;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.campaign-status {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 650;
  padding: 5px 10px;
  border-radius: 20px;
  background: #f1f5f9;
  color: #64748b;
}
.status-draft {
  background: #eeefff;
  color: #5557ad;
}
.status-queued {
  background: #fff5df;
  color: #976509;
}
.status-completed {
  background: #e8f7f0;
  color: #18794f;
}
.campaign-results {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid #edf0f5;
  border-bottom: 1px solid #edf0f5;
}
.campaign-results span {
  display: block;
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
  margin-bottom: 7px;
}
.campaign-results strong {
  font-size: 22px;
  line-height: 1.2;
  font-weight: 700;
  color: #334155;
  font-variant-numeric: tabular-nums;
}
.campaign-results .result-error {
  color: #c24141;
}
.campaign-actions {
  padding-top: 12px;
  align-items: center;
}
@media (max-width: 700px) {
  .campaign-results {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .campaign-card {
    padding: 16px;
  }
}
</style>
