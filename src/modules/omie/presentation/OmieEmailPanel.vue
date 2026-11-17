<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/modules/auth/presentation/controllers/use_auth_store_controller'
import { uniqueEmails, unsentEmails } from '@/interface/utils/contact_emails'
import { omieApi } from '../infrastructure/omie_api'
import type { OmieEmailDetails } from '../domain/models'

const props = defineProps<{ transactionId: string }>()
const auth = useAuthStore()
const details = ref<OmieEmailDetails | null>(null)
const selected = ref<string[]>([])
const extra = ref<string[]>([])
const busy = shallowRef(false)
const loading = shallowRef(false)
const error = shallowRef('')
const needsRefresh = shallowRef(false)
const canSend = computed(() => auth.hasPermission('billing.issue'))
const inProgress = computed(() => ['pending', 'sending'].includes(details.value?.email_status || ''))
const delivered = computed(() => details.value?.email_delivered_to || [])
const recipients = computed(() => unsentEmails(uniqueEmails([...selected.value, ...extra.value]), delivered.value))
const statusLabels = { pending: 'Envío pendiente', sending: 'Enviando PDF…', sent: 'PDF enviado', failed: 'No se completó el envío. Puedes reintentar los destinatarios pendientes.' }
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0

function resetRecipients() {
  selected.value = unsentEmails(details.value?.customer_emails || [], delivered.value)
  extra.value = unsentEmails(details.value?.email_recipients || [], delivered.value)
    .filter((email) => !(details.value?.customer_emails || []).includes(email))
}
function wasDelivered(email: string) {
  return !unsentEmails([email], delivered.value).length
}
function message(cause: unknown, fallback: string) {
  const detail = isAxiosError(cause) ? cause.response?.data?.detail : null
  return typeof detail === 'string' ? detail : fallback
}
function schedulePoll() {
  if (timer) clearTimeout(timer)
  if (inProgress.value) timer = setTimeout(() => { void load(false) }, 5000)
}
async function load(reset = true) {
  const current = generation
  loading.value = true
  try {
    const data = await omieApi.emailDetails(props.transactionId)
    if (current !== generation) return
    details.value = data
    needsRefresh.value = false
    error.value = ''
    if (reset || !inProgress.value) resetRecipients()
    schedulePoll()
  } catch (cause) {
    if (current === generation) {
      error.value = message(cause, 'No se pudo consultar el envío. Actualiza su estado antes de volver a enviar.')
      needsRefresh.value = true
    }
  } finally {
    if (current === generation) loading.value = false
  }
}
async function send() {
  if (busy.value || inProgress.value || needsRefresh.value || !canSend.value || !recipients.value.length) return
  const current = generation
  busy.value = true
  error.value = ''
  try {
    const data = await omieApi.sendEmail(props.transactionId, recipients.value)
    if (current !== generation) return
    details.value = data
    schedulePoll()
  } catch (cause) {
    if (current === generation) {
      error.value = message(cause, 'No se pudo confirmar el envío. Actualiza el estado antes de reintentar.')
      needsRefresh.value = true
    }
  } finally {
    if (current === generation) busy.value = false
  }
}
watch(() => props.transactionId, () => {
  generation++
  if (timer) clearTimeout(timer)
  details.value = null
  selected.value = []
  extra.value = []
  busy.value = false
  needsRefresh.value = false
  void load()
}, { immediate: true })
onUnmounted(() => { generation++; if (timer) clearTimeout(timer) })
</script>

<template>
  <section class="mt-5 rounded-xl border border-indigo-200 p-4 text-sm" aria-label="Enviar PDF de Omie">
    <h3 class="font-semibold text-slate-800">Enviar PDF al cliente</h3>
    <p v-if="loading && !details" class="mt-3 text-slate-500" role="status">Cargando correos…</p>
    <p v-if="details?.email_status" class="mt-3" :class="details.email_status === 'failed' ? 'text-red-700' : 'text-emerald-800'" role="status">{{ statusLabels[details.email_status] }}</p>
    <p v-if="details?.email_error" class="mt-2 text-xs text-red-700" role="alert">{{ details.email_error }}</p>
    <form v-if="details && canSend" class="mt-3 space-y-3" @submit.prevent="send">
      <fieldset class="space-y-3" :disabled="busy || inProgress || loading || needsRefresh">
        <label v-for="email in details.customer_emails" :key="email" class="flex items-center gap-2">
          <input v-model="selected" type="checkbox" :value="email" :disabled="wasDelivered(email)" />
          <span class="break-all">{{ email }}</span>
          <span v-if="wasDelivered(email)" class="text-xs text-emerald-700">Enviado</span>
        </label>
        <p v-if="!details.customer_emails.length" class="text-xs text-slate-500">El cliente no tiene correos registrados. Agrega un destinatario.</p>
        <div v-for="(_, index) in extra" :key="index" class="flex items-center gap-2">
          <input v-model.trim="extra[index]" type="email" required maxlength="255" :aria-label="`Correo adicional ${index + 1}`" placeholder="correo@ejemplo.com" class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2" />
          <button type="button" class="text-xs text-red-700" @click="extra.splice(index, 1)">Quitar</button>
        </div>
        <button type="button" class="text-indigo-700 disabled:opacity-50" :disabled="selected.length + extra.length >= 20" @click="extra.push('')">+ Agregar destinatario</button>
      </fieldset>
      <button type="submit" class="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50" :disabled="busy || loading || inProgress || needsRefresh || !recipients.length || recipients.length > 20">{{ inProgress ? 'Envío en curso…' : busy ? 'Solicitando envío…' : `Enviar PDF (${recipients.length})` }}</button>
      <p class="text-xs text-slate-500">Selecciona los correos registrados o agrega otros. Para corregir un correo, desmárcalo y agrega el nuevo. Cada destinatario recibe su PDF por separado; no se modifica la ficha del cliente.</p>
    </form>
    <p v-if="delivered.length" class="mt-3 break-words text-xs text-emerald-800">Enviado a: {{ delivered.join(', ') }}</p>
    <p v-if="error" class="mt-3 text-red-700" role="alert">{{ error }}</p>
    <button v-if="needsRefresh || inProgress" type="button" class="mt-3 text-indigo-700 disabled:opacity-50" :disabled="loading || busy" @click="load()">Actualizar estado del correo</button>
  </section>
</template>
