<script setup lang="ts">
import { computed, ref } from 'vue'
import { isAxiosError } from 'axios'
import { omieApi } from '../infrastructure/omie_api'
import type { OmieCustomerRegistration, OmiePreview } from '../domain/models'

const props = defineProps<{ transactionId: string; canIssue: boolean }>()
const opened = ref(false)
const busy = ref(false)
const error = ref('')
const preview = ref<OmiePreview | null>(null)
const pdfUrl = ref('')
const registrationAttempted = ref(false)
const registration = ref<OmieCustomerRegistration>({
  legal_name: '', email: '', street: '', number: '', district: '', city: '',
  state: '', postal_code: '', phone_area_code: '', phone_number: ''
})
const labels: Record<string, string> = {
  creating: 'Creando orden', validating: 'Validando orden', billing: 'Facturando',
  pending: 'En proceso', issued: 'Emitida', cancelled: 'Anulada', review_required: 'Revisar en Omie'
}
const statusLabel = computed(() => labels[preview.value?.record?.status || ''] || '')
const totalLabel = computed(() => new Intl.NumberFormat('es-PE', {
  style: 'currency', currency: 'BRL'
}).format(Number(preview.value?.total || 0)))

async function run(action: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try { await action() } catch (cause) {
    const detail = isAxiosError(cause) ? cause.response?.data?.detail : null
    error.value = typeof detail === 'string' ? detail : 'No se pudo confirmar la respuesta. Consulta el estado antes de volver a emitir.'
  } finally { busy.value = false }
}
async function open() {
  opened.value = true
  pdfUrl.value = ''
  preview.value = null
  registrationAttempted.value = false
  await consultPreview()
}
async function consultPreview() {
  await run(async () => {
    preview.value = await omieApi.preview(props.transactionId)
    if (preview.value.customer_registration_required) {
      registration.value.legal_name = preview.value.customer
      registration.value.email = preview.value.email || ''
    }
  })
}
async function registerCustomer() {
  if (!preview.value?.customer_registration_required || !props.canIssue || registrationAttempted.value) return
  registrationAttempted.value = true
  await run(async () => {
    await omieApi.registerCustomer(props.transactionId, registration.value)
    preview.value = await omieApi.preview(props.transactionId)
    registrationAttempted.value = Boolean(preview.value.customer_registration_required)
    if (registrationAttempted.value) {
      error.value = 'Omie recibió el registro, pero aún no confirma la ficha. Consulta el cliente antes de continuar.'
    }
  })
}
async function issue() {
  if (!preview.value?.can_issue || !props.canIssue) return
  // Lock the action even after an ambiguous HTTP failure; reopening consults the backend.
  const current = preview.value
  current.can_issue = false
  await run(async () => {
    current.record = await omieApi.issue(props.transactionId, current.total, current.document)
  })
}
async function refresh() {
  await run(async () => {
    if (preview.value) preview.value.record = await omieApi.refresh(props.transactionId)
  })
}
async function preparePdf() {
  await run(async () => { pdfUrl.value = await omieApi.pdf(props.transactionId) })
}
</script>

