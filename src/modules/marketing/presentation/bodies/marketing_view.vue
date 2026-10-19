<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue'
import { useAuthStore } from '@/modules/auth/presentation/controllers/use_auth_store_controller'
import { useMarketingStore } from '../controllers/use_marketing_store_controller'
import CampaignForm from '../components/CampaignForm.vue'
import CampaignHistory from '../components/CampaignHistory.vue'
import { statusLabel } from '../../domain/recipients'
const auth = useAuthStore()
const store = useMarketingStore()
const selected = shallowRef('')
const recipientPage = shallowRef(0)
let timer: ReturnType<typeof setInterval> | undefined
function history(id: string, page = 0) {
  selected.value = id
  recipientPage.value = page
  void store.history(id, page * 100)
}
function changePage(delta: number) {
  store.page += delta
  void store.load()
}
onMounted(() => {
  void store.load()
  timer = setInterval(() => {
    if (!store.busy && store.campaigns.some((c) => c.status === 'queued')) void store.load()
  }, 15000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
<template>
  <div class="marketing-workspace">
    <header class="marketing-header">
      <div>
        <span class="section-kicker">MARKETING</span>
        <h1 class="text-2xl font-bold text-slate-900">Conecta con tus clientes</h1>
        <p class="mt-1 text-sm text-slate-500">
          Crea campañas, prueba el mensaje y consulta los resultados de envío.
        </p>
      </div>
      <p class="sender-badge">
        <span class="sender-dot" :class="{ ready: store.configuration.ready }"></span> Remitente:
        {{ store.configuration.from_email || 'Sin configurar' }}
      </p>
    </header>
    <p v-if="!store.configuration.ready" class="rounded-lg bg-amber-50 p-3 text-amber-900">
      El envío aún no está disponible. Revisa la configuración del remitente.
    </p>
    <p v-if="store.error" role="alert" class="rounded-lg bg-red-50 p-3 text-red-700">
      {{ store.error }}
    </p>
    <p v-if="store.message" role="status" class="rounded-lg bg-emerald-50 p-3 text-emerald-800">
      {{ store.message }}
    </p>
    <div class="marketing-content">
      <CampaignForm
        v-if="auth.hasPermission('marketing.create')"
        :busy="store.busy"
        @save="store.create"
      />
      <div class="history-panel">
        <CampaignHistory
          :campaigns="store.campaigns"
          :busy="store.busy"
          :can-send="auth.hasPermission('marketing.send')"
          :ready="store.configuration.ready"
          @send="store.send"
          @test="store.test"
          @history="history"
        />
        <div class="history-pagination">
          <button :disabled="store.busy || store.page === 0" @click="changePage(-1)">
            Anterior</button
          ><span>{{ store.total }} campañas · Página {{ store.page + 1 }}</span
          ><button
            :disabled="store.busy || (store.page + 1) * 30 >= store.total"
            @click="changePage(1)"
          >
            Siguiente</button
          ><button :disabled="store.busy" @click="store.load()">Actualizar</button>
        </div>
      </div>
    </div>
    <section v-if="selected" class="overflow-auto rounded-xl border bg-white p-5">
      <div class="flex justify-between">
        <h2 class="font-semibold">Destinatarios de la campaña</h2>
        <button @click="selected = ''">Cerrar</button>
      </div>
      <p class="my-2 text-xs text-slate-500">
        Aceptado por SMTP indica que el servidor recibió el correo. No confirma su lectura ni
        llegada a la bandeja de entrada. Los envíos interrumpidos en proceso requieren revisión
        manual.
      </p>
      <table class="w-full text-left text-sm">
        <thead>
          <tr>
            <th class="p-2">Correo</th>
            <th>Estado</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="recipient in store.recipients" :key="recipient.email" class="border-t">
            <td class="p-2">{{ recipient.email }}</td>
            <td>{{ statusLabel(recipient.status) }}</td>
            <td>
              {{
                recipient.error ||
                (recipient.sent_at ? new Date(recipient.sent_at).toLocaleString('es-PE') : '—')
              }}
            </td>
          </tr>
        </tbody>
      </table>
      <div class="mt-3 flex gap-4">
        <button
          :disabled="store.busy || recipientPage === 0"
          @click="history(selected, recipientPage - 1)"
        >
          Anterior</button
        ><button
          :disabled="store.busy || store.recipients.length < 100"
          @click="history(selected, recipientPage + 1)"
        >
          Siguiente
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.marketing-workspace {
  max-width: 1560px;
  margin: 0 auto;
  padding: 32px;
  color: #1e293b;
  font-size: 14px;
  line-height: 1.5;
}
.marketing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-bottom: 28px;
}
.marketing-header h1 {
  font-size: 28px;
  letter-spacing: -0.7px;
  margin: 6px 0;
}
.marketing-header p {
  font-size: 14px;
  color: #64748b;
}
.marketing-workspace :deep(.section-kicker) {
  color: #5356bb;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 1.6px;
}
.sender-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  overflow-wrap: anywhere;
}
.sender-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d97706;
  flex-shrink: 0;
}
.sender-dot.ready {
  background: #10b981;
}
.marketing-content {
  display: grid;
  gap: 24px;
}
.marketing-workspace :deep(.campaign-editor),
.history-panel {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  box-shadow: 0 4px 20px #1e293b04;
  overflow: hidden;
}
.marketing-workspace :deep(.editor-heading) {
  padding: 24px 28px;
  border-bottom: 1px solid #edf0f5;
}
.marketing-workspace :deep(h2) {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.marketing-workspace :deep(.editor-heading p) {
  color: #64748b;
  margin-top: 5px;
  font-size: 13px;
}
.marketing-workspace :deep(.editor-grid) {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(0, 1.2fr);
}
.marketing-workspace :deep(.editor-fields) {
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.marketing-workspace :deep(.editor-fields > label) {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}
.marketing-workspace :deep(.editor-fields > p) {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}
.marketing-workspace :deep(.step-heading) {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
  margin: 4px 0;
}
.marketing-workspace :deep(.step-heading span) {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: #eeefff;
  color: #5356bb;
  font-size: 12px;
}
.marketing-workspace :deep(input:not([type='checkbox']):not([type='radio']):not([type='file'])),
.marketing-workspace :deep(select),
.marketing-workspace :deep(textarea) {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dce2ed;
  border-radius: 10px;
  background: #fff;
  padding: 11px 13px;
  font-size: 14px;
  line-height: 1.5;
  color: #24324b;
  margin-top: 7px;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.marketing-workspace :deep(textarea) {
  resize: vertical;
  min-height: 110px;
}
.marketing-workspace :deep(input:focus),
.marketing-workspace :deep(select:focus),
.marketing-workspace :deep(textarea:focus) {
  border-color: #6366d4;
  box-shadow: 0 0 0 3px #6366d415;
}
.marketing-workspace :deep(button) {
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #dce2ed;
  border-radius: 8px;
  padding: 8px 12px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s;
  line-height: 1.4;
}
.marketing-workspace :deep(button:hover:not(:disabled)) {
  background: #f1f3fb;
  border-color: #b7bde0;
}
.marketing-workspace :deep(button:focus-visible) {
  outline: 3px solid #a5b4fc;
  outline-offset: 2px;
}
.marketing-workspace :deep(button:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
}
.marketing-workspace :deep(button.bg-emerald-700),
.marketing-workspace :deep(.editor-fields > button) {
  background: #4f52be;
  color: white;
  border-color: #4f52be;
  padding: 12px 18px;
}
.marketing-workspace :deep(button.bg-emerald-700:hover:not(:disabled)),
.marketing-workspace :deep(.editor-fields > button:hover:not(:disabled)) {
  background: #3f429f;
}
.marketing-workspace :deep(input[type='checkbox']) {
  accent-color: #5356bb;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.marketing-workspace :deep(input[type='file']) {
  font-size: 12px;
  padding: 14px;
  background: #f8f9fd;
  border: 1px dashed #cbd3e3;
  border-radius: 10px;
}
.marketing-workspace :deep(input[type='file']::file-selector-button) {
  background: #e9ecfa;
  border: 0;
  color: #484da3;
  padding: 7px 10px;
  border-radius: 6px;
  margin-right: 10px;
}
.marketing-workspace :deep(.consent-field) {
  background: #f8f9fd;
  padding: 14px;
  border-radius: 10px;
  font-weight: 400 !important;
}
.marketing-workspace :deep(.editor-preview) {
  min-width: 0;
  background: #f6f8fc;
  border-left: 1px solid #edf0f5;
  padding: 24px;
}
.marketing-workspace :deep(.email-preview) {
  position: sticky;
  top: 20px;
  border: 0;
  background: transparent;
  padding: 0;
}
.marketing-workspace :deep(.preview-canvas) {
  max-height: 740px;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #eaf0f6;
  padding: 16px 0;
}
.marketing-workspace :deep(.email-preview h3) {
  font-size: 14px;
}
.marketing-workspace :deep(button[aria-pressed='true']) {
  background: #e9eafd;
  color: #4649a3;
  border-color: #c4c7ef;
}
.history-panel {
  padding: 24px 28px;
}
.history-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #edf0f5;
  font-size: 12px;
  color: #64748b;
}
.marketing-workspace :deep(.history-empty) {
  text-align: center;
  padding: 40px 20px;
  border: 1px dashed #dce2ed;
  border-radius: 12px;
  background: #fbfcff;
}
.marketing-workspace :deep(.history-empty span) {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #eeefff;
  color: #5356bb;
  font-size: 24px;
  margin-bottom: 12px;
}
.marketing-workspace :deep(.history-empty h3) {
  font-weight: 650;
  font-size: 15px;
  margin-bottom: 5px;
}
.marketing-workspace :deep(.history-empty p) {
  font-size: 13px;
  color: #64748b;
}
@media (max-width: 1100px) {
  .marketing-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .marketing-workspace :deep(.editor-grid) {
    grid-template-columns: 1fr;
  }
  .marketing-workspace :deep(.editor-preview) {
    border-left: 0;
    border-top: 1px solid #edf0f5;
  }
  .marketing-workspace :deep(.email-preview) {
    position: static;
  }
}
@media (max-width: 600px) {
  .marketing-workspace {
    padding: 16px 10px;
  }
  .marketing-header h1 {
    font-size: 24px;
  }
  .marketing-workspace :deep(.editor-fields),
  .marketing-workspace :deep(.editor-heading),
  .marketing-workspace :deep(.editor-preview),
  .history-panel {
    padding: 20px 16px;
  }
  .sender-badge {
    font-size: 11px !important;
  }
  .history-pagination {
    justify-content: flex-start;
  }
}
</style>
