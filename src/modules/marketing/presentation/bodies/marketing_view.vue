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
  <div class="space-y-6 p-4 md:p-6">
    <header>
      <h1 class="text-2xl font-bold text-slate-900">Marketing · Correos masivos</h1>
      <p class="mt-1 text-sm text-slate-500">
        Crea campañas, prueba el mensaje y consulta los resultados de envío.
      </p>
      <p class="mt-2 text-sm">
        Remitente: {{ store.configuration.from_email || 'Sin configurar' }}
      </p>
    </header>
    <p v-if="!store.configuration.ready" class="rounded-lg bg-amber-50 p-3 text-amber-900">
      El envío requiere SMTP, PUBLIC_URL HTTPS y MARKETING_ENABLED configurados en la API.
    </p>
    <p v-if="store.error" role="alert" class="rounded-lg bg-red-50 p-3 text-red-700">
      {{ store.error }}
    </p>
    <p v-if="store.message" role="status" class="rounded-lg bg-emerald-50 p-3 text-emerald-800">
      {{ store.message }}
    </p>
    <div class="grid items-start gap-6 xl:grid-cols-2">
      <CampaignForm
        v-if="auth.hasPermission('marketing.create')"
        :busy="store.busy"
        @save="store.create"
      />
      <div class="space-y-4">
        <CampaignHistory
          :campaigns="store.campaigns"
          :busy="store.busy"
          :can-send="auth.hasPermission('marketing.send')"
          :ready="store.configuration.ready"
          @send="store.send"
          @test="store.test"
          @history="history"
        />
        <div class="flex items-center gap-4 text-sm">
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