<template>
  <button type="button" class="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700" @click.stop="open">
    {{ preview?.record?.nfse_number ? `NFS-e ${preview.record.nfse_number}` : 'NFS-e Omie' }}
  </button>
  <Teleport to="body">
    <div v-if="opened" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" @keydown.esc="!busy && (opened = false)">
      <section role="dialog" aria-modal="true" aria-label="Emisión NFS-e Omie" class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-left shadow-xl">
        <h2 class="text-lg font-semibold text-slate-900">Nota fiscal de servicio · Omie</h2>
        <p class="mt-1 text-sm text-slate-500">Emisión en Brasil · Producción</p>
        <p v-if="busy" class="mt-4 text-sm" role="status">Consultando Omie…</p>
        <p v-if="error" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ error }}</p>
        <dl v-if="preview" class="mt-5 space-y-3 text-sm text-slate-700">
          <div><dt class="text-slate-500">Empresa emisora</dt><dd>{{ preview.issuer }}</dd></div>
          <div><dt class="text-slate-500">Cliente · CPF/CNPJ {{ preview.document }}</dt><dd>{{ preview.customer }}</dd></div>
          <div><dt class="text-slate-500">Servicio</dt><dd>{{ preview.service }}</dd></div>
          <div><dt class="text-slate-500">Cuenta de facturación</dt><dd>{{ preview.account }}</dd></div>
          <div class="rounded-lg bg-emerald-50 p-3"><dt>Venta final · Total a facturar</dt><dd class="text-xl font-bold text-emerald-800">{{ totalLabel }}</dd></div>
          <div v-if="preview.record"><dt>Estado</dt><dd>{{ statusLabel }}<span v-if="preview.record.nfse_number"> · NFS-e {{ preview.record.nfse_number }}</span></dd></div>
        </dl>
        <form v-if="preview?.customer_registration_required && canIssue" class="mt-5 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-sm" @submit.prevent="registerCustomer">
          <p class="font-semibold text-slate-900">Registrar cliente en Omie</p>
          <p class="text-slate-600">Este CPF/CNPJ aún no figura en Omie. Revisa el nombre y completa los datos reales del cliente. El registro no emite la nota fiscal.</p>
          <label class="block text-slate-700">Nombre o razón social
            <input v-model.trim="registration.legal_name" required maxlength="60" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
          </label>
          <label class="block text-slate-700">Correo
            <input v-model.trim="registration.email" type="email" required class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
          </label>
          <div class="grid grid-cols-3 gap-2">
            <label class="col-span-2 block text-slate-700">Calle
              <input v-model.trim="registration.street" required maxlength="60" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label class="block text-slate-700">Número
              <input v-model.trim="registration.number" required maxlength="60" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
          </div>
          <label class="block text-slate-700">Barrio
            <input v-model.trim="registration.district" required maxlength="60" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
          </label>
          <div class="grid grid-cols-3 gap-2">
            <label class="col-span-2 block text-slate-700">Ciudad
              <input v-model.trim="registration.city" required maxlength="40" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label class="block text-slate-700">Estado (UF)
              <input v-model.trim="registration.state" required minlength="2" maxlength="2" pattern="[A-Za-z]{2}" placeholder="SP" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 uppercase" />
            </label>
          </div>
          <label class="block text-slate-700">CEP (opcional)
            <input v-model.trim="registration.postal_code" inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
          </label>
          <div class="grid grid-cols-3 gap-2">
            <label class="block text-slate-700">DDD (opcional)
              <input v-model.trim="registration.phone_area_code" inputmode="numeric" pattern="[0-9]{2,5}" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label class="col-span-2 block text-slate-700">Teléfono (opcional)
              <input v-model.trim="registration.phone_number" type="tel" maxlength="15" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
          </div>
          <button type="submit" class="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50" :disabled="busy || registrationAttempted">Registrar y volver a consultar</button>
          <p v-if="registrationAttempted" class="text-amber-800">Consulta de nuevo el estado antes de intentar otro registro.</p>
        </form>
        <p v-if="preview?.record?.error" class="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{{ preview.record.error }}</p>
        <p v-if="preview?.record && !['issued', 'cancelled', 'pending'].includes(preview.record.status)" class="mt-3 text-sm text-slate-600">Revisa la orden existente en Omie y consulta su estado aquí. No crees otra orden para esta operación.</p>
        <p v-if="preview?.can_issue" class="mt-4 text-sm text-slate-500">Se emitirá una NFS-e real con la configuración tributaria del servicio en Omie.</p>
        <div class="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" class="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" :disabled="busy" @click="opened = false">Cerrar</button>
          <button v-if="error && !preview?.record" type="button" class="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" :disabled="busy" @click="open">Volver a consultar</button>
          <button v-if="preview?.customer_registration_required && registrationAttempted" type="button" class="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" :disabled="busy" @click="consultPreview">Consultar cliente</button>
          <button v-if="preview?.record" type="button" class="rounded-lg border border-indigo-200 px-4 py-2 text-sm text-indigo-700 disabled:opacity-50" :disabled="busy" @click="refresh">Consultar estado</button>
          <button v-if="preview?.record && ['issued', 'cancelled'].includes(preview.record.status) && !pdfUrl" type="button" class="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" :disabled="busy" @click="preparePdf">Preparar PDF</button>
          <a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener noreferrer" class="rounded-lg bg-indigo-700 px-4 py-2 text-sm text-white">Abrir PDF</a>
          <button v-if="preview?.can_issue && canIssue" type="button" class="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="busy" @click="issue">Emitir NFS-e</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
