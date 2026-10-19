<script setup lang="ts">
import { computed, reactive, shallowRef, onMounted, watch } from 'vue'
import CampaignPreview from './CampaignPreview.vue'
import type {
  DispatchInput,
  DirectTestInput,
  TemplateKey,
  EmailTemplate
} from '../../domain/models'
import { parseRecipients } from '../../domain/recipients'
import { marketingActions } from '../../application/use_cases/marketing'
import { MarketingApiAdapter } from '../../infrastructure/marketing_api_adapter'
defineProps<{ busy: boolean; canSend: boolean; ready: boolean; sentRequestId: string }>()
const emit = defineEmits<{ send: [input: DispatchInput]; test: [input: DirectTestInput] }>()
const requestId = shallowRef(crypto.randomUUID())
const confirmation = shallowRef<DispatchInput | null>(null)
const testEmail = shallowRef('')
const form = reactive({
  name: '',
  subject: '',
  body: '',
  emails: '',
  consent: false,
  template_key: 'brasper_peru_pt_v1' as TemplateKey | null
})
const templates = shallowRef<EmailTemplate[]>([])
const templatesLoaded = shallowRef(false)
const emails = computed(() => parseRecipients(form.emails))
const clients = shallowRef<string[]>([])
const search = shallowRef('')
const clientPage = shallowRef(0)
const error = shallowRef('')
const loading = shallowRef(false)
const actions = marketingActions(new MarketingApiAdapter())
onMounted(async () => {
  try {
    templates.value = await actions.templates()
    const initial = templates.value.find((item) => item.key === form.template_key)
    if (initial) {
      if (!form.subject) form.subject = initial.default_subject
      if (!form.body) form.body = initial.default_body
    }
  } catch {
    error.value = 'No se pudo cargar la plantilla. Actualiza la página para volver a intentarlo.'
  } finally {
    templatesLoaded.value = true
  }
})
watch(
  () => form.template_key,
  (key, previous) => {
    const next = templates.value.find((item) => item.key === key)
    const old = templates.value.find((item) => item.key === previous)
    if (!next) return
    if (!form.subject || form.subject === old?.default_subject) form.subject = next.default_subject
    if (!form.body || form.body === old?.default_body) form.body = next.default_body
  }
)
async function searchClients(page = 0) {
  loading.value = true
  error.value = ''
  try {
    clients.value = await actions.clients(search.value, page * 100)
    clientPage.value = page
  } catch {
    error.value = 'No se pudieron cargar los clientes.'
  } finally {
    loading.value = false
  }
}
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'El archivo debe pesar menos de 5 MB.'
    return
  }
  try {
    const { read, utils } = await import('xlsx')
    const workbook = read(await file.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
    if (!sheet) throw new Error()
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
    const found = rows
      .flat()
      .map(String)
      .filter((cell) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell.trim()))
    if (!found.length) {
      error.value = 'No se encontraron correos en la primera hoja.'
      return
    }
    form.emails += '\n' + found.join('\n')
  } catch {
    error.value = 'No se pudo leer el archivo.'
  }
}
watch(
  () => [form.name, form.subject, form.body, form.emails, form.template_key, form.consent],
  () => {
    confirmation.value = null
    requestId.value = crypto.randomUUID()
  }
)
function prepareSend() {
  error.value = ''
  if (!emails.value.length || emails.value.length > 10000) {
    error.value = 'Agrega entre 1 y 10 000 destinatarios.'
    return
  }
  if (emails.value.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    error.value = 'Revisa los correos: hay direcciones inválidas.'
    return
  }
  confirmation.value = {
    request_id: requestId.value,
    name: form.name,
    subject: form.subject,
    body: form.body,
    emails: emails.value,
    template_key: form.template_key,
    consent_confirmed: form.consent
  }
}
function confirmSend() {
  if (!confirmation.value) return
  emit('send', confirmation.value)
  confirmation.value = null
}
function sendTest() {
  error.value = ''
  if (
    !form.subject.trim() ||
    !form.body.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.value.trim())
  ) {
    error.value = 'Completa el asunto, el mensaje y un correo de prueba válido.'
    return
  }
  emit('test', {
    email: testEmail.value.trim(),
    subject: form.subject,
    body: form.body,
    template_key: form.template_key
  })
}
</script>

<template>
  <form class="campaign-editor" @submit.prevent="prepareSend">
    <div class="editor-heading">
      <span class="section-kicker">CREAR CAMPAÑA</span>
      <h2>Nueva campaña</h2>
      <p>Prepara tu mensaje y revisa cómo lo recibirán tus clientes.</p>
    </div>
    <div class="editor-grid">
      <div class="editor-fields">
        <h3 class="step-heading"><span>1</span> Contenido del correo</h3>
        <fieldset class="template-picker">
          <legend>¿A quién va dirigido?</legend>
          <div class="template-options">
            <label
              v-for="item in templates"
              :key="item.key"
              class="template-option"
              :class="{ selected: form.template_key === item.key }"
            >
              <input
                v-model="form.template_key"
                type="radio"
                name="campaign-template"
                :value="item.key"
              />
              <span class="template-country" aria-hidden="true">{{
                item.language === 'pt-BR' ? 'BR' : 'PE'
              }}</span>
              <span
                ><strong>{{
                  item.language === 'pt-BR' ? 'Público en Brasil' : 'Público en Perú'
                }}</strong
                ><small>{{
                  item.language === 'pt-BR'
                    ? 'Portugués · Envíos a Perú'
                    : 'Español · Envíos a Brasil'
                }}</small></span
              >
            </label>
          </div>
          <label class="simple-option"
            ><input
              v-model="form.template_key"
              type="radio"
              name="campaign-template"
              :value="null"
            />
            Usar mensaje sencillo, sin banners</label
          >
        </fieldset>
        <p v-if="form.template_key" class="text-sm text-slate-500">
          Incluye los banners, el logo, los beneficios y el enlace de baja. El mensaje se mostrará
          debajo del banner principal.
        </p>
        <label class="block"
          >Nombre interno<input
            v-model="form.name"
            required
            maxlength="150"
            class="mt-1 w-full rounded-lg border p-2"
            placeholder="Ej. Campaña de bienvenida — Perú"
        /></label>
        <label class="block"
          >Asunto <span class="field-counter">{{ form.subject.length }}/200</span
          ><input
            v-model="form.subject"
            required
            maxlength="200"
            class="mt-1 w-full rounded-lg border p-2"
        /></label>
        <label class="block"
          >Mensaje de la campaña<textarea
            v-model="form.body"
            required
            maxlength="100000"
            rows="7"
            class="mt-1 w-full rounded-lg border p-2"
            placeholder="Escribe el contenido del correo…"
          />
        </label>
        <div class="audience-heading">
          <h3 class="step-heading"><span>2</span> Tu audiencia</h3>
          <span class="audience-count"
            >{{ emails.length.toLocaleString('es-PE') }} destinatarios</span
          >
        </div>
        <label class="block"
          >Destinatarios ({{ emails.length }} únicos)<textarea
            v-model="form.emails"
            rows="4"
            class="mt-1 w-full rounded-lg border p-2"
            placeholder="Un correo por línea, o separados por coma"
          />
        </label>
        <label class="block text-sm"
          >Importar correos desde Excel o CSV<input
            type="file"
            accept=".xlsx,.xls,.csv"
            class="mt-2 block w-full"
            @change="importFile"
        /></label>
        <details class="rounded-lg border p-3">
          <summary class="cursor-pointer">Seleccionar clientes de Brasper</summary>
          <div class="my-3 flex gap-2">
            <input
              v-model="search"
              class="min-w-0 flex-1 rounded border p-2"
              placeholder="Buscar correo"
            /><button type="button" :disabled="loading" @click="searchClients(0)">Buscar</button>
          </div>
          <div class="max-h-48 overflow-auto">
            <label v-for="email in clients" :key="email" class="block py-1"
              ><input
                type="checkbox"
                :checked="emails.includes(email.toLowerCase())"
                @change="
                  form.emails = ($event.target as HTMLInputElement).checked
                    ? [...emails, email].join('\n')
                    : emails.filter((item) => item !== email.toLowerCase()).join('\n')
                "
              />
              {{ email }}</label
            >
          </div>
          <div class="mt-2 flex gap-4">
            <button
              type="button"
              :disabled="loading || clientPage === 0"
              @click="searchClients(clientPage - 1)"
            >
              Anterior</button
            ><button
              type="button"
              :disabled="loading || clients.length < 100"
              @click="searchClients(clientPage + 1)"
            >
              Siguiente
            </button>
          </div>
        </details>
        <label class="consent-field flex items-start gap-2 text-sm"
          ><input v-model="form.consent" type="checkbox" required class="mt-1" />Confirmo que estos
          destinatarios autorizaron recibir comunicaciones de marketing.</label
        >
        <p v-if="error" role="alert" class="text-red-700">{{ error }}</p>
        <button
          type="submit"
          :disabled="busy || !ready || !canSend || sentRequestId === requestId"
          class="rounded-lg bg-emerald-700 px-5 py-2 text-white disabled:opacity-50"
        >
          {{
            sentRequestId === requestId
              ? 'Campaña en cola'
              : busy
                ? 'Procesando…'
                : 'Enviar campaña'
          }}
        </button>
        <div v-if="confirmation" class="send-confirmation" role="alert">
          <strong>Confirmar envío</strong>
          <p>
            Enviarás «{{ confirmation.subject }}» a {{ confirmation.emails.length }} destinatarios.
            Se excluirán los correos dados de baja.
          </p>
          <div class="flex gap-2">
            <button type="button" :disabled="busy || !ready || !canSend" @click="confirmSend">
              Confirmar y enviar</button
            ><button type="button" @click="confirmation = null">Cancelar</button>
          </div>
        </div>
      </div>
      <aside class="editor-preview">
        <section v-if="canSend" class="test-current-message">
          <h3>Prueba antes de enviar</h3>
          <p>Recibe este diseño y mensaje en tu correo, sin crear una campaña.</p>
          <label
            >Correo de prueba<input
              v-model="testEmail"
              type="email"
              placeholder="tu-correo@empresa.com" /></label
          ><button type="button" :disabled="busy || !ready || !testEmail" @click="sendTest">
            Enviar prueba
          </button>
        </section>
        <CampaignPreview
          v-if="templatesLoaded"
          :template-key="form.template_key"
          :subject="form.subject"
          :body="form.body"
        />
      </aside>
    </div>
  </form>
</template>

<style scoped>
.test-current-message {
  background: white;
  border: 1px solid #dce2ed;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 22px;
}
.test-current-message h3 {
  font-size: 14px;
  font-weight: 700;
}
.test-current-message p {
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
  margin: 5px 0 12px;
}
.test-current-message label {
  font-size: 12px;
}
.test-current-message button {
  margin-top: 10px;
}
.send-confirmation {
  padding: 16px;
  background: #f0f2ff;
  border: 1px solid #c7cdf1;
  border-radius: 12px;
}
.send-confirmation p {
  font-size: 13px;
  line-height: 1.6;
  margin: 10px 0;
}

.template-picker {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.template-picker legend {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 10px;
}
.template-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.template-option {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 14px 10px;
  border: 1px solid #dce2ed;
  border-radius: 12px;
  cursor: pointer;
  background: #fff;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.template-option.selected {
  background: #f1f2ff;
  border-color: #686bd0;
  box-shadow: 0 0 0 1px #686bd0;
}
.template-option:focus-within {
  outline: 3px solid #c7d2fe;
  outline-offset: 2px;
}
.template-option input,
.simple-option input {
  width: 15px;
  height: 15px;
  margin: 0;
  padding: 0;
  accent-color: #5356bb;
  flex-shrink: 0;
}
.template-country {
  font-size: 10px;
  font-weight: 800;
  color: #5356bb;
  background: #e5e7fc;
  border-radius: 7px;
  padding: 6px;
}
.template-option strong {
  display: block;
  font-size: 12px;
  color: #24324b;
}
.template-option small {
  display: block;
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
  margin-top: 3px;
}
.simple-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
  margin-top: 14px;
  cursor: pointer;
}
.audience-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.audience-count {
  font-size: 11px;
  color: #5356bb;
  background: #eff0ff;
  padding: 5px 9px;
  border-radius: 20px;
  font-weight: 600;
}
.field-counter {
  float: right;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 400;
}
@media (max-width: 600px) {
  .template-options {
    grid-template-columns: 1fr;
  }
}
</style>
